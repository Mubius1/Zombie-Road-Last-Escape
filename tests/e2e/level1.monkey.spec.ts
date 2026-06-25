import { test, expect } from '@playwright/test';
import { bootGame, startMission, captureErrors, readState, canvasBox } from './harness';

/**
 * LIVELLO 1 — "monkey": un giocatore stupido che martella input REALI (tastiera + mouse) a caso per
 * un po', con RNG seedato (gioco e monkey ripetibili). Non sa giocare: serve a stanare crash, eccezioni
 * non gestite e soft-lock. Non giudica il gameplay — quello è il Livello 2.
 */
test('Livello 1 — monkey: input casuali non causano crash', async ({ page }) => {
  const errors = captureErrors(page);
  await bootGame(page, { resolution: 0, seed: 0xbada55 });
  await startMission(page);
  const box = await canvasBox(page);

  // Tasti di GIOCO sicuri: niente ESC (pausa), 0 (debug scene) o M/Enter (cambio scena) — restiamo in partita.
  const KEYS = [
    'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ShiftLeft',
    'KeyQ', 'KeyF', 'KeyC', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  ];
  // PRNG locale seedato (LCG) → la sequenza del monkey è ripetibile run-to-run.
  let s = 0x1234567;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;

  const DURATION = 20_000;
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < DURATION) {
    const k = KEYS[Math.floor(rnd() * KEYS.length)]!;
    await page.keyboard.down(k);

    await page.mouse.move(box.x + rnd() * box.width, box.y + rnd() * box.height);
    if (rnd() < 0.35) { await page.mouse.down(); await page.mouse.up(); }

    await page.waitForTimeout(40 + Math.floor(rnd() * 70));
    await page.keyboard.up(k);

    if (++i % 30 === 0) {
      const st = await readState(page);
      // Se è morto, riparti (SPAZIO al game over = restart) così il monkey continua a stressare.
      if (st.game && st.game.alive === false) {
        await page.keyboard.down('Space');
        await page.waitForTimeout(150);
        await page.keyboard.up('Space');
      }
    }
  }

  const st = await readState(page);
  expect(st.active.length, 'nessuna scena attiva: il gioco si è bloccato?').toBeGreaterThan(0);
  expect(errors, errors.join('\n')).toEqual([]);
});
