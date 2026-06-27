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
  /** Effetti schermo filmici, selezionabili singolarmente. Lo shader Film si attacca se almeno uno è
   *  attivo (`Settings.screenFx` computato); il grading/aberrazione di base viaggia con lo shader. */
  vignetteFx: boolean;
  grainFx: boolean;
  scanlineFx: boolean;
  gradingFx: boolean;     // grading filmico (tone-map / contrasto / saturazione / temperatura)
  aberrationFx: boolean;  // aberrazione cromatica radiale (+ kick d'impatto)
  /** Bloom (bagliore additivo sugli elementi luminosi). WebGL. */
  bloom: boolean;
  /** Ombre di contatto a terra (radicamento 2.5D). WebGL. */
  shadows: boolean;
  /** Dettaglio di superficie FBM sull'asfalto (shader). WebGL. */
  asphaltDetail: boolean;
  /** Indice della risoluzione scelta nei preset di Config.RESOLUTIONS (0 = baseline 800×600). */
  resolution: number;
  /** Preferenza schermo intero (l'attivazione effettiva richiede un click — vincolo browser). */
  fullscreen: boolean;
  /** Modalità daltonico-safe: ricolora le barre di stato (HP/componenti) con palette blu/giallo/arancio. */
  colorblind: boolean;
  /** Luminosità globale 0.6..1.4 (1 = nativo): velo scuro (<1) o additivo (>1) top-most in ogni scena. */
  brightness: number;
  /** Lingua dei testi dell'interfaccia (vedi i18n.ts). */
  language: Lang;
  /** Tutorial di onboarding già visto/saltato? false = lo mostra a inizio Missione 1 (vedi docs/TUTORIAL.md).
   *  È una PREFERENZA (non stato di partita) → sopravvive a "Nuova Partita". */
  tutorialSeen: boolean;
  /** Fase R (R2): difficoltà PREFERITA (0=Normale·1=Difficile·2=Incubo) — il default del pick a Nuova Partita.
   *  La difficoltà ATTIVA della corsa vive in `RunData.difficulty` (questa è solo l'ultima scelta ricordata). */
  difficulty: number;
}

const STORAGE_KEY = 'zombieRoad.settings.v1';
const DEFAULTS: SettingsData = { volume: 1, vignetteFx: true, grainFx: true, scanlineFx: true, gradingFx: true, aberrationFx: true, bloom: true, shadows: true, asphaltDetail: true, resolution: 0, fullscreen: false, colorblind: false, language: 'it', brightness: 1, tutorialSeen: false, difficulty: 0 };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampBright = (v: number) => (v < 0.6 ? 0.6 : v > 1.4 ? 1.4 : v);
const clampDiff = (v: number) => (v < 0 ? 0 : v > 2 ? 2 : v | 0);

function loadSettings(): SettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Primo avvio: nessuna preferenza salvata → parti dalla lingua del browser.
    if (!raw) return { ...DEFAULTS, language: detectLang() };
    const p = JSON.parse(raw) as Partial<SettingsData> & { screenFx?: boolean };
    const legacyOn = p.screenFx !== false; // vecchio master unico: assente/true → effetti on; false → off
    return {
      volume:     typeof p.volume === 'number'     ? clamp01(p.volume)         : DEFAULTS.volume,
      vignetteFx: typeof p.vignetteFx === 'boolean' ? p.vignetteFx : legacyOn,
      grainFx:    typeof p.grainFx === 'boolean'    ? p.grainFx    : legacyOn,
      scanlineFx: typeof p.scanlineFx === 'boolean' ? p.scanlineFx : legacyOn,
      gradingFx:    typeof p.gradingFx === 'boolean'    ? p.gradingFx    : legacyOn,
      aberrationFx: typeof p.aberrationFx === 'boolean' ? p.aberrationFx : legacyOn,
      bloom:        typeof p.bloom === 'boolean'         ? p.bloom         : DEFAULTS.bloom,
      shadows:      typeof p.shadows === 'boolean'       ? p.shadows       : DEFAULTS.shadows,
      asphaltDetail: typeof p.asphaltDetail === 'boolean' ? p.asphaltDetail : DEFAULTS.asphaltDetail,
      resolution: typeof p.resolution === 'number' ? Math.max(0, p.resolution | 0) : DEFAULTS.resolution,
      fullscreen: typeof p.fullscreen === 'boolean' ? p.fullscreen             : DEFAULTS.fullscreen,
      colorblind: typeof p.colorblind === 'boolean' ? p.colorblind             : DEFAULTS.colorblind,
      brightness: typeof p.brightness === 'number'  ? clampBright(p.brightness) : DEFAULTS.brightness,
      language:   isLang(p.language)                ? p.language                : detectLang(),
      tutorialSeen: typeof p.tutorialSeen === 'boolean' ? p.tutorialSeen         : DEFAULTS.tutorialSeen,
      difficulty:  typeof p.difficulty === 'number'    ? clampDiff(p.difficulty)  : DEFAULTS.difficulty,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export default class Settings {
  private static data: SettingsData = loadSettings();

  static get volume(): number { return this.data.volume; }
  static set volume(v: number) { this.data.volume = clamp01(v); this.save(); }

  static get vignetteFx(): boolean { return this.data.vignetteFx; }
  static set vignetteFx(v: boolean) { this.data.vignetteFx = v; this.save(); }

  static get grainFx(): boolean { return this.data.grainFx; }
  static set grainFx(v: boolean) { this.data.grainFx = v; this.save(); }

  static get scanlineFx(): boolean { return this.data.scanlineFx; }
  static set scanlineFx(v: boolean) { this.data.scanlineFx = v; this.save(); }

  static get gradingFx(): boolean { return this.data.gradingFx; }
  static set gradingFx(v: boolean) { this.data.gradingFx = v; this.save(); }

  static get aberrationFx(): boolean { return this.data.aberrationFx; }
  static set aberrationFx(v: boolean) { this.data.aberrationFx = v; this.save(); }

  /** Master COMPUTATO: la catena post-fx (Film + bloom) si attacca se almeno un effetto schermo è attivo
   *  → bloom incluso, così resta indipendente dai singoli effetti del FilmPipeline. */
  static get screenFx(): boolean {
    const d = this.data;
    return d.vignetteFx || d.grainFx || d.scanlineFx || d.gradingFx || d.aberrationFx || d.bloom;
  }

  static get bloom(): boolean { return this.data.bloom; }
  static set bloom(v: boolean) { this.data.bloom = v; this.save(); }

  static get shadows(): boolean { return this.data.shadows; }
  static set shadows(v: boolean) { this.data.shadows = v; this.save(); }

  static get asphaltDetail(): boolean { return this.data.asphaltDetail; }
  static set asphaltDetail(v: boolean) { this.data.asphaltDetail = v; this.save(); }

  static get resolution(): number { return this.data.resolution; }
  static set resolution(v: number) { this.data.resolution = Math.max(0, v | 0); this.save(); }

  static get fullscreen(): boolean { return this.data.fullscreen; }
  static set fullscreen(v: boolean) { this.data.fullscreen = v; this.save(); }

  static get colorblind(): boolean { return this.data.colorblind; }
  static set colorblind(v: boolean) { this.data.colorblind = v; this.save(); }

  static get brightness(): number { return this.data.brightness; }
  static set brightness(v: number) { this.data.brightness = clampBright(v); this.save(); }

  static get language(): Lang { return this.data.language; }
  static set language(v: Lang) { if (isLang(v)) { this.data.language = v; this.save(); } }

  static get tutorialSeen(): boolean { return this.data.tutorialSeen; }
  static set tutorialSeen(v: boolean) { this.data.tutorialSeen = v; this.save(); }

  static get difficulty(): number { return this.data.difficulty; }
  static set difficulty(v: number) { this.data.difficulty = clampDiff(v); this.save(); }

  private static save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch { /* storage non disponibile */ }
  }
}
