/**
 * Dati di SALVATAGGIO persistenti (localStorage), separati dalle preferenze di `Settings.ts`.
 * Per ora contiene solo il RECORD della corsa: la missione più lontana raggiunta e il punteggio
 * di missione più alto. A differenza del `registry` (in memoria, azzerato al game over) questo
 * sopravvive tra le sessioni del browser → dà un obiettivo tra una corsa e l'altra (G5).
 */
export interface SaveDataShape {
  bestMission: number;
  bestScore: number;
}

const STORAGE_KEY = 'zombieRoad.save.v1';
const DEFAULTS: SaveDataShape = { bestMission: 0, bestScore: 0 };

function load(): SaveDataShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<SaveDataShape>;
    return {
      bestMission: typeof p.bestMission === 'number' ? Math.max(0, p.bestMission | 0) : DEFAULTS.bestMission,
      bestScore:   typeof p.bestScore   === 'number' ? Math.max(0, p.bestScore   | 0) : DEFAULTS.bestScore,
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

  private static save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* storage non disponibile */ }
  }
}
