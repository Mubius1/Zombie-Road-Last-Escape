import type { RunData } from './RunState';

/**
 * Dati di SALVATAGGIO persistenti (localStorage), separati dalle preferenze di `Settings.ts`.
 * Contiene il RECORD (missione più lontana + punteggio più alto) e — da quando il gioco è una
 * CAMPAGNA A CHECKPOINT (non più "roguelike: la morte azzera tutto") — lo SNAPSHOT della corsa in
 * corso (`run`): lo stato all'inizio dell'ultima missione giocata. A differenza del `registry`
 * (in memoria, perso a fine sessione) questo sopravvive tra le sessioni del browser → "CONTINUA"
 * riprende da lì. Il game over NON azzera (si rigioca la missione pagando un pedaggio, vedi
 * `GameScene.endGame`): solo "Nuova Partita" cancella lo snapshot.
 */
export interface SaveDataShape {
  bestMission: number;
  bestScore: number;
  /** Checkpoint della corsa: stato d'inizio missione. null = nessuna corsa salvata. */
  run: RunData | null;
}

const STORAGE_KEY = 'zombieRoad.save.v1';
const DEFAULTS: SaveDataShape = { bestMission: 0, bestScore: 0, run: null };

/** Guard minimale: lo snapshot è dati nostri serializzati, basta verificare la chiave portante. */
function isRun(v: unknown): v is RunData {
  return !!v && typeof v === 'object' && typeof (v as RunData).missionNumber === 'number';
}

function load(): SaveDataShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<SaveDataShape>;
    return {
      bestMission: typeof p.bestMission === 'number' ? Math.max(0, p.bestMission | 0) : DEFAULTS.bestMission,
      bestScore:   typeof p.bestScore   === 'number' ? Math.max(0, p.bestScore   | 0) : DEFAULTS.bestScore,
      run:         isRun(p.run) ? p.run : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export default class SaveData {
  private static data: SaveDataShape = load();

  static get bestMission(): number { return this.data.bestMission; }
  static get bestScore(): number { return this.data.bestScore; }

  /** Registra un risultato di corsa; aggiorna i record se superati. Ritorna true se ne ha battuto uno. */
  static record(mission: number, score: number): boolean {
    let beat = false;
    if (mission > this.data.bestMission) { this.data.bestMission = mission; beat = true; }
    if (score > this.data.bestScore)     { this.data.bestScore   = score;   beat = true; }
    if (beat) this.save();
    return beat;
  }

  // ─── Checkpoint della corsa (campagna a checkpoint) ───────────────────────────
  /** Esiste una corsa salvata da riprendere? */
  static hasRun(): boolean { return this.data.run != null; }
  /** Snapshot della corsa in corso (null se nessuna). */
  static loadRun(): RunData | null { return this.data.run; }
  /** Salva/aggiorna il checkpoint della corsa (chiamato a inizio missione e dopo il pedaggio di morte). */
  static saveRun(run: RunData): void { this.data.run = run; this.save(); }
  /** Cancella il checkpoint: unico vero reset del progresso (Nuova Partita / Debug). */
  static clearRun(): void { if (this.data.run != null) { this.data.run = null; this.save(); } }

  private static save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* storage non disponibile */ }
  }
}
