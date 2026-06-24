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

export default defineConfig({
  root: '.',
  // base relativa: in produzione Electron carica `dist/` da `file://` (non da un web server);
  // con base '/' (default Vite) gli asset punterebbero alla radice del filesystem → schermo nero.
  // './' li risolve relativi all'index → la build pacchettizzata funziona. In dev (server HTTP)
  // è del tutto trasparente e non cambia `npm run dev`.
  base: './',
  plugins: [validateOnDev()],
  server: {
    open: !isElectron,
    port: 5173,
    // Con Electron (dev:desktop) il launcher punta a 5173 fisso: se la porta è occupata Vite DEVE
    // fallire subito (strictPort) invece di slittare su 5174 — altrimenti il launcher caricherebbe
    // una vecchia istanza su 5173. `npm run dev` (browser) resta con l'auto-incremento comodo.
    strictPort: isElectron,
  },
});
