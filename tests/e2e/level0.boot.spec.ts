import { test, expect } from '@playwright/test';
import { bootGame, startMission, collectUiBounds, captureErrors, readState, RESOLUTION_COUNT } from './harness';

/**
 * LIVELLO 0 — smoke d'avvio + bounds dell'interfaccia (docs/TESTING.md §7).
 * Cattura i crash all'avvio e il bug di posizionamento "elemento UI fuori dalla viewport" a ogni
 * preset di risoluzione (dove il modello spazio-design + zoom è più a rischio: in 16:9 si vede più mondo).
 */
test.describe('Livello 0 — smoke & bounds', () => {
  test('avvio pulito: canvas montato, nessun errore di boot', async ({ page }) => {
    const errors = captureErrors(page);
    await bootGame(page, { resolution: 0, seed: 1 });

    const box = await page.locator('#game-container canvas').boundingBox();
    expect(box, 'canvas non montato').not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    const st = await readState(page);
    expect(st.active, `scene attive: ${st.active.join(',')}`).toContain('MenuScene');

    // Avvia e gioca qualche secondo (gas tenuto): nessuna eccezione né console.error.
    await startMission(page);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyD');

    expect(errors, errors.join('\n')).toEqual([]);
  });

  // Menu: l'UI interattiva deve stare dentro la viewport a OGNI risoluzione (veloce, niente missione).
  for (let r = 0; r < RESOLUTION_COUNT; r++) {
    test(`UI nella viewport @ preset ${r} (menu)`, async ({ page }) => {
      const errors = captureErrors(page);
      await bootGame(page, { resolution: r, seed: 1 });

      const res = await collectUiBounds(page);
      expect(res.checked, 'nessun elemento interattivo trovato — boot fallito?').toBeGreaterThan(0);
      expect(res.violations, JSON.stringify(res.violations, null, 2)).toEqual([]);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }

  // In gioco: bounds dell'HUD su due preset rappresentativi — 4:3 minimo (0) e 16:9 massimo (7).
  for (const r of [0, 7]) {
    test(`UI nella viewport @ preset ${r} (in gioco)`, async ({ page }) => {
      const errors = captureErrors(page);
      await bootGame(page, { resolution: r, seed: 1 });
      await startMission(page);
      await page.waitForTimeout(500);

      const res = await collectUiBounds(page);
      expect(res.violations, JSON.stringify(res.violations, null, 2)).toEqual([]);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});
