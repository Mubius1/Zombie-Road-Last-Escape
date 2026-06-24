// Processo MAIN di Electron — wrapper desktop PURAMENTE ADDITIVO attorno al gioco web.
//
// Questo file NON contiene logica di gioco: crea soltanto la finestra che ospita il gioco
// (in dev: il dev server Vite con HMR vivo; in produzione: i file statici di `dist/`).
//
// Formato modulo: COMMONJS (vedi tsconfig.electron.json → "module": "CommonJS"). L'output finisce
// in `dist-electron/` che contiene un `package.json` con `{"type":"commonjs"}` (scritto dallo script
// `build:electron`), così Node/Electron interpreta i `.js` lì come CommonJS NONOSTANTE il package
// root sia `"type":"module"` → `require`/`__dirname` disponibili, nessun attrito con electron-builder.
import { app, BrowserWindow, Menu, shell } from 'electron';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

// Icona della finestra. In DEV l'eseguibile è il binario generico di Electron (icona di default):
// la impostiamo esplicitamente leggendola da `build/icon.ico` (generata da `npm run icon`, 100%
// procedurale — vedi scripts/generate-icon.mjs). In PROD l'icona è già "cotta" nell'.exe da
// electron-builder (electron-builder.yml → win.icon), quindi qui il file `../build` non esiste e
// la guard `existsSync` semplicemente non imposta nulla. `__dirname` in dev = `dist-electron/`.
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');

// In dev il launcher (electron/dev.mjs) imposta queste env prima di avviarci.
// In produzione non sono settate → carichiamo i file statici da `file://`.
const isDev = process.env['ELECTRON_DEV'] === '1';
const DEV_URL = process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    fullscreenable: true,
    // Sfondo nero: il gioco è scuro → evita il flash bianco prima del primo paint.
    backgroundColor: '#000000',
    // Icona finestra/taskbar in dev (in prod l'.exe ha già la sua, vedi ICON_PATH sopra).
    ...(existsSync(ICON_PATH) ? { icon: ICON_PATH } : {}),
    // Non mostrare finché il contenuto non è pronto (vedi 'ready-to-show').
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // Sicurezza: isolamento del contesto, niente Node nel renderer, sandbox attiva.
      // Il bridge minimo passa SOLO attraverso il preload (contextBridge).
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Il preload è il file compilato accanto a questo, in `dist-electron/`.
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Mostra la finestra solo a primo render pronto → niente lampo bianco su gioco scuro.
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Link esterni (target=_blank o window.open) → browser di sistema, mai una finestra Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    // DEV: carica il dev server Vite (HMR vivo nella finestra) e apre i DevTools.
    void mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // PROD: carica l'index buildato da `file://`. La build Vite usa `base: './'`
    // così gli asset si risolvono in modo relativo (vedi vite.config.ts) → niente schermo nero.
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single-instance lock: una seconda istanza cede subito il passo e riporta in primo piano la prima.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    // Niente menu applicazione: il gioco usa il proprio HUD/pausa e `Alt` non deve
    // richiamare alcuna barra nativa. `autoHideMenuBar` da solo la nasconde ma la lascia
    // evocabile con Alt → la rimuoviamo del tutto a livello globale.
    Menu.setApplicationMenu(null);

    createWindow();

    // macOS è fuori scopo, ma il pattern è innocuo su Windows: ricrea la finestra se serve.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // Quit pulito: chiusa l'ultima finestra, esci (anche fuori da macOS).
  app.on('window-all-closed', () => {
    app.quit();
  });
}
