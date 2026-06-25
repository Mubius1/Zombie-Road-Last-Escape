import { defineConfig, devices } from '@playwright/test';

/**
 * Configurazione dei test E2E "giocatore automatico" (docs/TESTING.md §7).
 *
 * I test pilotano il gioco REALE in un Chromium headless: avviano il dev server Vite (con PW_TEST=1
 * così non apre la scheda del browser), caricano la pagina e leggono lo stato delle scene tramite
 * l'hook dev-only `window.__ZR` (vedi src/game.ts). Tre livelli, un file per livello:
 *   · level0 — smoke d'avvio + bounds dell'interfaccia a ogni risoluzione;
 *   · level1 — "monkey": input casuali reali (tastiera/mouse), caccia ai crash;
 *   · level2 — bot interno: invarianti di stato per-frame + morte/reset + transizione di missione.
 *
 * WebGL headless: i flag ANGLE/SwiftShader danno un rasterizzatore software affidabile (il gioco
 * comunque degrada a Canvas2D se WebGL manca — il post-processing GLSL viene semplicemente saltato).
 */

// Porta DEDICATA ai test (≠ 5173 di `npm run dev`): isola il server di test da un eventuale dev server
// aperto per lo sviluppo, così Playwright non riusa per sbaglio un server con la config sbagliata (senza
// PW_TEST → HMR attivo → reload a metà partita). Vedi docs/TESTING.md §7.
const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Un solo dev server + contesto WebGL condiviso → eseguiamo in serie per stabilità e leggibilità.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',

  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      // WebGL software in headless (altrimenti il contesto può fallire su CI/macchine senza GPU).
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PW_TEST: '1' },
  },
});
