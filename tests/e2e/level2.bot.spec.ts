import { test, expect } from '@playwright/test';
import {
  bootGame, startMission, captureErrors, readState,
  findInvariantViolations, canvasBox, pollUntilSceneLeavesGame,
} from './harness';

/**
 * LIVELLO 2 — bot interno + invarianti di stato (docs/TESTING.md §7).
 * Il vero "giocatore-tester": pilota la partita e a ogni campione verifica le invarianti che NON
 * devono mai rompersi (NaN, valori fuori range, posizione fuori dal mondo, score che torna indietro).
 * Più la transizione di fine missione e il reset totale alla morte (ramo debugRun, deterministico).
 */
test.describe('Livello 2 — bot interno & invarianti', () => {
  test('invarianti di stato durante il gioco', async ({ page }) => {
    const errors = captureErrors(page);
    let loads = 0;
    page.on('load', () => loads++); // rilevatore di reload: dopo il boot deve restare 1
    await bootGame(page, { resolution: 0, seed: 4242 });
    await startMission(page);

    // Guida di base: gas tenuto + fuoco continuo (mouse premuto, MG = munizioni infinite) + oscillazione.
    const box = await canvasBox(page);
    await page.keyboard.down('KeyD');
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
    await page.mouse.down();

    const violations: string[] = [];
    let prevScore = 0;
    let sawGame = false;
    let maxDistance = 0;
    let reloadedToMenu = false;
    let dir: 'ArrowUp' | 'ArrowDown' = 'ArrowUp';
    const start = Date.now();
    while (Date.now() - start < 30_000) {
      await page.keyboard.down(dir);
      await page.waitForTimeout(300);
      await page.keyboard.up(dir);
      dir = dir === 'ArrowUp' ? 'ArrowDown' : 'ArrowUp';

      const st = await readState(page);
      if (st.game) {
        // Uscita dal controllo (morte o fine missione): finestra di gameplay chiusa, ci fermiamo.
        // (Durante boss/freeze continuiamo: i controlli di posizione si auto-disattivano.)
        if (!st.game.alive || st.game.missionDone) break;
        sawGame = true;
        maxDistance = Math.max(maxDistance, st.game.distance);
        violations.push(...findInvariantViolations(st));
        if (st.game.score + 0.001 < prevScore) violations.push(`score diminuito: ${prevScore} → ${st.game.score}`);
        prevScore = st.game.score;
      } else if (sawGame && st.active.includes('MenuScene')) {
        // Eravamo in gioco e ora siamo al menu SENZA essere morti → reload anomalo a metà partita.
        reloadedToMenu = true;
        break;
      }
    }
    await page.keyboard.up('KeyD');
    await page.mouse.up();

    expect(violations, violations.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
    // Guardie di onestà: nessun reload anomalo, e la partita è DAVVERO avvenuta (la pagina non si è
    // ricaricata e il veicolo ha percorso distanza). Una morte precoce del bot è invece legittima.
    expect(reloadedToMenu, 'tornati al menu a metà partita (reload anomalo)').toBe(false);
    expect(loads, `la pagina si è ricaricata ${loads - 1} volta/e a metà test`).toBe(1);
    expect(sawGame && maxDistance > 0, 'la partita non è mai partita o il veicolo non si è mosso').toBe(true);
  });

  test('morte → reset totale (ramo debugRun) ripristina i default', async ({ page }) => {
    const errors = captureErrors(page);
    await bootGame(page, { resolution: 0, seed: 7 });
    await startMission(page);

    // Sporca lo stato, forza il ramo di reset totale di endGame (debugRun) e uccidi con carburante a 0.
    // (La morte NORMALE è invece "checkpoint resume" con pedaggio: qui vogliamo proprio resetRunState.)
    await page.keyboard.down('KeyD'); // gas tenuto → il path del carburante gira di sicuro ogni frame
    await page.evaluate(() => {
      const gs = window.__ZR.scene.getScene('GameScene');
      gs.debugRun = true;
      const reg = gs.registry;
      reg.set('money', 777);
      reg.set('missionNumber', 5);
      reg.set('currentWeapon', 'shotgun');
      reg.set('ownedWeapons', ['mg', 'shotgun']);
      gs.fuel = 0; // → endGame al prossimo frame (GameScene: fuel <= 0)
    });
    await page.waitForFunction(() => {
      const gs = window.__ZR.scene.getScene('GameScene');
      return !!gs && gs.alive === false;
    }, undefined, { timeout: 10_000 });
    await page.keyboard.up('KeyD');

    const st = await readState(page);
    expect(st.money).toBe(0);
    expect(st.missionNumber).toBe(1);
    expect(st.vehicle).toBe('civilian_car');
    expect(st.currentWeapon).toBe('mg');
    expect(st.ownedWeapons).toEqual(['mg']);
    expect(st.survivors).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('completamento missione: transizione senza errori né invarianti rotte', async ({ page }) => {
    const errors = captureErrors(page);
    await bootGame(page, { resolution: 0, seed: 99 });
    await startMission(page);

    // Tasto debug N = completa la missione (solo DEV). Attendi missionDone.
    await page.keyboard.press('KeyN');
    await page.waitForFunction(() => {
      const gs = window.__ZR.scene.getScene('GameScene');
      return !!gs && gs.missionDone === true;
    }, undefined, { timeout: 15_000 });

    const mid = await readState(page);
    expect(findInvariantViolations(mid), 'invarianti rotte a missione completata').toEqual([]);

    // SPAZIO → sosta diegetica. L'handler `once('keydown-SPACE')` si registra solo DOPO l'animazione
    // di overlay di fine missione: premiamo SPAZIO a intervalli finché non si esce da GameScene.
    const left = await pollUntilSceneLeavesGame(page, 20_000);
    expect(left, 'non si è usciti da GameScene dopo il completamento').toBe(true);

    const after = await readState(page);
    expect(after.active.some((k) => k !== 'GameScene'), `scene attive: ${after.active.join(',')}`).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
