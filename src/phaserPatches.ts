import Phaser from 'phaser';

/**
 * Hotfix per un BUG di Phaser 3.90 — `GamepadPlugin.stopListeners()` crasha durante lo shutdown di
 * QUALSIASI scena quando il browser espone un gamepad a un indice non-zero.
 *
 * Causa: `this.gamepads` è un array SPARSO (i pad sono memorizzati all'`index` del browser, vedi
 * `refreshPads` → `currentPads[index] = newPad`). Se un pad compare all'indice ≥1 — controller fisico,
 * Steam Input, DS4Windows/x360ce, o dispositivi HID che il browser mappa come gamepad — restano "buchi"
 * `undefined` nell'array. Il `stopListeners` originale itera per indice e chiama
 * `this.gamepads[i].removeAllListeners()` SENZA guardia (mentre `getAll()`/`destroy()` la mettono):
 * sul buco lancia `Cannot read properties of undefined (reading 'removeAllListeners')`, l'eccezione
 * risale fino a `Game.step` e UCCIDE il loop di rendering → SCHERMO NERO CONGELATO a ogni cambio scena
 * (Nuova Partita, Impostazioni, negozio, …). Non si vede in headless/CI perché lì nessun gamepad è
 * esposto (`navigator.getGamepads()` tutto null → array vuoto → niente buchi).
 *
 * Fix: ripristiniamo la guardia mancante (salta gli slot `undefined`, ripulisce solo i pad reali) e
 * proteggiamo anche `this.target`. Riprodotto e verificato (gamepad fantasma all'indice 1, vedi commit).
 * Da rimuovere quando Phaser corregge upstream. Il patch è strettamente più sicuro: nei casi non sparsi
 * il comportamento è identico all'originale.
 */

/** Vista minima sui campi interni del GamepadPlugin toccati da stopListeners (non esposti nei .d.ts). */
interface GamepadPluginInternals {
  target?: { removeEventListener(type: string, handler: unknown): void };
  onGamepadHandler: unknown;
  sceneInputPlugin: { pluginEvents: { off(event: string, fn: unknown): void } };
  update: unknown;
  gamepads: Array<{ removeAllListeners(): void } | undefined>;
}

const proto = Phaser.Input.Gamepad.GamepadPlugin.prototype as unknown as {
  stopListeners(this: GamepadPluginInternals): void;
};

proto.stopListeners = function stopListenersSafe(this: GamepadPluginInternals): void {
  if (this.target) {
    this.target.removeEventListener('gamepadconnected', this.onGamepadHandler);
    this.target.removeEventListener('gamepaddisconnected', this.onGamepadHandler);
  }

  this.sceneInputPlugin.pluginEvents.off(Phaser.Input.Events.UPDATE, this.update);

  // L'array è SPARSO: salta i buchi (l'iteratore degli array restituisce `undefined` per gli indici
  // mancanti) invece di chiamare ciecamente un metodo su `undefined`. Questa è la guardia che mancava.
  for (const pad of this.gamepads) {
    if (pad) { pad.removeAllListeners(); }
  }
};
