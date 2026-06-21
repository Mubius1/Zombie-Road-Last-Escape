import Phaser from 'phaser';
import { Upgrades, WeaponType } from './GameData';
import type { ComponentKey } from './World';

/**
 * Stato della "run" sul registry di Phaser: sopravvive ai cambi scena (game → negozio → game),
 * viene azzerato al game over e alla Nuova Partita.
 *
 * Il registry di Phaser è `any`-tipizzato (`registry.get('chiave')` → any). `RunData` + i wrapper
 * `getRun`/`setRun` (A3) danno un contratto tipizzato a quel canale stringly-typed: le chiavi sono
 * vincolate a `keyof RunData` e il valore al tipo giusto → un refuso di chiave o un valore del tipo
 * sbagliato diventano errori di compilazione invece di bug silenziosi a runtime.
 * Il contratto è documentato in ARCHITETTURA.md §6.1.
 */
export interface RunData {
  missionNumber: number;
  money: number;
  survivors: string[];
  upgrades: Upgrades;
  vehicle: string;
  ownedVehicles: string[];
  ownedWeapons: WeaponType[];
  currentWeapon: WeaponType;
  /** Salute (0..100) per componente, tramandata negozio→gioco; null = veicolo fresco. */
  components: Record<ComponentKey, number> | null;
  /** Punteggio dell'ultima partita conclusa (per overlay/record). */
  lastScore: number;
}

/** Lettura tipizzata dal registry. Ritorna `undefined` se la chiave non è ancora impostata
 *  (i chiamanti applicano il proprio default con `?? …`, come prima). */
export function getRun<K extends keyof RunData>(reg: Phaser.Data.DataManager, key: K): RunData[K] | undefined {
  return reg.get(key) as RunData[K] | undefined;
}

/** Scrittura tipizzata sul registry. */
export function setRun<K extends keyof RunData>(reg: Phaser.Data.DataManager, key: K, value: RunData[K]): void {
  reg.set(key, value);
}

/**
 * Default della run in UN solo punto: prima il blocco di `registry.set` era copiato in
 * GameScene.endGame, MenuScene.newGame e DebugScene.startFresh — cambiare una chiave costringeva
 * a ricordarsi tre file. Ora passa da `setRun` → anche i default sono type-checked.
 */
export function resetRunState(registry: Phaser.Data.DataManager) {
  setRun(registry, 'missionNumber', 1);
  setRun(registry, 'money', 0);
  setRun(registry, 'survivors', []);
  setRun(registry, 'upgrades', {});
  setRun(registry, 'vehicle', 'civilian_car');
  setRun(registry, 'ownedVehicles', ['civilian_car']);
  setRun(registry, 'ownedWeapons', ['mg']);
  setRun(registry, 'currentWeapon', 'mg');
  setRun(registry, 'components', null);
}

/**
 * Cattura lo stato corrente della run dal registry in un oggetto serializzabile (checkpoint).
 * Usato per persistere la corsa su disco (SaveData) a inizio missione → "CONTINUA" cross-sessione
 * e ripristino alla morte (campagna a checkpoint). Inverso: `restoreRun`.
 */
export function snapshotRun(registry: Phaser.Data.DataManager): RunData {
  return {
    missionNumber: getRun(registry, 'missionNumber') ?? 1,
    money:         getRun(registry, 'money') ?? 0,
    survivors:     getRun(registry, 'survivors') ?? [],
    upgrades:      getRun(registry, 'upgrades') ?? {},
    vehicle:       getRun(registry, 'vehicle') ?? 'civilian_car',
    ownedVehicles: getRun(registry, 'ownedVehicles') ?? ['civilian_car'],
    ownedWeapons:  getRun(registry, 'ownedWeapons') ?? ['mg'],
    currentWeapon: getRun(registry, 'currentWeapon') ?? 'mg',
    components:    getRun(registry, 'components') ?? null,
    lastScore:     getRun(registry, 'lastScore') ?? 0,
  };
}

/** Riversa uno snapshot (checkpoint) nel registry — l'inverso di `snapshotRun`. */
export function restoreRun(registry: Phaser.Data.DataManager, run: RunData): void {
  setRun(registry, 'missionNumber', run.missionNumber);
  setRun(registry, 'money',         run.money);
  setRun(registry, 'survivors',     run.survivors);
  setRun(registry, 'upgrades',      run.upgrades);
  setRun(registry, 'vehicle',       run.vehicle);
  setRun(registry, 'ownedVehicles', run.ownedVehicles);
  setRun(registry, 'ownedWeapons',  run.ownedWeapons);
  setRun(registry, 'currentWeapon', run.currentWeapon);
  setRun(registry, 'components',    run.components);
  setRun(registry, 'lastScore',     run.lastScore);
}
