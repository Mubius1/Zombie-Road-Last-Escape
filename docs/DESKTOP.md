# DESKTOP.md — Wrapper desktop Electron

> Packaging **puramente additivo**. Electron è un secondo binario **opzionale** che incapsula
> lo stesso gioco web. `npm run dev` (browser, HMR) resta IDENTICO: nessun file di `src/` è
> toccato, nessuna logica di gioco/art bible/bilanciamento/i18n cambia. Vale la **Regola n.1**
> del progetto: questo doc non introduce grafica/audio nuovi, solo confezionamento.

## A cosa serve

Distribuire *Zombie Road: Last Escape* come app desktop Windows (installer NSIS) senza
riscrivere nulla: il gioco gira nel renderer Chromium di Electron esattamente come nel browser.
Lo scaffold è pronto per innestare in futuro l'IPC Steamworks (achievement, presence, cloud
save) via il bridge `preload`, **fuori scopo ora**.

## Struttura

```
electron/                     # FUORI da src/ → non soggetto al guard ".js vietato" di src/
  main.ts                     # processo main: crea la finestra, sicurezza, single-instance, link esterni
  preload.ts                  # bridge MINIMO e tipizzato su window.desktop (oggi quasi vuoto)
  bridge.ts                   # contratto DesktopBridge + dichiarazione globale window.desktop (solo tipi)
  dev.mjs                     # launcher di sviluppo (orchestratore Vite + Electron) — script Node
  finalize-cjs.mjs            # post-build: scrive dist-electron/package.json {"type":"commonjs"}
tsconfig.electron.json        # tsconfig DEDICATO: compila electron/*.ts → dist-electron/ come CommonJS
electron-builder.yml          # config electron-builder (Windows/NSIS, output in release/)
dist-electron/                # OUTPUT compilato del wrapper (gitignored)
release/                      # OUTPUT di electron-builder (gitignored)
```

`tsconfig.json` del gioco resta **invariato** (`noEmit`, include solo `src`). Il wrapper ha il
suo `tsconfig.electron.json` separato che **emette** in `dist-electron/`.

## Script npm (tutti NUOVI — dev/build/validate/lint esistenti invariati)

| Script | Cosa fa |
|---|---|
| `npm run dev:desktop` | Avvia Vite (con `ELECTRON=1` → niente scheda browser) + Electron sul dev server `http://localhost:5173` con **HMR vivo** nella finestra. |
| `npm run build:electron` | Compila `electron/` → `dist-electron/` (`tsc -p tsconfig.electron.json`) e scrive il marker `{"type":"commonjs"}`. |
| `npm run build:desktop` | `npm run build` (gioco web → `dist/`) **+** `build:electron`. |
| `npm run dist` | `build:desktop` **+** `electron-builder --win` → installer in `release/`. |

`npm run dev`, `build`, `validate*`, `lint` NON sono stati modificati.

## `dev:desktop` vs `dist` — la differenza

- **`dev:desktop`** (sviluppo): la finestra Electron fa `loadURL('http://localhost:5173')`.
  Il renderer è servito dal **dev server Vite**, quindi l'HMR funziona dentro la finestra
  (salvi un file di `src/` → ricarica a caldo). DevTools aperti. Nessun packaging.
- **`dist`** (produzione): si builda il gioco in `dist/` (statico) e la finestra fa
  `loadFile('dist/index.html')` da **`file://`**. Niente dev server, niente HMR, DevTools chiusi.
  electron-builder impacchetta `dist/` + `dist-electron/` in un installer NSIS.

### La trappola `file://` (risolta)

In produzione gli asset si caricano da `file://`. Vite di default usa `base: '/'` → i tag
asset puntano alla **radice del filesystem** (`/assets/...`) → **schermo nero**. Fix in
`vite.config.ts`: **`base: './'`** → gli asset sono relativi all'index (`./assets/...`) e si
risolvono accanto al file. In dev (server HTTP) è trasparente: `npm run dev` non cambia.
**Verificato** (vedi sotto): `dist/index.html` emette `src="./assets/index-*.js"` e il gioco
carica in Electron da `file://` con canvas attivo.

### `server.open` condizionale (niente doppia scheda)

`npm run dev` apre il browser (`server.open: true`) come sempre. Quando il launcher avvia Vite
imposta l'env `ELECTRON=1`; `vite.config.ts` legge `process.env.ELECTRON === '1'` e mette
`open: !isElectron` → in `dev:desktop` Vite **non** apre la scheda (il gioco va nella finestra).
È l'**unica** modifica a `vite.config.ts` legata a Electron: nessun plugin Electron, nessuna
alterazione del flusso `npm run dev`.

## Decisione: CommonJS (non ESM) per main/preload

Il package root è `"type": "module"`. Per il wrapper si è scelto **CommonJS**:

- `tsconfig.electron.json` → `"module": "CommonJS"`, output `dist-electron/*.js`;
- `finalize-cjs.mjs` scrive `dist-electron/package.json` con `{"type":"commonjs"}` → quei `.js`
  sono interpretati come CommonJS **nonostante** il root sia ESM (il package.json più vicino
  vince). Così `require`/`__dirname` sono disponibili senza shim.

**Perché non ESM**: Electron 42 supporta ESM nel main, ma la combinazione ESM + electron-builder
+ `__dirname`/`preload` resolution è ancora più fragile (estensioni esplicite, `import.meta.url`,
asset path). CommonJS è la via più robusta e portabile per un wrapper così sottile. Si è preferito
il marker `package.json` al rinominare i sorgenti in `.cts` per **mantenere i sorgenti in `.ts`**
(come richiesto) e import senza estensione.

## Decisione: launcher Node custom (non `concurrently` + `wait-on`)

`dev:desktop` usa `electron/dev.mjs`, un piccolo orchestratore Node, invece di aggiungere
`concurrently` + `wait-on`. **Motivi**:

1. **Zero dipendenze extra**: entrambe sarebbero devDependencies solo per il dev.
2. **Controllo del teardown**: chiusa la finestra Electron (o Vite), il launcher spegne l'altro
   processo in modo pulito (SIGINT/SIGTERM propagati).
3. **Nessun rischio sullo script `dev` canonico**: il browser dev resta intatto.

Il launcher: (1) compila `electron/`; (2) avvia Vite; (3) fa polling HTTP su `:5173` finché
risponde (`fetch`, no dipendenze); (4) avvia Electron sul main compilato.

### Processi DIRETTI (stabilità esbuild + niente orfani) — importante

Vite ed Electron sono avviati come processi **diretti** — `node node_modules/vite/bin/vite.js`
e il binario Electron (`require('electron')`) — **senza** passare da `npm`/`npx` né dalla shell.
Due motivi concreti:

1. **Servizio esbuild stabile.** Avviare Vite via `npm.cmd run dev` con `shell: true` su Windows
   mette di mezzo `cmd.exe → npm → node`: il **servizio esbuild** (processo a vita lunga che il
   *dev server* tiene attivo per le transform TS→JS) eredita pipe stdio fragili in quella catena
   e può morire con **`The service is no longer running`** alla prima trasformazione (il `build`
   non usa quel servizio persistente → per questo passa lo stesso). Un genitore **Node pulito**
   evita il problema.
2. **Niente processi orfani.** Con `shell: true`, `child.kill()` ammazzava la **shell** ma
   lasciava **Vite orfano** ad occupare `:5173`. Al rilancio successivo il launcher trovava un
   vecchio Vite (col servizio esbuild ormai morto) ancora su `:5173`, ci puntava Electron e
   mostrava l'errore esbuild. Con lo spawn diretto, `kill()` termina davvero Vite → nessun zombie.

A difesa, in `vite.config.ts` il dev server usa **`strictPort: isElectron`**: con `ELECTRON=1`
Vite *deve* ottenere `:5173` o fallire subito (il launcher se ne accorge), invece di slittare su
`:5174` e disallinearsi dal launcher. `npm run dev` (browser) mantiene l'auto-incremento comodo.

> **Se vedi `The service is no longer running`**: c'è un vecchio dev server orfano su `:5173`.
> Chiudilo (Gestione attività → termina i processi `node`, oppure `taskkill /F /PID <pid>` del
> processo in LISTENING su 5173) e rilancia. Col launcher attuale non si accumulano più.

### Difesa `ELECTRON_RUN_AS_NODE`

Alcuni ambienti (CI/IDE) settano `ELECTRON_RUN_AS_NODE=1`, che fa girare il binario Electron
come **Node puro** → `app` è `undefined` → crash all'avvio. Il launcher rimuove esplicitamente
quella env (`cleanEnv` la elimina) sia per Vite sia per Electron. Riscontrato e gestito in questo
ambiente di sviluppo.

## Sicurezza

`webPreferences`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
Il renderer (il gioco) NON ha accesso a Node. L'unico ponte è `preload.ts` → `contextBridge.
exposeInMainWorld('desktop', …)`, che oggi espone solo `{ isDesktop: true }` (scaffold). Link
esterni (`window.open`/`target=_blank`) → browser di sistema via `setWindowOpenHandler` +
`shell.openExternal`. DevTools **solo in dev**. Single-instance lock attivo.

## Finestra

Sfondo `#000` (gioco scuro, niente flash bianco), mostrata su `'ready-to-show'`. Default
1280×720, min 800×600, ridimensionabile, fullscreen abilitato (`fullscreenable: true`;
il toggle in-game via Phaser Scale Manager `toggleFullscreen()` usa la Fullscreen API di
Chromium, supportata in Electron), `autoHideMenuBar: true`, quit pulito su `window-all-closed`.

## Persistenza (SaveData / Settings)

`src/SaveData.ts` e `src/Settings.ts` usano `localStorage`. In Electron il `localStorage` del
renderer è persistito automaticamente sotto la cartella **userData** dell'app (per-origin). In
produzione l'origin è `file://` ed è **stabile** tra avvii → record, checkpoint della corsa e
preferenze sopravvivono. **Verificato concettualmente**: stesso meccanismo localStorage,
nessun codice di salvataggio toccato. Da confermare a mano: che dopo una `dist` installata i
dati persistano tra riavvii dell'app (atteso: sì).

## Icona app

**Decisione da confermare.** Per ora electron-builder usa l'icona **default** di Electron
(`win.icon` commentato in `electron-builder.yml`). La regola "niente PNG" del progetto riguarda
la **grafica di gioco**, non il packaging: prima della distribuzione si può fornire un
`build/icon.ico` (256×256) e decommentare `win.icon`. Non bloccante.

## Stato di verifica

**Verificato in questo ambiente:**

- `npm run lint` → **verde** (`eslint src`; `electron/` è fuori dal lint del gioco per costruzione).
- Build del gioco web (`vite build`) con `base: './'` → `dist/index.html` usa path **relativi**.
- `tsc -p tsconfig.electron.json` → compila pulito; output è CommonJS valido (`node --check` OK).
- **Modalità PROD reale** (probe headless): Electron carica `dist/index.html` da `file://`,
  Phaser 3.90 (WebGL | Web Audio) si avvia, **canvas presente**, **nessun `did-fail-load`**
  (niente schermo nero), e `window.desktop.isDesktop === true` (bridge preload esposto).
- **Modalità DEV** (`dev:desktop`): launcher avvia Vite con `ELECTRON=1` (server ready su
  `:5173`, **nessuna scheda browser**) e lancia Electron; il path dev condivide `createWindow`
  + preload con quello prod già validato.

**Da testare a mano (non eseguibile/decidibile qui):**

- `npm run dist`: packaging NSIS completo. **Attenzione**: `electron-builder` (`node-abi`)
  avverte `EBADENGINE` perché preferisce **Node ≥ 22.12** (qui Node 20.19) — il warning non ha
  bloccato l'install, ma il packaging va eseguito/validato su una macchina con Node aggiornato.
- Apertura della finestra a schermo intero e toggle fullscreen in-game.
- Persistenza localStorage tra riavvii dell'app installata.
- Eventuale `build/icon.ico` definitivo.
- (Opzionale, non in scopo) Content-Security-Policy: in prod Electron logga un warning
  "Insecure Content-Security-Policy". Innocuo per un'app locale; si può aggiungere una CSP più avanti.

## Fuori scopo (lasciato pronto)

Steamworks SDK, achievement, cloud save, code signing, auto-update, target Linux/macOS, asset
store. Il bridge `preload`/`bridge.ts` è il punto d'innesto per l'IPC Steamworks futuro.
