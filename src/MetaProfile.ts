import type { WeaponType } from './GameData';

/**
 * META-PROFILO persistente (localStorage), SEPARATO dal checkpoint della corsa (`SaveData.run`).
 * È il progresso CROSS-CORSA della campagna "IL CONVOGLIO" (Fase R, docs/CAMPAGNA_CONVOGLIO.md §10):
 * sopravvive a "Nuova Partita", sul modello di `Settings`/`SaveData`.
 *
 * Modello del "continuare" (A): la CORSA resta terminale (P1 "il viaggio finisce"); finire una corsa
 * REGISTRA qui dei FATTI GREZZI (corse, atto raggiunto, finali, archi, difficoltà, salvataggi, monete).
 * Gli SBLOCCHI sono DERIVATI da questi fatti via la tabella `UNLOCKS` (predicati puri) → niente array
 * mutabile da tenere in sync, niente drift. La prossima Nuova Partita riparte da capo ma più ricca.
 *
 * Principio sblocchi: VARIETÀ, non potenza. Il kit di partenza è completo e vincibile; gli sblocchi
 * AGGIUNGONO stili di gioco. Modello a due gate (FTL/Hades): meta-sblocco "esiste nel tuo gioco" +
 * monete in-run "te lo puoi permettere".
 */
export interface MetaProfileShape {
  /** Corse arrivate al rifugio (epilogo raggiunto). */
  runsCompleted: number;
  /** Atto più alto RAGGIUNTO (1..6) su tutte le corse. */
  furthestAct: number;
  /** Finali visti: 'convoy' | 'few' | 'alone' | 'fallen'. */
  endingsSeen: string[];
  /** Chiavi-sopravvissuto di cui hai ingaggiato l'arco (almeno una scelta in RunData.choices). */
  arcsCompleted: string[];
  /** Difficoltà più alta a cui hai FINITO una corsa (0=Normale · 1=Difficile · 2=Incubo). */
  bestDifficulty: number;
  /** Salvataggi su strada cumulativi (gancio sblocco Furgone). */
  lifetimeRescues: number;
  /** Monete guadagnate cumulative (gancio sblocco Saccheggiatore). */
  lifetimeMoney: number;
}

// ── Kit di partenza — sempre disponibile (completo e vincibile). Gli sblocchi AGGIUNGONO varietà. ──
export const START_VEHICLES: readonly string[] = ['civilian_car', 'pickup'];
export const START_WEAPONS: readonly WeaponType[] = ['mg', 'double_mg', 'rifle'];
export const START_SURVIVORS: readonly string[] = ['mechanic', 'medic', 'soldier'];

export type UnlockKind = 'vehicle' | 'weapon' | 'survivor';
export interface UnlockDef {
  /** Chiave del catalogo (VEHICLES / WEAPONS / SURVIVORS). */
  id: string;
  kind: UnlockKind;
  /** Predicato PURO sul profilo: true = sbloccato. */
  test: (p: MetaProfileShape) => boolean;
  /** Chiave i18n del suggerimento "come sbloccarlo" (mostrato finché è bloccato). */
  hintKey: string;
}

/**
 * Tabella sblocchi (fonte di verità della progressione, Fase R3). Soglie documentate in BALANCE §12 /
 * GAME_DESIGN §11. VARIETÀ, non potenza: ciò che si sblocca è uno stile (tank, glass-cannon, area, ecc.),
 * non "la roba forte più tardi". Le soglie sono in taratura (derivate, NON 🔒).
 */
export const UNLOCKS: UnlockDef[] = [
  // Veicoli (nuovi stili di guida)
  { id: 'military_suv',   kind: 'vehicle',  test: p => p.furthestAct >= 2,          hintKey: 'meta.hint.military_suv' },
  { id: 'armored_van',    kind: 'vehicle',  test: p => p.lifetimeRescues >= 3,      hintKey: 'meta.hint.armored_van' },
  { id: 'armored_truck',  kind: 'vehicle',  test: p => p.furthestAct >= 4,          hintKey: 'meta.hint.armored_truck' },
  { id: 'heavy_military', kind: 'vehicle',  test: p => p.runsCompleted >= 1,        hintKey: 'meta.hint.heavy_military' },
  { id: 'experimental',   kind: 'vehicle',  test: p => p.bestDifficulty >= 1,       hintKey: 'meta.hint.experimental' },
  // Armi (nuovi stili di fuoco)
  { id: 'rockets',        kind: 'weapon',   test: p => p.furthestAct >= 3,          hintKey: 'meta.hint.rockets' },
  { id: 'flamethrower',   kind: 'weapon',   test: p => p.arcsCompleted.length >= 1, hintKey: 'meta.hint.flamethrower' },
  // Sopravvissuti (nuovi ruoli di supporto)
  { id: 'explorer',       kind: 'survivor', test: p => p.furthestAct >= 2,          hintKey: 'meta.hint.explorer' },
  { id: 'looter',         kind: 'survivor', test: p => p.lifetimeMoney >= 3000,     hintKey: 'meta.hint.looter' },
  { id: 'sniper',         kind: 'survivor', test: p => p.runsCompleted >= 1,        hintKey: 'meta.hint.sniper' },
  { id: 'demolitionist',  kind: 'survivor', test: p => p.bestDifficulty >= 1,       hintKey: 'meta.hint.demolitionist' },
];

const STORAGE_KEY = 'zombieRoad.meta.v1';
const DEFAULTS: MetaProfileShape = {
  runsCompleted: 0, furthestAct: 1, endingsSeen: [], arcsCompleted: [],
  bestDifficulty: 0, lifetimeRescues: 0, lifetimeMoney: 0,
};

const num = (v: unknown, def: number) => (typeof v === 'number' && isFinite(v) ? v : def);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function load(): MetaProfileShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<MetaProfileShape>;
    return {
      runsCompleted:   Math.max(0, num(p.runsCompleted, 0) | 0),
      furthestAct:     Math.min(6, Math.max(1, num(p.furthestAct, 1) | 0)),
      endingsSeen:     strArr(p.endingsSeen),
      arcsCompleted:   strArr(p.arcsCompleted),
      bestDifficulty:  Math.max(0, num(p.bestDifficulty, 0) | 0),
      lifetimeRescues: Math.max(0, num(p.lifetimeRescues, 0) | 0),
      lifetimeMoney:   Math.max(0, num(p.lifetimeMoney, 0) | 0),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Unione senza duplicati (per accumulare finali/archi visti). */
function union(a: string[], b: string[]): string[] {
  const s = new Set(a); for (const x of b) s.add(x); return [...s];
}

export default class MetaProfile {
  private static data: MetaProfileShape = load();

  /** Profilo corrente in sola lettura. */
  static get profile(): Readonly<MetaProfileShape> { return this.data; }

  // ─── Query sblocchi (derivati: kit di partenza ∪ unlock il cui predicato passa) ──────────────
  static isUnlocked(kind: UnlockKind, id: string): boolean {
    const start: readonly string[] = kind === 'vehicle' ? START_VEHICLES : kind === 'weapon' ? START_WEAPONS : START_SURVIVORS;
    if (start.includes(id)) return true;
    const u = UNLOCKS.find(x => x.kind === kind && x.id === id);
    return u ? u.test(this.data) : false;
  }

  static unlockedVehicles(): string[] {
    return [...START_VEHICLES, ...UNLOCKS.filter(u => u.kind === 'vehicle' && u.test(this.data)).map(u => u.id)];
  }
  static unlockedWeapons(): WeaponType[] {
    return [...START_WEAPONS, ...UNLOCKS.filter(u => u.kind === 'weapon' && u.test(this.data)).map(u => u.id as WeaponType)];
  }
  static unlockedSurvivors(): string[] {
    return [...START_SURVIVORS, ...UNLOCKS.filter(u => u.kind === 'survivor' && u.test(this.data)).map(u => u.id)];
  }

  /** Snapshot dei soli unlock (non kit di partenza) attualmente sbloccati — per il diff "appena sbloccato". */
  private static unlockedIds(): Set<string> {
    return new Set(UNLOCKS.filter(u => u.test(this.data)).map(u => `${u.kind}:${u.id}`));
  }

  // ─── Registrazione progressi (chiamata dai chokepoint di GameScene; mai in debugRun) ─────────
  /** Atto raggiunto su una tratta (aggiorna il massimo). */
  static recordActReached(act: number): void {
    if (act > this.data.furthestAct) { this.data.furthestAct = Math.min(6, act); this.save(); }
  }
  /** Monete guadagnate a fine tratta (cumulativo). */
  static recordMoney(earned: number): void {
    if (earned > 0) { this.data.lifetimeMoney += earned; this.save(); }
  }
  /** Salvataggio su strada riuscito (cumulativo). */
  static recordRescue(): void { this.data.lifetimeRescues += 1; this.save(); }

  /**
   * Corsa arrivata al rifugio (epilogo). Aggiorna tutti i campi e ritorna gli UnlockDef **appena**
   * sbloccati da questa corsa (diff prima/dopo) → la UI mostra "Hai sbloccato …".
   */
  static recordRunComplete(o: { endKey: string; arcs: string[]; difficulty: number }): UnlockDef[] {
    const before = this.unlockedIds();
    this.data.runsCompleted += 1;
    this.data.furthestAct = 6; // arrivare al rifugio = aver raggiunto l'Atto 6
    this.data.endingsSeen = union(this.data.endingsSeen, [o.endKey]);
    this.data.arcsCompleted = union(this.data.arcsCompleted, o.arcs);
    if (o.difficulty > this.data.bestDifficulty) this.data.bestDifficulty = o.difficulty;
    this.save();
    return UNLOCKS.filter(u => u.test(this.data) && !before.has(`${u.kind}:${u.id}`));
  }

  /** Reset del meta-profilo (debug/azzeramento totale) — NON usato da "Nuova Partita". */
  static resetMeta(): void { this.data = { ...DEFAULTS }; this.save(); }

  private static save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* storage non disponibile */ }
  }
}
