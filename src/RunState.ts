import Phaser from 'phaser';

/**
 * Stato della "run" sul registry di Phaser: sopravvive ai cambi scena (game → negozio → game),
 * viene azzerato al game over e alla Nuova Partita.
 *
 * `resetRunState` centralizza i default in UN solo punto: prima il blocco di nove `registry.set`
 * era copiato carattere per carattere in GameScene.endGame, MenuScene.newGame e
 * DebugScene.startFresh — aggiungere/cambiare una chiave costringeva a ricordarsi tre file.
 * Il contratto delle chiavi è documentato in ARCHITETTURA.md §6.1.
 */
export function resetRunState(registry: Phaser.Data.DataManager) {
  registry.set('missionNumber', 1);
  registry.set('money', 0);
  registry.set('survivors', []);
  registry.set('upgrades', {});
  registry.set('vehicle', 'civilian_car');
  registry.set('ownedVehicles', ['civilian_car']);
  registry.set('ownedWeapons', ['mg']);
  registry.set('currentWeapon', 'mg');
  registry.set('components', null);
}
