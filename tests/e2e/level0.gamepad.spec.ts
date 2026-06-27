import { test, expect } from '@playwright/test';
import { bootGame, captureErrors, waitForSceneActive } from './harness';

/**
 * LIVELLO 0 — regressione: crash di shutdown del GamepadPlugin (vedi src/phaserPatches.ts).
 *
 * Bug Phaser 3.90: se il browser espone un gamepad a un INDICE NON-ZERO, `this.gamepads` diventa un
 * array sparso e `GamepadPlugin.stopListeners()` chiama `gamepads[i].removeAllListeners()` su uno slot
 * `undefined` durante lo shutdown di QUALSIASI scena → eccezione in `Game.step` → loop di rendering morto
 * → SCHERMO NERO a ogni cambio scena (Nuova Partita, Impostazioni). Non si vede in CI normale perché
 * lì nessun gamepad è connesso. Qui iniettiamo un gamepad FANTASMA all'indice 1 (slot 0 vuoto) per
 * forzare la condizione, e verifichiamo che le transizioni dal menu NON crashino.
 */
test.describe('Livello 0 — regressione gamepad sparso', () => {
  // Inietta un gamepad fantasma all'indice 1 PRIMA del boot (slot 0 resta undefined → array sparso).
  async function injectPhantomPad(page: import('@playwright/test').Page) {
    await page.addInitScript(() => {
      const fakePad = {
        id: 'Phantom Pad (regression)', index: 1, connected: true, mapping: 'standard', timestamp: 0,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false, touched: false })),
        vibrationActuator: null,
      };
      navigator.getGamepads = () => [null, fakePad] as unknown as ReturnType<Navigator['getGamepads']>;
    });
  }

  test('Menu → Nuova Partita non crasha con gamepad a indice non-zero', async ({ page }) => {
    const errors = captureErrors(page);
    await injectPhantomPad(page);
    await bootGame(page, { resolution: 0, seed: 1 });
    await waitForSceneActive(page, 'MenuScene');

    // Percorso reale dell'utente: il menu si spegne (shutdown) → qui scattava il crash.
    await page.keyboard.press('Enter');
    await waitForSceneActive(page, 'NewRunScene'); // se il loop fosse morto, questo andrebbe in timeout

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Menu → Impostazioni non crasha con gamepad a indice non-zero', async ({ page }) => {
    const errors = captureErrors(page);
    await injectPhantomPad(page);
    await bootGame(page, { resolution: 0, seed: 1 });
    await waitForSceneActive(page, 'MenuScene');

    await page.evaluate(() => window.__ZR.scene.getScene('MenuScene').scene.start('SettingsScene'));
    await waitForSceneActive(page, 'SettingsScene');

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
