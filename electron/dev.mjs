// Launcher di SVILUPPO desktop — orchestratore minimale per `npm run dev:desktop`.
//
// SCELTA (vedi docs/DESKTOP.md): un piccolo launcher Node custom invece di `concurrently` +
// `wait-on`. Motivo: zero dipendenze extra, controllo pieno su ordine e teardown, e nessun
// rischio di toccare lo script `dev` canonico del browser. Il file è `.mjs` (script Node, non un
// sorgente del gioco) → resta fuori da tsconfig.json e dal guard `.js` di src/.
//
// IMPORTANTE (stabilità esbuild): Vite ed Electron vengono avviati come processi DIRETTI —
// `node node_modules/vite/bin/vite.js` e il binario Electron — SENZA shell e SENZA passare da
// npm/npx. Avviare Vite via `npm.cmd run dev` con `shell:true` su Windows mette di mezzo
// `cmd.exe → npm → node`: il SERVIZIO esbuild (processo a vita lunga del dev server) eredita pipe
// stdio fragili in quella catena e muore con "The service is no longer running" alla prima
// trasformazione. Un genitore Node pulito risolve, e `kill()` chiude davvero Vite (niente più
// processi orfani che tengono occupata la porta 5173 ai rilanci).
//
// Cosa fa, in ordine:
//  1) compila electron/ → dist-electron/ (tsc -p tsconfig.electron.json);
//  2) avvia Vite (Node diretto) con ELECTRON=1 → vite.config.ts NON apre la scheda browser;
//  3) attende che http://localhost:5173 risponda;
//  4) avvia Electron (binario diretto) puntando a quel server (HMR vivo nella finestra);
//  5) propaga lo spegnimento a tutti i processi figli.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const VITE_URL = 'http://localhost:5173';

// Percorsi dei binari risolti dal progetto (cwd = root quando si lancia `npm run dev:desktop`).
const ROOT = process.cwd();
const VITE_BIN = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const TSC_BIN = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
// Il pacchetto `electron` esporta (default) il PATH dell'eseguibile Electron.
const ELECTRON_BIN = require('electron');

/** Env pulito per i processi Node/Vite: rimuove ELECTRON_RUN_AS_NODE (alcuni IDE/CI lo settano →
 *  confonderebbe i tool che leggono il binario). `extra` permette di aggiungere variabili. */
function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

const children = [];
function shutdown(code = 0) {
  for (const c of children) {
    if (!c.killed) c.kill();
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

/** Esegue un comando Node diretto e si risolve all'uscita (passi one-shot, es. la compilazione). */
async function runToCompletion(bin, args) {
  const child = spawn(process.execPath, [bin, ...args], { stdio: 'inherit', env: cleanEnv() });
  const [code] = await once(child, 'exit');
  if (code !== 0) {
    console.error(`[dev:desktop] "${path.basename(bin)} ${args.join(' ')}" è uscito con codice ${code}`);
    process.exit(code ?? 1);
  }
}

/** Poll HTTP finché il dev server risponde (o scade il timeout). */
async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || res.status === 200) return;
    } catch {
      /* server non ancora pronto: riprova */
    }
    if (Date.now() > deadline) {
      throw new Error(`[dev:desktop] timeout: ${url} non ha risposto entro ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function main() {
  // 1) Compila il wrapper Electron (main/preload) → dist-electron/. Node diretto (niente npx/shell).
  await runToCompletion(TSC_BIN, ['-p', 'tsconfig.electron.json']);

  // 2) Avvia Vite come processo Node DIRETTO (genitore pulito → servizio esbuild stabile).
  //    ELECTRON=1 → vite.config.ts disattiva server.open (niente scheda browser doppia).
  const vite = spawn(process.execPath, [VITE_BIN], { stdio: 'inherit', env: cleanEnv({ ELECTRON: '1' }) });
  children.push(vite);
  vite.on('exit', (code) => shutdown(code ?? 0));

  // 3) Attendi il dev server.
  console.log('[dev:desktop] attendo il dev server su', VITE_URL, '…');
  await waitForServer(VITE_URL);

  // 4) Avvia Electron come VERA app (binario diretto). ELECTRON_RUN_AS_NODE rimosso da cleanEnv →
  //    il binario gira come processo main, non come Node puro (altrimenti `app` sarebbe undefined).
  const electron = spawn(ELECTRON_BIN, ['dist-electron/main.js'], {
    stdio: 'inherit',
    env: cleanEnv({ ELECTRON_DEV: '1', ELECTRON_RENDERER_URL: VITE_URL }),
  });
  children.push(electron);
  // Chiusa la finestra Electron → spegni anche Vite.
  electron.on('exit', (code) => shutdown(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  shutdown(1);
});
