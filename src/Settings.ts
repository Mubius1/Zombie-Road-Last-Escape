/**
 * Impostazioni persistenti del giocatore.
 * Salvate in localStorage così sopravvivono al reload della pagina; in memoria
 * sono una cache statica letta da MenuScene / SettingsScene / GameScene.
 * Qui vivono SOLO preferenze (volume, effetti schermo, lingua) — nessun asset, nessuno stato di partita.
 */

/**
 * Lingue supportate dall'interfaccia. L'italiano è la locale di default e la sorgente
 * di verità dei testi (vedi src/locales/it.ts + docs/I18N.md). Le altre sono fallback su `it`.
 */
export type Lang = 'it' | 'en' | 'es' | 'fr' | 'de' | 'pt';
export const LANGUAGES: Lang[] = ['it', 'en', 'es', 'fr', 'de', 'pt'];
const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGUAGES as string[]).includes(v);

/** Lingua iniziale al primo avvio: prova la lingua del browser, altrimenti italiano. */
function detectLang(): Lang {
  try {
    const tags = [navigator.language, ...(navigator.languages ?? [])];
    for (const tag of tags) {
      const code = tag?.slice(0, 2).toLowerCase();
      if (isLang(code)) return code;
    }
  } catch { /* navigator non disponibile */ }
  return 'it';
}

export interface SettingsData {
  /** Volume master 0..1 — moltiplicatore applicato al SoundManager. */
  volume: number;
  /** Overlay filmico (vignetta + grana + scanline + aberrazione cromatica). */
  screenFx: boolean;
  /** Indice della risoluzione scelta nei preset di Config.RESOLUTIONS (0 = baseline 800×600). */
  resolution: number;
  /** Preferenza schermo intero (l'attivazione effettiva richiede un click — vincolo browser). */
  fullscreen: boolean;
  /** Modalità daltonico-safe: ricolora le barre di stato (HP/componenti) con palette blu/giallo/arancio. */
  colorblind: boolean;
  /** Lingua dei testi dell'interfaccia (vedi i18n.ts). */
  language: Lang;
}

const STORAGE_KEY = 'zombieRoad.settings.v1';
const DEFAULTS: SettingsData = { volume: 1, screenFx: true, resolution: 0, fullscreen: false, colorblind: false, language: 'it' };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function loadSettings(): SettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Primo avvio: nessuna preferenza salvata → parti dalla lingua del browser.
    if (!raw) return { ...DEFAULTS, language: detectLang() };
    const p = JSON.parse(raw) as Partial<SettingsData>;
    return {
      volume:     typeof p.volume === 'number'     ? clamp01(p.volume)         : DEFAULTS.volume,
      screenFx:   typeof p.screenFx === 'boolean'  ? p.screenFx                : DEFAULTS.screenFx,
      resolution: typeof p.resolution === 'number' ? Math.max(0, p.resolution | 0) : DEFAULTS.resolution,
      fullscreen: typeof p.fullscreen === 'boolean' ? p.fullscreen             : DEFAULTS.fullscreen,
      colorblind: typeof p.colorblind === 'boolean' ? p.colorblind             : DEFAULTS.colorblind,
      language:   isLang(p.language)                ? p.language                : detectLang(),
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

  static get resolution(): number { return this.data.resolution; }
  static set resolution(v: number) { this.data.resolution = Math.max(0, v | 0); this.save(); }

  static get fullscreen(): boolean { return this.data.fullscreen; }
  static set fullscreen(v: boolean) { this.data.fullscreen = v; this.save(); }

  static get colorblind(): boolean { return this.data.colorblind; }
  static set colorblind(v: boolean) { this.data.colorblind = v; this.save(); }

  static get language(): Lang { return this.data.language; }
  static set language(v: Lang) { if (isLang(v)) { this.data.language = v; this.save(); } }

  private static save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* storage non disponibile */ }
  }
}
