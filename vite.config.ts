import { defineConfig } from 'vite';
import validateOnDev from './scripts/vite-plugin-validate.mjs';

// Config Vite UNICA e canonica (prima erano due file in conflitto: vite.config.ts con
// server.open/port ma senza plugin, e vite.config.mjs col plugin ma senza server → Vite ne
// risolveva uno solo e metà impostazioni non si applicava).
//
// In dev (`npm run dev`) il plugin esegue i validatori anti-deriva (art + balance + audio)
// all'avvio e a ogni salvataggio dei file rilevanti. In build il gate duro è negli script npm
// (package.json → "build"); il plugin è inerte durante `vite build`.
export default defineConfig({
  root: '.',
  plugins: [validateOnDev()],
  server: {
    open: true,
    port: 5173,
  },
});
