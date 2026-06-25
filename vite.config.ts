import { defineConfig } from 'vite';
import validateOnDev from './scripts/vite-plugin-validate.mjs';

// Config Vite UNICA e canonica (prima erano due file in conflitto: vite.config.ts con
// server.open/port ma senza plugin, e vite.config.mjs col plugin ma senza server → Vite ne
// risolveva uno solo e metà impostazioni non si applicava).
//
// In dev (`npm run dev`) il plugin esegue i validatori anti-deriva (art + balance + audio)
// all'avvio e a ogni salvataggio dei file rilevanti. In build il gate duro è negli script npm
// (package.json → "build"); il plugin è inerte durante `vite build`.
// Wrapper desktop (additivo): quando il launcher `electron/dev.mjs` avvia Vite imposta ELECTRON=1.
// In quel caso NON apriamo la scheda del browser (il gioco va mostrato nella finestra Electron).
// `npm run dev` normale (senza la env) resta IDENTICO: apre il browser come prima.
const isElectron = process.env.ELECTRON === '1';
// I test E2E (Playwright) avviano il dev server con PW_TEST=1: in quel caso NON apriamo la scheda del
// browser (il controllo lo fa Playwright in headless). `npm run dev` normale resta identico.
const isTest = process.env.PW_TEST === '1';

export default defineConfig({
  root: '.',
  // base relativa: in produzione Electron carica `dist/` da `file://` (non da un web server);
  // con base '/' (default Vite) gli asset punterebbero alla radice del filesystem → schermo nero.
  // './' li risolve relativi all'index → la build pacchettizzata funziona. In dev (server HTTP)
  // è del tutto trasparente e non cambia `npm run dev`.
  base: './',
  plugins: [validateOnDev()],
  // Pre-bundla Phaser all'avvio del server: evita che Vite lo ri-ottimizzi a metà sessione e forzi un
  // full-reload della pagina (che sotto Playwright azzererebbe stato/hook a partita in corso). Innocuo e
  // anche più rapido in `npm run dev` normale (unica dipendenza del gioco).
  optimizeDeps: { include: ['phaser'] },
  server: {
    open: !isElectron && !isTest,
    port: 5173,
    // Con Electron (dev:desktop) il launcher punta a 5173 fisso: se la porta è occupata Vite DEVE
    // fallire subito (strictPort) invece di slittare su 5174 — altrimenti il launcher caricherebbe
    // una vecchia istanza su 5173. `npm run dev` (browser) resta con l'auto-incremento comodo.
    strictPort: isElectron,
    // Sotto Playwright (PW_TEST) niente HMR: una ricarica a metà partita azzererebbe lo stato e l'hook
    // `__ZR` durante un test. In più ignoriamo sempre gli artefatti di test nel watcher, così le scritture
    // di Playwright (screenshot/tracce/report) non innescano un reload della pagina sotto test.
    hmr: isTest ? false : undefined,
    watch: { ignored: ['**/test-results/**', '**/playwright-report/**', '**/tests/**'] },
  },
});
