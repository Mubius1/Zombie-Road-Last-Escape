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

// ════════════════════════════════════════════════════════════════════════════
// CAMPAGNA "IL CONVOGLIO" — manifest finito a senso unico (docs/CAMPAGNA_CONVOGLIO.md)
// ════════════════════════════════════════════════════════════════════════════
// Sostituisce il loop infinito mod-7 con un ARCO FINITO: un array ordinato di descrittori-tratta
// indicizzato da `legIndex` (0..CAMPAIGN_LENGTH-1), raggruppato in 6 ATTI verso il RIFUGIO (tratta
// `terminal`). La varietà nasce dalle COMBINAZIONI dei 10 assi del descrittore, non da mappe bespoke.
// Doc-first: i moltiplicatori sono numeri di campagna documentati in BALANCE §11 (NON 🔒 riga-per-riga,
// scelta §9.6 — contenuto in taratura continua). Entry su RIGA SINGOLA, sul modello di BOSS_CONFIG.
//
// Stato di cablaggio: F1 usa biome/stopKind/terminal/act; gli assi numerici (length/spawn/burst/fuel/
// ammo/hazard/poolBias) sono DATI presenti ma letti dalla fase F2; `setPiece` dalla fase F4.

export type EnvKey = 'city' | 'highway' | 'desert' | 'forest' | 'industrial' | 'military' | 'finalCity';
export type StopKey = 'garage' | 'depot' | 'camp' | 'checkpoint' | 'market';
/** Evento di set-piece forzato sulla tratta-climax (F4): scavalca il random a EVENT_FRACTIONS. */
export type SetPieceKey = 'none' | 'night' | 'roadblock' | 'storm' | 'convoy' | 'rescue';

/** Ordine dei biomi = ordine di ENVIRONMENTS in GameScene.ts (region.<key>). NON riordinare senza allineare là. */
export const ENV_KEYS: EnvKey[] = ['city', 'highway', 'desert', 'forest', 'industrial', 'military', 'finalCity'];

export interface StageDescriptor {
  act: number;            // 1..6 — l'atto a cui appartiene la tratta
  biome: EnvKey;          // palette/atmosfera = ENVIRONMENTS[envIndexForBiome(biome)] (solo colore)
  lengthMult: number;     // ×MISSION_DIST percepito (0.6..1.5) — NON tocca la costante 🔒 (F2)
  spawnMult: number;      // ×intervalli director (0.6 assedio .. 1.5 quiete) (F2)
  burstMult: number;      // ×durata/densità ondata (0.8..1.6) (F2)
  fuelDrainMult: number;  // ×consumo carburante (1.0..1.6) — leva This War of Mine (F2)
  ammoCrateMult: number;  // ×frequenza casse munizioni (0.5 scarso .. 1.5 abbondante) (F2)
  hazardMult: number;     // ×frequenza hazard di corsia (0.4..2.0) (F2)
  poolBias: Partial<Record<ZombieType, number>>; // moltiplicatori sul peso base di SPAWN_POOL (F2)
  setPiece: SetPieceKey;  // evento forzato della tratta-climax (F4); 'none' = random come oggi
  stopKind: StopKey;      // tipo di sosta a valle (dal descrittore, non da STOP_CYCLE)
  terminal?: boolean;     // true sulla tratta-finale (il rifugio): completarla chiude la campagna
}

// 31 leg-base (legIndex 0..30). I 2 punti di biforcazione (leg 11, 22) ricevono le varianti `altOf` in F3.
export const STAGE_MANIFEST: StageDescriptor[] = [
  // ── Atto 1 · LA FUGA (city→highway) · MASSA · scarsità bassa ──
  { act: 1, biome: 'city',       lengthMult: 1.0, spawnMult: 1.3,  burstMult: 0.9, fuelDrainMult: 1.0,  ammoCrateMult: 1.4, hazardMult: 0.8, poolBias: { common: 1.4, runner: 1.2 },                         setPiece: 'none',      stopKind: 'garage' },
  { act: 1, biome: 'city',       lengthMult: 1.0, spawnMult: 1.2,  burstMult: 1.0, fuelDrainMult: 1.0,  ammoCrateMult: 1.3, hazardMult: 0.9, poolBias: { common: 1.3, runner: 1.2 },                         setPiece: 'none',      stopKind: 'depot' },
  { act: 1, biome: 'highway',    lengthMult: 1.1, spawnMult: 1.1,  burstMult: 1.0, fuelDrainMult: 1.05, ammoCrateMult: 1.2, hazardMult: 1.0, poolBias: { common: 1.2, runner: 1.3 },                         setPiece: 'none',      stopKind: 'market' },
  { act: 1, biome: 'city',       lengthMult: 1.0, spawnMult: 1.0,  burstMult: 1.1, fuelDrainMult: 1.0,  ammoCrateMult: 1.2, hazardMult: 1.0, poolBias: { common: 1.2, runner: 1.2, charger: 1.1 },           setPiece: 'none',      stopKind: 'camp' },
  { act: 1, biome: 'highway',    lengthMult: 1.1, spawnMult: 0.95, burstMult: 1.2, fuelDrainMult: 1.05, ammoCrateMult: 1.1, hazardMult: 1.2, poolBias: { common: 1.1, runner: 1.3, charger: 1.1 },           setPiece: 'none',      stopKind: 'garage' },
  { act: 1, biome: 'highway',    lengthMult: 0.9, spawnMult: 0.9,  burstMult: 1.3, fuelDrainMult: 1.1,  ammoCrateMult: 1.0, hazardMult: 1.6, poolBias: { common: 1.0, runner: 1.3, charger: 1.2 },           setPiece: 'roadblock', stopKind: 'garage' }, // climax: PONTE CHE CROLLA
  // ── Atto 2 · LA STRADA LUNGA (highway→desert) · LOGORAMENTO · carburante ──
  { act: 2, biome: 'highway',    lengthMult: 1.3, spawnMult: 1.0,  burstMult: 0.9, fuelDrainMult: 1.3,  ammoCrateMult: 0.9, hazardMult: 1.0, poolBias: { toxic: 1.3, spitter: 1.2 },                         setPiece: 'none',      stopKind: 'depot' },
  { act: 2, biome: 'desert',     lengthMult: 1.4, spawnMult: 1.0,  burstMult: 0.9, fuelDrainMult: 1.4,  ammoCrateMult: 0.8, hazardMult: 1.0, poolBias: { toxic: 1.4, spitter: 1.3, charger: 1.1 },           setPiece: 'none',      stopKind: 'market' },
  { act: 2, biome: 'desert',     lengthMult: 1.5, spawnMult: 1.4,  burstMult: 0.9, fuelDrainMult: 1.5,  ammoCrateMult: 0.7, hazardMult: 1.0, poolBias: { toxic: 1.3, spitter: 1.2, charger: 1.2 },           setPiece: 'none',      stopKind: 'depot' },
  { act: 2, biome: 'desert',     lengthMult: 1.3, spawnMult: 1.1,  burstMult: 1.0, fuelDrainMult: 1.4,  ammoCrateMult: 0.8, hazardMult: 1.1, poolBias: { toxic: 1.2, charger: 1.3 },                         setPiece: 'none',      stopKind: 'camp' },
  { act: 2, biome: 'desert',     lengthMult: 1.4, spawnMult: 1.0,  burstMult: 1.1, fuelDrainMult: 1.5,  ammoCrateMult: 0.7, hazardMult: 1.1, poolBias: { toxic: 1.3, spitter: 1.3 },                         setPiece: 'none',      stopKind: 'depot' },
  { act: 2, biome: 'desert',     lengthMult: 1.2, spawnMult: 1.0,  burstMult: 1.2, fuelDrainMult: 1.6,  ammoCrateMult: 0.5, hazardMult: 1.2, poolBias: { toxic: 1.2, charger: 1.3 },                         setPiece: 'storm',     stopKind: 'market' }, // climax: TEMPESTA DI SABBIA (bivio in F3)
  // ── Atto 3 · IL BOSCO MORTO (forest→industrial) · AGGUATO NEL BUIO ──
  { act: 3, biome: 'forest',     lengthMult: 1.0, spawnMult: 0.9,  burstMult: 1.3, fuelDrainMult: 1.2,  ammoCrateMult: 0.9, hazardMult: 1.0, poolBias: { runner: 1.5, jumper: 1.4 },                         setPiece: 'none',      stopKind: 'camp' },
  { act: 3, biome: 'forest',     lengthMult: 1.0, spawnMult: 0.85, burstMult: 1.4, fuelDrainMult: 1.2,  ammoCrateMult: 0.9, hazardMult: 1.0, poolBias: { runner: 1.5, jumper: 1.5 },                         setPiece: 'none',      stopKind: 'checkpoint' },
  { act: 3, biome: 'forest',     lengthMult: 1.0, spawnMult: 0.9,  burstMult: 1.4, fuelDrainMult: 1.2,  ammoCrateMult: 0.8, hazardMult: 1.0, poolBias: { runner: 1.4, jumper: 1.5, toxic: 1.1 },             setPiece: 'night',     stopKind: 'camp' },
  { act: 3, biome: 'industrial', lengthMult: 1.0, spawnMult: 0.85, burstMult: 1.4, fuelDrainMult: 1.2,  ammoCrateMult: 0.8, hazardMult: 1.3, poolBias: { runner: 1.3, jumper: 1.3, armored: 1.1 },          setPiece: 'none',      stopKind: 'depot' },
  { act: 3, biome: 'forest',     lengthMult: 1.0, spawnMult: 0.8,  burstMult: 1.5, fuelDrainMult: 1.2,  ammoCrateMult: 0.8, hazardMult: 1.1, poolBias: { runner: 1.5, jumper: 1.6 },                         setPiece: 'none',      stopKind: 'camp' },
  { act: 3, biome: 'forest',     lengthMult: 1.0, spawnMult: 0.8,  burstMult: 1.5, fuelDrainMult: 1.2,  ammoCrateMult: 0.8, hazardMult: 1.0, poolBias: { runner: 1.4, jumper: 1.5 },                         setPiece: 'night',     stopKind: 'camp' }, // climax: TUNNEL A FARI SPENTI
  // ── Atto 4 · LA CINTURA INDUSTRIALE (industrial→military) · PRESSIONE COSTANTE · muri ──
  { act: 4, biome: 'industrial', lengthMult: 1.0, spawnMult: 0.8,  burstMult: 1.3, fuelDrainMult: 1.2,  ammoCrateMult: 0.7, hazardMult: 1.5, poolBias: { armored: 1.4, charger: 1.3 },                       setPiece: 'none',      stopKind: 'checkpoint' },
  { act: 4, biome: 'industrial', lengthMult: 1.0, spawnMult: 0.75, burstMult: 1.4, fuelDrainMult: 1.25, ammoCrateMult: 0.7, hazardMult: 1.6, poolBias: { armored: 1.5, charger: 1.3 },                       setPiece: 'none',      stopKind: 'depot' },
  { act: 4, biome: 'military',   lengthMult: 1.0, spawnMult: 0.75, burstMult: 1.4, fuelDrainMult: 1.25, ammoCrateMult: 0.6, hazardMult: 1.5, poolBias: { armored: 1.4, charger: 1.4 },                       setPiece: 'none',      stopKind: 'checkpoint' },
  { act: 4, biome: 'industrial', lengthMult: 1.0, spawnMult: 0.7,  burstMult: 1.4, fuelDrainMult: 1.3,  ammoCrateMult: 0.6, hazardMult: 1.8, poolBias: { armored: 1.5, charger: 1.3 },                       setPiece: 'none',      stopKind: 'market' },
  { act: 4, biome: 'military',   lengthMult: 1.0, spawnMult: 0.75, burstMult: 1.4, fuelDrainMult: 1.25, ammoCrateMult: 0.6, hazardMult: 1.6, poolBias: { armored: 1.4, charger: 1.4 },                       setPiece: 'none',      stopKind: 'checkpoint' }, // bivio in F3
  { act: 4, biome: 'industrial', lengthMult: 1.0, spawnMult: 0.7,  burstMult: 1.4, fuelDrainMult: 1.3,  ammoCrateMult: 0.6, hazardMult: 2.0, poolBias: { armored: 1.5, charger: 1.4 },                       setPiece: 'storm',     stopKind: 'checkpoint' }, // climax: DIGA CHE CEDE
  // ── Atto 5 · L'ULTIMA CITTÀ (finalCity) · TUTTO INSIEME ──
  { act: 5, biome: 'finalCity',  lengthMult: 1.0, spawnMult: 0.7,  burstMult: 1.5, fuelDrainMult: 1.3,  ammoCrateMult: 0.6, hazardMult: 1.6, poolBias: { common: 1.1, runner: 1.2, armored: 1.2, charger: 1.2 }, setPiece: 'none',   stopKind: 'market' },
  { act: 5, biome: 'finalCity',  lengthMult: 1.0, spawnMult: 0.65, burstMult: 1.5, fuelDrainMult: 1.35, ammoCrateMult: 0.5, hazardMult: 1.7, poolBias: { runner: 1.3, armored: 1.3, charger: 1.2 },          setPiece: 'none',      stopKind: 'checkpoint' },
  { act: 5, biome: 'finalCity',  lengthMult: 1.0, spawnMult: 0.65, burstMult: 1.6, fuelDrainMult: 1.35, ammoCrateMult: 0.5, hazardMult: 1.7, poolBias: { common: 1.2, armored: 1.3, jumper: 1.2 },          setPiece: 'none',      stopKind: 'market' },
  { act: 5, biome: 'finalCity',  lengthMult: 1.0, spawnMult: 0.6,  burstMult: 1.6, fuelDrainMult: 1.4,  ammoCrateMult: 0.5, hazardMult: 1.8, poolBias: { runner: 1.3, armored: 1.3, charger: 1.3 },          setPiece: 'none',      stopKind: 'checkpoint' },
  { act: 5, biome: 'finalCity',  lengthMult: 1.0, spawnMult: 0.6,  burstMult: 1.6, fuelDrainMult: 1.4,  ammoCrateMult: 0.5, hazardMult: 1.8, poolBias: { common: 1.2, armored: 1.3, spitter: 1.2 },         setPiece: 'none',      stopKind: 'market' },
  { act: 5, biome: 'finalCity',  lengthMult: 1.1, spawnMult: 0.6,  burstMult: 1.6, fuelDrainMult: 1.4,  ammoCrateMult: 0.5, hazardMult: 1.8, poolBias: { common: 1.2, runner: 1.3, armored: 1.3, charger: 1.3 }, setPiece: 'roadblock', stopKind: 'market' }, // climax: CITTÀ SOTTO ASSEDIO
  // ── Atto 6 · IL RIFUGIO (finalCity) · tratta terminale ──
  { act: 6, biome: 'finalCity',  lengthMult: 0.6, spawnMult: 0.6,  burstMult: 1.6, fuelDrainMult: 1.0,  ammoCrateMult: 0.5, hazardMult: 1.0, poolBias: { common: 1.2, runner: 1.3, armored: 1.2, charger: 1.2 }, setPiece: 'roadblock', stopKind: 'garage', terminal: true }, // VARCO AL RIFUGIO → epilogo
];

/** Numero di tratte della campagna (leg-base; le varianti di biforcazione F3 non si sommano qui). */
export const CAMPAIGN_LENGTH = STAGE_MANIFEST.length;

/** Descrittore della tratta `legIndex`, clampato agli estremi (fallback difensivo). */
export function stageAt(legIndex: number): StageDescriptor {
  const i = Math.max(0, Math.min(legIndex, STAGE_MANIFEST.length - 1));
  return STAGE_MANIFEST[i]!;
}

/** Indice in ENVIRONMENTS (GameScene) per il bioma di una tratta. */
export function envIndexForBiome(biome: EnvKey): number {
  const i = ENV_KEYS.indexOf(biome);
  return i < 0 ? 0 : i;
}

/** La tratta `legIndex` è il rifugio terminale? (completarla → epilogo, non missione N+1). */
export function isTerminalLeg(legIndex: number): boolean {
  return STAGE_MANIFEST[legIndex]?.terminal === true;
}

/** Chiavi i18n dei nomi dei 6 atti (index = act − 1), per i banner di transizione. */
export const ACT_NAME_KEYS: string[] = [
  'campaign.act1.name', 'campaign.act2.name', 'campaign.act3.name',
  'campaign.act4.name', 'campaign.act5.name', 'campaign.act6.name',
];

// ── Biforcazioni locali (F3) ─────────────────────────────────────────────────
// 2 soli punti dichiarati (leg 11, 22): a ognuno il giocatore sceglie in RouteScene tra il ramo BASE
// (`STAGE_MANIFEST[leg]`, "strada lunga e sicura") e il ramo ALT qui sotto ("scorciatoia rischiosa").
// I rami hanno la STESSA lunghezza-in-leg (convergono al leg successivo) e lo stesso `act` → legIndex
// resta lineare (+1); la scelta vive in `RunData.branchTaken` e cambia solo il DESCRITTORE della tratta.
export const BRANCHES: Record<number, StageDescriptor> = {
  11: { act: 2, biome: 'desert',     lengthMult: 0.8, spawnMult: 0.9,  burstMult: 1.3, fuelDrainMult: 1.7, ammoCrateMult: 0.4, hazardMult: 1.3, poolBias: { toxic: 1.2, charger: 1.4, spitter: 1.2 }, setPiece: 'storm',     stopKind: 'depot' },  // scorciatoia deserto: corta ma assetata
  22: { act: 4, biome: 'industrial', lengthMult: 0.9, spawnMult: 0.65, burstMult: 1.5, fuelDrainMult: 1.3, ammoCrateMult: 0.5, hazardMult: 1.9, poolBias: { armored: 1.5, charger: 1.4, common: 1.2 }, setPiece: 'roadblock', stopKind: 'market' }, // città assediata: loot ricco, mortale
};

/** La tratta `legIndex` è un punto di biforcazione (offre 2 rami in RouteScene)? */
export function isBranchLeg(legIndex: number): boolean {
  return Object.prototype.hasOwnProperty.call(BRANCHES, legIndex);
}

/**
 * Descrittore EFFETTIVO della tratta per la corsa: se è un bivio e il giocatore ha scelto il ramo 'alt'
 * (`branchTaken[leg]==='alt'`) usa il descrittore alternativo (BRANCHES), altrimenti il ramo base del
 * manifest. Usato in GameScene.create al posto di `stageAt` per leggere la tratta corrente.
 */
export function stageForRun(legIndex: number, branchTaken: Record<string, string>): StageDescriptor {
  const alt = BRANCHES[legIndex];
  if (alt && branchTaken[String(legIndex)] === 'alt') return alt;
  return stageAt(legIndex);
}

// ── Odometro di campagna (F3) ────────────────────────────────────────────────
// km diegetici per tratta = MISSION_DIST·KM_PER_UNIT·lengthMult = 180·lengthMult (vedi BALANCE §11).
// km-tratta base = MISSION_DIST(6000)·KM_PER_UNIT(0.01) = 60. ⚠️ Aggiorna se cambi MISSION_DIST in GameScene.
const LEG_KM: number[] = STAGE_MANIFEST.map(d => Math.round(60 * d.lengthMult));
/** Totale km della campagna (META dell'odometro). Somma dei km-tratta del manifest base (~6000). */
export const CAMPAIGN_TOTAL_KM = LEG_KM.reduce((s, k) => s + k, 0);
/** km percorsi all'inizio della tratta `legIndex` (somma delle tratte precedenti). */
export function odometerKm(legIndex: number): number {
  let km = 0;
  for (let i = 0; i < legIndex && i < LEG_KM.length; i++) km += LEG_KM[i]!;
  return km;
}
