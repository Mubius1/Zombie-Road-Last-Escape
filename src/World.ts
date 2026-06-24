/**
 * Dati di DOMINIO del mondo di gioco, in un modulo NEUTRO (nessun import → nessun ciclo).
 *
 * Perché esiste (A4): `BossController` aveva bisogno di `BOSS_CONFIG`/`BOSS_ORDER`/`ROAD_*` che
 * vivevano in `GameScene`, ma `GameScene` importa `BossController` → import circolare a runtime.
 * Spostando qui i DATI condivisi (non la logica), entrambi importano da `World` e il ciclo sparisce.
 *
 * Anti-deriva: `BOSS_CONFIG` è letto dai validatori (`validate-balance.mjs` §6, `validate-art-bible.mjs`
 * §6.7) → mantieni le entry su RIGA SINGOLA, come per VEHICLES/WEAPONS in GameData.ts.
 */

// ── Geometria della strada (spazio di design, alto 600). Limiti verticali di guida e centro corsia. ──
export const ROAD_TOP = 155, ROAD_BOTTOM = 445, ROAD_CENTER = 300;

// ── Tipi di dominio condivisi (usati da GameScene, BossController, HudController). ──
export type ZombieType = 'common' | 'runner' | 'armored' | 'jumper' | 'giant' | 'toxic' | 'charger' | 'spitter';
export type ComponentKey = 'engine' | 'wheels' | 'tank' | 'turret'; // M2: 'armor' rimosso → corazza passiva

// ── Boss di fine regione ──
export type BossType = 'mega_mutant' | 'giant_worm' | 'armored_colossus' | 'radioactive_beast';

export interface BossConfig {
  name: string; hp: number; speed: number; scaleX: number; scaleY: number;
  tint: number; bodyW: number; bodyH: number; reward: number;
}

// Ogni boss ha la propria texture `boss_<tipo>` (vedi buildEntityTextures + Art Bible §6.7).
// scaleX/scaleY adattano la cornice dedicata; bodyW/bodyH sono ricalcolati così che la
// HITBOX effettiva nel mondo (bodyW·scaleX/OVERSAMPLE × bodyH·scaleY/OVERSAMPLE) resti
// IDENTICA al precedente riuso del Gigante → bilanciamento invariato. `tint` non colora più
// lo sprite (palette cotta nella texture): è l'accento emissivo "firma" usato nei VFX (morte).
export const BOSS_CONFIG: Record<BossType, BossConfig> = {
  mega_mutant:       { name: 'boss.mega_mutant.name',       hp: 80,  speed: 55, scaleX: 2.4, scaleY: 2.6, tint: 0xff4030, bodyW: 56,  bodyH: 71, reward: 400 },
  giant_worm:        { name: 'boss.giant_worm.name',        hp: 110, speed: 40, scaleX: 2.0, scaleY: 2.0, tint: 0xff7722, bodyW: 152, bodyH: 34, reward: 500 },
  armored_colossus:  { name: 'boss.armored_colossus.name',  hp: 150, speed: 28, scaleX: 2.5, scaleY: 2.8, tint: 0xffcc22, bodyW: 62,  bodyH: 80, reward: 650 },
  radioactive_beast: { name: 'boss.radioactive_beast.name', hp: 95,  speed: 50, scaleX: 2.2, scaleY: 2.3, tint: 0x7dff4a, bodyW: 59,  bodyH: 66, reward: 450 },
};

export const BOSS_ORDER: BossType[] = ['mega_mutant', 'giant_worm', 'armored_colossus', 'radioactive_beast'];

/**
 * Conversione distanza interna → km MOSTRATI. La distanza di gioco è in "unità di scroll" (px-mondo);
 * il contachilometri la converte in km credibili per un singolo tratto (missione ~180 km) SENZA toccare il
 * gameplay: missione, soglia boss e consumi restano in unità, cambia solo l'ETICHETTA. (0.01 = /100 → 180 km.)
 * L'autonomia "realistica" del pieno (centinaia di km) nasce invece dal consumo lento + carburante che
 * PERSISTE tra le missioni (un pieno copre ~3 missioni). Vedi BALANCE §1 / §3 bis.
 */
export const KM_PER_UNIT = 0.01;
export const distanceKm = (distance: number): number => Math.floor(distance * KM_PER_UNIT);

/**
 * km coperti da 1 punto di carburante a consumo ×1 (crociera) — STIMA di display per la scheda del negozio
 * (autonomia di un pieno = serbatoio · questo / consumo-del-mezzo). Derivato: `SCROLL_SPEED·KM_PER_UNIT /
 * BASE_FUEL_DRAIN` = 240·0.01/0.5. Se cambi uno di quei tre (in GameScene/qui), aggiorna questo numero.
 */
export const KM_PER_FUEL = 4.8;
