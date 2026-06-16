import { defineConfig } from 'vite';
import validateOnDev from './scripts/vite-plugin-validate.mjs';

// In dev (`npm run dev`) il plugin esegue i validatori anti-deriva (art + balance)
// all'avvio e a ogni salvataggio dei file rilevanti. In build il gate è negli
// script npm (vedi package.json → "build"). Il plugin è inerte durante `vite build`.
export default defineConfig({
  plugins: [validateOnDev()],
});
