/**
 * Impostazioni persistenti del giocatore.
 * Salvate in localStorage così sopravvivono al reload della pagina; in memoria
 * sono una cache statica letta da MenuScene / SettingsScene / GameScene.
 * Qui vivono SOLO preferenze (volume, effetti schermo) — nessun asset, nessuno stato di partita.
 */

export interface SettingsData {
  /** Volume master 0..1 — moltiplicatore applicato al SoundManager. */
  volume: number;
  /** Overlay filmico (vignetta + grana + scanline + aberrazione cromatica). */
  screenFx: boolean;
}

const STORAGE_KEY = 'zombieRoad.settings.v1';
const DEFAULTS: SettingsData = { volume: 1, screenFx: true };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function loadSettings(): SettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<SettingsData>;
    return {
      volume:   typeof p.volume === 'number'    ? clamp01(p.volume) : DEFAULTS.volume,
      screenFx: typeof p.screenFx === 'boolean' ? p.screenFx        : DEFAULTS.screenFx,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export default class Settings {
  private static data: SettingsData = loadSettings();

  static get volume(): number { return this.data.volume; }
  static set volume(v: number) { this.data.volume = clamp01(v); this.save(); }

  static get screenFx(): boolean { return this.data.screenFx; }
  static set screenFx(v: boolean) { this.data.screenFx = v; this.save(); }

  private static save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* storage non disponibile */ }
  }
}
