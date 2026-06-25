import type { Page } from '@playwright/test';

/**
 * Harness condiviso dei test E2E "giocatore automatico" (docs/TESTING.md §7).
 *
 * Tutto passa dall'hook dev-only `window.__ZR` (= istanza `Phaser.Game`, vedi src/game.ts), esposto
 * SOLO in `npm run dev`. I campi privati TypeScript delle scene sono comunque proprietà pubbliche a
 * runtime: i test li leggono per nome (`gs.health`, …). Se un domani un campo viene rinominato il test
 * diventa rosso — promemoria voluto, non fragilità accidentale.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { __ZR: any }
}

/** Chiave localStorage delle preferenze (vedi src/Settings.ts → STORAGE_KEY). */
const STORAGE_KEY = 'zombieRoad.settings.v1';

/** Numero di preset di risoluzione (= Config.RESOLUTIONS.length). Il w×h reale viene letto dal canvas
 *  a runtime, quindi qui basta il conteggio: nessuna duplicazione dei numeri di Config. */
export const RESOLUTION_COUNT = 8;

// ─── Tipi dello stato letto dal gioco ──────────────────────────────────────────

export interface GameSnapshot {
  health: number; maxHealth: number;
  fuel: number; maxFuel: number;
  score: number; distance: number; combo: number;
  alive: boolean; missionDone: boolean; frozen: boolean;
  /** Il veicolo è sotto controllo del giocatore? (vivo, non congelato da boss, missione non finita) →
   *  solo in questa finestra i controlli di posizione hanno senso (vedi findInvariantViolations). */
  controllable: boolean;
  x: number | null; y: number | null; designW: number;
}

export interface WorldState {
  active: string[];
  money: number; missionNumber: number;
  currentWeapon: string; vehicle: string;
  ownedWeapons: string[]; survivors: string[];
  canvas: { w: number; h: number };
  game: GameSnapshot | null;
}

export interface BootOptions {
  /** Indice del preset di Config.RESOLUTIONS (0 = 800×600). */
  resolution?: number;
  /** Seme del PRNG che rimpiazza Math.random → spawn/FX deterministici e ripetibili. */
  seed?: number;
  /** Salta il tutorial d'onboarding di Missione 1 (default: sì). */
  skipTutorial?: boolean;
  /** Volume master (0 = muto, evita rumore/eccezioni dell'audio in headless). */
  volume?: number;
}

// ─── Boot deterministico ────────────────────────────────────────────────────────

/**
 * Carica il gioco con RNG seedato e Settings preimpostate, e attende che almeno una scena sia attiva.
 * Gli `addInitScript` girano nel contesto pagina PRIMA di qualunque modulo → seme e preferenze sono
 * già in vigore quando `main.ts` avvia Phaser.
 */
export async function bootGame(page: Page, opts: BootOptions = {}): Promise<void> {
  const { resolution = 0, seed = 12345, skipTutorial = true, volume = 0 } = opts;

  // 1) Rimpiazza Math.random con un Mulberry32 seedato: Phaser.Math.Between/Clamp e gli spawn del gioco
  //    usano Math.random sotto il cofano → l'intera run diventa riproducibile a parità di seme.
  await page.addInitScript((s: number) => {
    let a = s >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);

  // 2) Pulisci lo storage (niente checkpoint stantii → ENTER = Nuova Partita) e fissa le preferenze.
  await page.addInitScript((cfg: { key: string; resolution: number; skipTutorial: boolean; volume: number }) => {
    try {
      localStorage.clear();
      localStorage.setItem(cfg.key, JSON.stringify({
        resolution: cfg.resolution, tutorialSeen: cfg.skipTutorial, volume: cfg.volume,
      }));
    } catch { /* storage non disponibile */ }
  }, { key: STORAGE_KEY, resolution, skipTutorial, volume });

  await page.goto('/');
  await page.waitForFunction(() => {
    const g = window.__ZR;
    return !!g && !!g.scene && g.scene.getScenes(true).length > 0;
  }, undefined, { timeout: 30_000 });
}

/** Attende che la scena `key` sia tra quelle attive. */
export async function waitForSceneActive(page: Page, key: string, timeout = 20_000): Promise<void> {
  await page.waitForFunction((k) => {
    const g = window.__ZR;
    return !!g && g.scene.getScenes(true).some((s: { scene: { key: string } }) => s.scene.key === k);
  }, key, { timeout });
}

/** Dal menu, avvia una missione (ENTER = Nuova Partita) e attende che GameScene sia viva e con veicolo. */
export async function startMission(page: Page): Promise<void> {
  await waitForSceneActive(page, 'MenuScene');
  await page.keyboard.press('Enter');
  await waitForSceneActive(page, 'GameScene');
  await page.waitForFunction(() => {
    const gs = window.__ZR.scene.getScene('GameScene');
    return !!gs && gs.scene.isActive() && gs.vehicle && Number.isFinite(gs.vehicle.x);
  }, undefined, { timeout: 20_000 });
  await page.waitForTimeout(300); // un paio di frame di assestamento (create → primo update)
}

/**
 * Preme SPAZIO a intervalli finché una scena diversa da GameScene diventa attiva (o scade il timeout).
 * Sulle schermate di esito (fine missione / game over) l'handler di conferma `once('keydown-SPACE')`
 * si registra solo DOPO l'animazione dell'overlay: un singolo tasto può arrivare troppo presto.
 */
export async function pollUntilSceneLeavesGame(page: Page, timeout = 15_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await page.keyboard.down('Space');
    await page.waitForTimeout(120);
    await page.keyboard.up('Space');
    const left = await page.evaluate(() =>
      window.__ZR.scene.getScenes(true).some((s: { scene: { key: string } }) => s.scene.key !== 'GameScene'));
    if (left) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

// ─── Lettura dello stato ─────────────────────────────────────────────────────────

/** Istantanea dello stato di gioco + registry (campi privati letti per nome a runtime). */
export async function readState(page: Page): Promise<WorldState> {
  // Resilienza: se la pagina si stesse ricaricando (`__ZR` non ancora ricostruito) aspetta che torni.
  await page.waitForFunction(() => !!window.__ZR && !!window.__ZR.scene, undefined, { timeout: 10_000 });
  return await page.evaluate(() => {
    const g = window.__ZR;
    const active = g.scene.getScenes(true).map((s: { scene: { key: string } }) => s.scene.key);
    const reg = g.registry;
    const gs = g.scene.getScene('GameScene');
    const inGame = !!gs && gs.scene.isActive();
    const v = gs && gs.vehicle;
    return {
      active,
      money: reg.get('money'),
      missionNumber: reg.get('missionNumber'),
      currentWeapon: reg.get('currentWeapon'),
      vehicle: reg.get('vehicle'),
      ownedWeapons: reg.get('ownedWeapons'),
      survivors: reg.get('survivors'),
      canvas: { w: g.scale.width, h: g.scale.height },
      game: inGame ? {
        health: gs.health, maxHealth: gs.maxHealth,
        fuel: gs.fuel, maxFuel: gs.maxFuel,
        score: gs.score, distance: gs.distance, combo: gs.combo,
        alive: gs.alive, missionDone: gs.missionDone, frozen: !!gs.frozen,
        controllable: gs.alive && !gs.frozen && !gs.missionDone,
        x: v ? v.x : null, y: v ? v.y : null,
        designW: g.scale.width / (g.scale.height / 600),
      } : null,
    } as WorldState;
  });
}

// ─── Invarianti di stato ─────────────────────────────────────────────────────────

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Verifica le invarianti che NON devono mai rompersi durante il gioco. Ritorna la lista (vuota = ok)
 * dei messaggi di violazione. È l'oracolo del bot del Livello 2: lo si campiona ogni pochi frame.
 */
export function findInvariantViolations(s: WorldState): string[] {
  const v: string[] = [];

  // `money` non impostato è lecito SOLO al menu prima di una run; dentro una partita deve essere un numero.
  if (s.money === undefined) {
    if (s.game) v.push('money non impostato durante la run');
  } else if (!finite(s.money)) v.push(`money non finito: ${String(s.money)}`);
  else if (s.money < 0) v.push(`money negativo: ${s.money}`);

  const g = s.game;
  if (!g) return v; // fuori partita: niente invarianti di gameplay da controllare

  for (const [name, n] of [
    ['health', g.health], ['fuel', g.fuel], ['score', g.score],
    ['distance', g.distance], ['combo', g.combo], ['vehicle.x', g.x], ['vehicle.y', g.y],
  ] as const) {
    if (!finite(n)) v.push(`${name} non finito: ${String(n)}`);
  }

  if (finite(g.health) && (g.health < 0 || g.health > g.maxHealth + 0.5))
    v.push(`health fuori range: ${g.health}/${g.maxHealth}`);
  if (finite(g.fuel) && (g.fuel < -0.5 || g.fuel > g.maxFuel + 0.5))
    v.push(`fuel fuori range: ${g.fuel}/${g.maxFuel}`);
  if (finite(g.score) && g.score < 0) v.push(`score negativo: ${g.score}`);
  if (finite(g.distance) && g.distance < 0) v.push(`distance negativa: ${g.distance}`);
  if (finite(g.combo) && g.combo < 0) v.push(`combo negativa: ${g.combo}`);

  // Posizione del veicolo entro un margine generoso del mondo (spazio design 0..designW × 0..600):
  // se finisce molto fuori è un bug di fisica/clamp. Solo MENTRE è controllabile: quando il veicolo
  // esce dal controllo (morte/boss/fine missione) la sua velocità residua non viene azzerata e lo sprite
  // può derivare fuori campo (bug noto, cosmetico) — non è un'invariante di gameplay vivo.
  if (g.controllable) {
    if (finite(g.y) && (g.y! < -80 || g.y! > 680)) v.push(`vehicle.y fuori dal mondo: ${g.y}`);
    if (finite(g.x) && (g.x! < -120 || g.x! > g.designW + 120)) v.push(`vehicle.x fuori dal mondo: ${g.x}`);
  }

  return v;
}

// ─── Bounds dell'interfaccia (posizionamento multi-risoluzione) ───────────────────

export interface UiBoundsResult {
  checked: number;
  violations: Array<{
    scene: string; label: string; space: 'design' | 'screen';
    rect: { x: number; y: number; w: number; h: number };
    viewport: { w: number; h: number };
  }>;
}

/**
 * Per ogni scena attiva controlla che ogni elemento INTERATTIVO (cliccabile → deve essere visibile)
 * stia dentro la viewport. Gli elementi a `scrollFactor 0` (overlay HUD fissi) sono in pixel-schermo;
 * gli altri in spazio design (0..designW × 0..600). Cattura "pulsante fuori schermo / non cliccabile",
 * il bug di posizionamento che conta — senza toccare l'estetica (quella resta occhio umano).
 */
export async function collectUiBounds(page: Page): Promise<UiBoundsResult> {
  return await page.evaluate(() => {
    const g = window.__ZR;
    const TOL = 1.5;
    const out: {
      checked: number;
      violations: Array<{
        scene: string; label: string; space: 'design' | 'screen';
        rect: { x: number; y: number; w: number; h: number };
        viewport: { w: number; h: number };
      }>;
    } = { checked: 0, violations: [] };

    // Rettangolo-mondo di un oggetto interattivo. I pulsanti del gioco sono RoundRect → l'oggetto
    // cliccabile è un Graphics, e Graphics.getBounds() ritorna 0×0: usiamo la HIT-AREA dell'input
    // (un Rectangle in coordinate locali, centrato sull'origine del Graphics) sommata alla posizione
    // mondo. Fallback a getBounds() per sprite/testi interattivi con dimensione propria.
    const rectFor = (obj: {
      x: number; y: number;
      input?: { hitArea?: { x: number; y: number; width: number; height: number } };
      getBounds?: () => { x: number; y: number; width: number; height: number };
    }) => {
      const ha = obj.input?.hitArea;
      if (ha && ha.width > 0 && ha.height > 0) {
        return { x: obj.x + ha.x, y: obj.y + ha.y, width: ha.width, height: ha.height };
      }
      const b = obj.getBounds?.();
      return b && b.width > 0 && b.height > 0 ? b : null;
    };

    for (const scene of g.scene.getScenes(true)) {
      const sw = scene.scale.width as number, sh = scene.scale.height as number;
      const designW = sw / (sh / 600), designH = 600;
      const list = scene.children?.list ?? [];
      for (const obj of list) {
        if (!obj || !obj.input || !obj.input.enabled) continue;     // solo cliccabili
        if (obj.visible === false || obj.alpha === 0) continue;
        const r = rectFor(obj);
        if (!r) continue;
        const b = { x: r.x, y: r.y, width: r.width, height: r.height, right: r.x + r.width, bottom: r.y + r.height };
        const sf0 = obj.scrollFactorX === 0 && obj.scrollFactorY === 0;
        const vw = sf0 ? sw : designW, vh = sf0 ? sh : designH;
        out.checked++;
        if (b.x < -TOL || b.y < -TOL || b.right > vw + TOL || b.bottom > vh + TOL) {
          const label = (typeof obj.text === 'string' && obj.text)
            ? String(obj.text).slice(0, 40)
            : (obj.name || obj.type || 'obj');
          out.violations.push({
            scene: scene.scene.key, label, space: sf0 ? 'screen' : 'design',
            rect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
            viewport: { w: Math.round(vw), h: Math.round(vh) },
          });
        }
      }
    }
    return out;
  });
}

// ─── Cattura errori della pagina ─────────────────────────────────────────────────

/** Messaggi benigni da ignorare: policy autoplay audio in headless, favicon mancante. NON copre gli
 *  errori WebGL/shader o le eccezioni non gestite — quelli sono bug reali e devono far fallire il test. */
const BENIGN: RegExp[] = [
  /AudioContext/i,
  /autoplay/i,
  /The play\(\) request/i,
  /favicon/i,
  /Failed to load resource.*favicon/i,
];

/** Aggancia `pageerror` (eccezioni non gestite) e `console.error`, filtrando il rumore benigno.
 *  Ritorna l'array (vivo) degli errori: a fine test si asserisce che sia vuoto. */
export function captureErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (BENIGN.some((re) => re.test(text))) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/** Bounding box del canvas del gioco (per gli eventi mouse del monkey, Livello 1). */
export async function canvasBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator('#game-container canvas').boundingBox();
  if (!box) throw new Error('canvas del gioco non trovato');
  return box;
}
