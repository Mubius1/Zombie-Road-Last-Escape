import Phaser from 'phaser';
import Settings from './Settings';
import AsphaltPipeline, { asphaltParams } from './pipelines/AsphaltPipeline';

/**
 * Sistema "Ambiente & Strada" — la strada come secondo personaggio.
 * Codifica docs/ART_BIBLE_AMBIENTE.md: strati di profondità (parallasse),
 * superficie (asfalto tileato + ciglio) e memoria (decal dinamici), più
 * l'illuminazione del mondo (gradiente cielo, luce di carreggiata, fari).
 *
 * Tutto 100% procedurale (Graphics → generateTexture/TileSprite), bake-once,
 * fire-and-forget, a 60 fps. Niente PNG, niente per-frame redraw. La superficie dell'asfalto
 * riceve un dettaglio FBM in shader (AsphaltPipeline) che scorre col manto — solo GLSL inline,
 * nessun asset esterno.
 */

export interface RoadGeom {
  W: number; H: number;
  roadTop: number; roadBottom: number; roadCenter: number;
  scrollSpeed: number;
}

/** Sottoinsieme di EnvConfig che serve all'ambiente (passabile direttamente). */
export interface EnvVisual {
  name: string;
  bgColor: number; skyColor: number; groundColor: number;
  roadColor: number; lineColor: number; shoulderColor: number;
  crackColor?: number; patchColor?: number; emissive?: number; hazeColor?: number;
}

type DecalType = 'blood' | 'scorch' | 'skid' | 'debris';
type TexGraphics = Phaser.GameObjects.Graphics & { generateTexture(k: string, w: number, h: number): void };

// Larghezza-base delle texture parallasse (i pattern hanno periodo che la divide → tiling senza giunta)
const PW = 480;
const DECAL_CAP = 24;       // decal vivi max a schermo
const BLOOD_THROTTLE = 110; // ms minimi tra due pozze di sangue
// Skyline distante del layer FAR: i volumi verticali sono "messi in piedi" (M2) con lean + tetto.
const FAR_SHEAR = 0.18; // inclinazione condivisa dei volumi distanti
const FAR_TOP = 0.20;   // profondità del top-face (accenno di tetto)

export default class Environment {
  private scene: Phaser.Scene;
  private g: RoadGeom;
  private env: EnvVisual;
  private idx: number;

  // palette risolta (default derivati via mix)
  private crackColor: number;
  private patchColor: number;
  private emissive: number;
  private hazeColor: number;

  // strati scorrevoli
  private asphalt!: Phaser.GameObjects.TileSprite;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private headlight!: Phaser.GameObjects.Image;

  // memoria della strada
  private decals: Phaser.GameObjects.Image[] = [];
  private lastBlood = 0;

  constructor(scene: Phaser.Scene, geom: RoadGeom, env: EnvVisual, envIndex: number) {
    this.scene = scene;
    this.g = geom;
    this.env = env;
    this.idx = envIndex;

    this.crackColor = env.crackColor ?? Environment.mix(env.roadColor, 0x000000, 0.40);
    this.patchColor = env.patchColor ?? Environment.mix(env.roadColor, env.groundColor, 0.5);
    this.emissive   = env.emissive   ?? env.lineColor;
    this.hazeColor  = env.hazeColor  ?? Environment.mix(env.skyColor, env.groundColor, 0.5);

    this.buildAsphaltTexture();
    this.buildParallaxTextures();
    this.buildDecalTextures();
    this.buildHeadlightTexture();
    this.buildObjects();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  static mix(color: number, target: number, t: number): number {
    const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    const tr = (target >> 16) & 0xff, tg = (target >> 8) & 0xff, tb = target & 0xff;
    return (Math.round(r + (tr - r) * t) << 16) | (Math.round(g + (tg - g) * t) << 8) | Math.round(b + (tb - b) * t);
  }
  private gfx(): TexGraphics {
    return this.scene.make.graphics({ add: false } as any) as TexGraphics;
  }
  private has(key: string) { return this.scene.textures.exists(key); }

  // ─── §4 Superficie: asfalto tileato + ciglio (rumble) ───────────────────────
  private buildAsphaltTexture() {
    const key = `env_asphalt_${this.idx}`;
    if (this.has(key)) return;
    const AW = 256, AH = this.g.roadBottom - this.g.roadTop;
    const road = this.env.roadColor;
    const g = this.gfx();

    // base
    g.fillStyle(road); g.fillRect(0, 0, AW, AH);

    // grana tonale (mottling) — l'antidoto al colore piatto
    for (let i = 0; i < 150; i++) {
      const light = Math.random() < 0.5;
      g.fillStyle(light ? Environment.mix(road, 0xffffff, 0.06) : Environment.mix(road, 0x000000, 0.18), 0.5);
      const r = 2 + Math.random() * 4;
      g.fillEllipse(2 + Math.random() * (AW - 6), 16 + Math.random() * (AH - 32), r * 2, r);
    }
    // macchie d'olio / umido
    for (let i = 0; i < 3; i++) {
      g.fillStyle(Environment.mix(road, 0x000000, 0.45), 0.5);
      g.fillEllipse(30 + Math.random() * (AW - 60), 40 + Math.random() * (AH - 80), 28 + Math.random() * 40, 14 + Math.random() * 20);
    }
    // rappezzi (toppe di catrame)
    for (let i = 0; i < 2; i++) {
      const pw = 46 + Math.random() * 34, ph = 28 + Math.random() * 30;
      const px = 16 + Math.random() * (AW - pw - 24), py = 24 + Math.random() * (AH - ph - 50);
      g.fillStyle(this.patchColor, 0.9); g.fillRect(px, py, pw, ph);
      g.lineStyle(2, Environment.mix(this.patchColor, 0x000000, 0.4), 0.8); g.strokeRect(px, py, pw, ph);
    }
    // crepe (polilinee spezzate, con ramo)
    g.lineStyle(1, this.crackColor, 0.85);
    for (let i = 0; i < 7; i++) {
      let x = 10 + Math.random() * (AW - 20), y = 18 + Math.random() * (AH - 36);
      const segs = 3 + Math.floor(Math.random() * 3);
      for (let s = 0; s < segs; s++) {
        const nx = Phaser.Math.Clamp(x + (Math.random() * 40 - 20), 8, AW - 8);
        const ny = Phaser.Math.Clamp(y + (Math.random() * 30 - 15), 16, AH - 16);
        g.lineBetween(x, y, nx, ny);
        if (s === 1 && Math.random() < 0.6) g.lineBetween(x, y, x + (Math.random() * 24 - 12), y + (Math.random() * 20 - 10));
        x = nx; y = ny;
      }
    }

    // ciglio: linea di bordo viva + rumble strip + ghiaia (cotti → scorrono con l'asfalto)
    this.bakeRumble(g, AW, 0, +1);        // bordo alto
    this.bakeRumble(g, AW, AH, -1);       // bordo basso

    g.generateTexture(key, AW, AH);
    g.destroy();
  }

  /** Disegna il ciglio a 3 fasce su un bordo (dir +1 = dall'alto verso il basso). */
  private bakeRumble(g: TexGraphics, AW: number, edgeY: number, dir: number) {
    const line = this.env.lineColor, road = this.env.roadColor;
    // linea di bordo viva (consumata)
    g.fillStyle(line, 0.85); g.fillRect(0, edgeY + dir * 0 - (dir < 0 ? 2 : 0), AW, 2);
    // rumble: trattini chiaro/scuro alternati (periodo 16 → tile)
    const ry = dir > 0 ? edgeY + 3 : edgeY - 8;
    for (let x = 0; x < AW; x += 16) {
      g.fillStyle(Environment.mix(line, 0x000000, 0.25), 0.75); g.fillRect(x, ry, 8, 5);
      g.fillStyle(Environment.mix(road, 0x000000, 0.45), 0.9);  g.fillRect(x + 8, ry, 8, 5);
    }
    // ghiaia (mottling fine)
    const gy = dir > 0 ? edgeY + 9 : edgeY - 14;
    for (let i = 0; i < 46; i++) {
      g.fillStyle(Math.random() < 0.5 ? Environment.mix(road, 0xffffff, 0.08) : Environment.mix(road, 0x000000, 0.35), 0.6);
      g.fillRect(Math.random() * AW, gy + Math.random() * 5, 2, 2);
    }
  }

  // ─── §5 Profondità: layer parallasse far (skyline) + near (terreno) ─────────
  private buildParallaxTextures() {
    const farKey = `env_far_${this.idx}`, nearKey = `env_near_${this.idx}`;
    const FH = this.g.roadTop, NH = this.g.H - this.g.roadBottom;
    // Bordi = TERRENO PIATTO visto a piombo (stesso disegno sopra e sotto la strada → simmetrico/contiguo).
    if (!this.has(farKey))  { const g = this.gfx(); this.drawGroundBand(g, FH, false); this.drawFarObjects(g, FH); g.generateTexture(farKey, PW, FH);  g.destroy(); } // far: strada in basso
    if (!this.has(nearKey)) { const g = this.gfx(); this.drawGroundBand(g, NH, true);  this.drawNearObjects(g, NH); g.generateTexture(nearKey, PW, NH); g.destroy(); } // near: strada in alto
  }

  // ─── Oggetti narrativi a terra (top-down): l'esodo fallito, la violenza, la natura ──────────
  /** Rim-light alto-sinistra (DoD art bible §6): bordo alto+sinistro schiarito → l'oggetto stacca come
   *  volume invece di macchia piatta. */
  private rimTL(g: TexGraphics, x: number, y: number, w: number, h: number, color: number, amt = 0.3) {
    g.fillStyle(Environment.mix(color, 0xffffff, amt), 0.6); g.fillRect(x, y, w, 1.5); g.fillRect(x, y, 1.5, h);
  }

  /** Relitto d'auto visto a piombo (l'eroe narrativo). alongRoad=lungo la strada; variant 0 sbiadita ·
   *  1 arrugginita · 2 bruciata · 3 ribaltata; embers=brace emissive (eroe ad alto contrasto). */
  private carWreck(g: TexGraphics, cx: number, cy: number, alongRoad: boolean, variant: number, paint: number, scale = 1, embers = false) {
    // seed per-auto (da posizione) → ogni relitto è danneggiato in modo diverso
    const rr = (k: number) => { const s = Math.sin((cx * 0.7 + cy * 1.3 + k * 2.1) * 12.9898) * 4375.547; return s - Math.floor(s); };
    const L = Math.round(82 * scale), W = Math.round(36 * scale); // ~scala del veicolo del giocatore (100×44)
    const len = alongRoad ? L : W, wid = alongRoad ? W : L;
    const x = cx - len / 2, y = cy - wid / 2;
    const rect = (fx: number, fy: number, fw: number, fh: number) => g.fillRect(x + len * fx, y + wid * fy, len * fw, wid * fh);
    const at = (fx: number, fy: number) => [x + len * fx, y + wid * fy] as [number, number];
    const burned = variant === 2, rust = variant === 1, over = variant === 3;
    const interior = 0x0a0a0c;

    g.fillStyle(0x000000, 0.34); g.fillEllipse(cx + 3, cy + 5, len + 16, wid + 12); // ombra + olio/scorch

    if (over) { // RIBALTATA: pancia in su, accartocciata, ruote mancanti
      g.fillStyle(0x161310); g.fillRoundedRect(x, y, len, wid, 4);
      g.fillStyle(0x0c0a08); for (let k = 0; k < 5; k++) g.fillEllipse(x + len * (0.15 + rr(k) * 0.7), y + wid * (0.2 + rr(k + 9) * 0.6), len * 0.13, wid * 0.15); // accartocciamenti
      g.fillStyle(0x2a2620); rect(0.2, 0.05, 0.03, 0.9); rect(0.66, 0.05, 0.03, 0.9); // assali nudi
      g.fillStyle(0x070707); const wr = Math.max(3, wid * 0.15);
      [0.2, 0.66].forEach(fx => { if (rr(fx * 10) > 0.35) g.fillCircle(x + len * fx, y + wr + 1, wr); if (rr(fx * 10 + 1) > 0.35) g.fillCircle(x + len * fx, y + wid - wr - 1, wr); });
      return;
    }

    const body = burned ? 0x221c16 : rust ? 0x5a3a20 : Environment.mix(paint, 0x000000, 0.18); // grime/desaturazione
    const roof = burned ? 0x100c0a : Environment.mix(body, 0xffffff, 0.09);
    const dent = Environment.mix(body, burned ? 0x0a0806 : 0x000000, 0.5);

    g.fillStyle(body); g.fillRoundedRect(x, y, len, wid, 4); // scocca
    this.rimTL(g, x, y, len, wid, body, burned ? 0.1 : 0.32); // rim-light alto-sinistra (volume)
    const crush = rr(1) > 0.5 ? 0 : 0.84;                    // estremità accartocciata (muso o coda)
    g.fillStyle(dent); rect(crush, 0.06, 0.16, 0.88);
    const [t1x, t1y] = at(crush ? 1 : 0, 0), [t2x, t2y] = at(crush ? 0.84 : 0.16, 0.5), [t3x, t3y] = at(crush ? 1 : 0, 1);
    g.fillTriangle(t1x, t1y, t2x, t2y, t3x, t3y);            // angolo piegato

    for (let k = 0; k < 11; k++) { // chiazze di ruggine/fuliggine/vernice scrostata → "vissuto"
      g.fillStyle(burned ? 0x0a0806 : rust ? 0x7a4a1a : Environment.mix(body, rr(k) > 0.5 ? 0x6a4420 : 0x000000, 0.55), 0.55);
      g.fillEllipse(x + len * (0.05 + rr(k) * 0.9), y + wid * (0.12 + rr(k + 20) * 0.76), 3 + rr(k + 30) * 5, 2 + rr(k + 40) * 4);
    }

    g.fillStyle(roof); rect(0.30, 0.16, 0.40, 0.68); // tetto/cabina
    g.fillStyle(dent, 0.55); for (let k = 0; k < 3; k++) g.fillEllipse(x + len * (0.34 + rr(k + 5) * 0.32), y + wid * (0.32 + rr(k + 6) * 0.36), 4, 3); // ammaccature

    // VETRI SFONDATI: buchi scuri (vetro mancante) + crepe — non vetro pulito
    const smash = (fx: number, fw: number) => { g.fillStyle(interior); rect(fx, 0.18, fw, 0.64); g.lineStyle(1, burned ? 0x100c0a : 0x6a7a8a, 0.45); const [gx, gy] = at(fx + fw / 2, 0.5); for (let c = 0; c < 3; c++) g.lineBetween(gx, gy, gx + (rr(c + fx * 9) - 0.5) * len * 0.1, gy + (rr(c + fx * 9 + 1) - 0.5) * wid * 0.5); };
    smash(0.24, 0.055); smash(0.70, 0.055);
    g.fillStyle(interior); if (rr(2) > 0.4) rect(0.40, 0.05, 0.18, 0.07); if (rr(3) > 0.4) rect(0.40, 0.88, 0.18, 0.07); // finestrini laterali rotti

    if (rr(4) > 0.5 && !burned) { // PORTIERA aperta/penzolante (alcune)
      const top = rr(5) > 0.5; g.fillStyle(Environment.mix(body, 0x000000, 0.2));
      g.fillRect(x + len * 0.42, top ? y - wid * 0.22 : y + wid, len * 0.22, wid * 0.22);
      g.fillStyle(interior); rect(0.42, top ? 0.0 : 0.80, 0.22, 0.20);
    }

    g.fillStyle(0x000000, 0.7); for (let k = 0; k < 7; k++) if (rr(k + 50) > 0.55) { const [bx, by] = at(0.12 + rr(k + 51) * 0.76, 0.15 + rr(k + 52) * 0.7); g.fillCircle(bx, by, 1.3); } // fori di proiettile

    // RUOTE: alcune sgonfie / mancanti (mozzo nudo)
    const a = Math.max(4, Math.round(len * 0.11)), b = Math.max(3, Math.round(wid * 0.20));
    ([[0.15, 0], [0.85, 0], [0.15, 1], [0.85, 1]] as Array<[number, number]>).forEach(([fx, fy], i) => {
      const [wx, wy] = at(fx, fy);
      if (rr(i + 60) > 0.78) { g.fillStyle(0x2a2a2a); g.fillCircle(wx, wy, 2.2); return; } // ruota mancante
      const flat = rr(i + 70) > 0.6; g.fillStyle(0x0a0a0a);
      g.fillRect(wx - a / 2, wy - (fy ? (flat ? b * 0.5 : b) : 0), a, flat ? Math.max(2, b * 0.5) : b);
    });

    if (burned) { // fuliggine pesante + scorch a terra + cenere
      g.fillStyle(0x000000, 0.45); g.fillRoundedRect(x, y, len, wid, 4);
      g.fillStyle(0x000000, 0.22); g.fillEllipse(cx, cy, len + 26, wid + 20);
      g.fillStyle(0x3a3632, 0.5); for (let k = 0; k < 6; k++) g.fillRect(cx + (rr(k + 100) - 0.5) * len * 1.1, cy + (rr(k + 110) - 0.5) * wid * 1.1, 2, 2);
    }

    g.fillStyle(0x8a9aa2, 0.5); for (let k = 0; k < 8; k++) { const ang = rr(k + 120) * 6.28, d = len * 0.5 + rr(k + 130) * 8; g.fillRect(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.55, 1.5, 1.5); } // schegge di vetro
    if (rr(6) > 0.5) { g.fillStyle(dent); const [dx, dy] = at(crush ? 1.04 : -0.1, 0.5); g.fillRect(dx, dy - 2, len * 0.1, 4); } // paraurti staccato
    if (embers) { g.fillStyle(this.emissive, 0.12); g.fillEllipse(cx, cy, len * 0.85, wid * 0.85); g.fillStyle(this.emissive, 0.9); for (let k = 0; k < 6; k++) { const [ex, ey] = at(0.18 + rr(k + 200) * 0.64, 0.18 + rr(k + 210) * 0.64); g.fillCircle(ex, ey, 1.3); } } // brace emissive (eroe)
  }

  private barrel(g: TexGraphics, x: number, y: number, color: number) {
    g.fillStyle(0x000000, 0.3); g.fillEllipse(x + 1, y + 2, 13, 12);
    g.fillStyle(color); g.fillCircle(x, y, 6);
    g.lineStyle(1, Environment.mix(color, 0x000000, 0.4), 0.85); g.strokeCircle(x, y, 6);
    g.fillStyle(Environment.mix(color, 0xffffff, 0.25), 0.6); g.fillEllipse(x - 1.5, y - 1.5, 4, 4);
    g.lineStyle(1.5, Environment.mix(color, 0xffffff, 0.34), 0.7); g.beginPath(); g.arc(x, y, 6, Math.PI * 0.85, Math.PI * 1.55); g.strokePath(); // rim alto-sinistra
  }

  private sandbags(g: TexGraphics, x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) { const c = i % 2 ? 0x6a6244 : 0x7a7050; g.fillStyle(0x000000, 0.25); g.fillEllipse(x + i * 11 + 1, y + 6, 14, 8); g.fillStyle(c); g.fillRoundedRect(x + i * 11, y, 13, 9, 3); this.rimTL(g, x + i * 11, y, 13, 9, c, 0.22); }
  }

  private crate(g: TexGraphics, x: number, y: number, color: number) {
    g.fillStyle(0x000000, 0.25); g.fillRect(x + 1, y + 2, 16, 13);
    g.fillStyle(color); g.fillRect(x, y, 16, 13);
    g.lineStyle(1, Environment.mix(color, 0x000000, 0.45), 0.85); g.strokeRect(x, y, 16, 13); g.lineBetween(x, y, x + 16, y + 13); g.lineBetween(x + 16, y, x, y + 13);
    this.rimTL(g, x, y, 16, 13, color, 0.3);
  }

  /** Resti ai bordi (sobrio: silhouette scura). */
  private remains(g: TexGraphics, x: number, y: number) {
    g.fillStyle(0x14100c, 0.85); g.fillEllipse(x, y, 12, 6); g.fillCircle(x + 5, y - 2, 2.5);
    g.fillStyle(0x2a241c, 0.7); g.fillRect(x - 6, y, 4, 2); g.fillRect(x - 5, y + 2, 4, 2);
  }

  private luggage(g: TexGraphics, x: number, y: number) {
    g.fillStyle(0x000000, 0.25); g.fillRect(x + 1, y + 2, 9, 7);
    g.fillStyle(0x5a3a22); g.fillRect(x, y, 9, 7); g.lineStyle(1, 0x2a1a0e, 0.8); g.strokeRect(x, y, 9, 7); g.lineBetween(x, y + 3, x + 9, y + 3);
    g.fillStyle(0x7a6a8a, 0.7); g.fillEllipse(x - 4, y + 5, 6, 3); g.fillStyle(0x8a4a4a, 0.7); g.fillEllipse(x + 12, y + 2, 5, 3);
  }

  /** Barriera New Jersey / transenna (bassa). glow>=0 = strisce riflettenti/luminose. */
  private barrier(g: TexGraphics, x: number, y: number, w: number, glow: number) {
    g.fillStyle(0x000000, 0.25); g.fillRect(x + 1, y + 2, w, 7);
    g.fillStyle(0x6a6a64); g.fillRect(x, y, w, 7); g.fillStyle(0x4a4a44); g.fillRect(x, y + 5, w, 2);
    this.rimTL(g, x, y, w, 7, 0x6a6a64, 0.24);
    if (glow >= 0) { g.fillStyle(glow, 0.85); for (let i = 2; i < w; i += 12) g.fillRect(x + i, y + 1, 6, 2); }
  }

  /** Oggetti a terra del layer NEAR (foreground, contiguo): relitti d'auto (eroe) + scenario per ambiente. */
  private drawNearObjects(g: TexGraphics, H: number) {
    const rnd = (n: number) => { const s = Math.sin(n * 27.31 + this.idx * 41.7 + 9.1) * 24634.6345; return s - Math.floor(s); };
    const em = this.emissive;
    const oy = (n: number) => Math.round(H * 0.2 + rnd(n) * H * 0.7); // confina alla fascia leggibile (fuori dall'AO)
    const car = (n: number, along: boolean, variant: number, paint: number, scale = 1, embers = false) =>
      this.wrapX(rnd(n) * PW, xx => this.carWreck(g, xx, oy(n + 100), along, variant, paint, scale, embers));
    switch (this.idx) {
      case 0: // Città Distrutta — ciglio INTASATO di relitti, barricate, resti, bagagli
        for (let i = 0; i < 7; i++) car(i + 1, i % 2 === 0, i % 4, [0x5a3a3a, 0x3a4a5a, 0x4a4438, 0x5a4a2a][i % 4]);
        car(80, true, 2, 0x444444, 1, true); // EROE: relitto bruciato con brace emissive
        for (let n = 0; n < 5; n++) this.wrapX(rnd(n + 20) * PW, xx => this.barrier(g, xx, oy(n + 25), 34, -1));
        for (let n = 0; n < 6; n++) this.wrapX(rnd(n + 30) * PW, xx => this.remains(g, xx, oy(n + 35)));
        for (let n = 0; n < 4; n++) this.wrapX(rnd(n + 45) * PW, xx => this.luggage(g, xx, oy(n + 48)));
        break;
      case 1: // Autostrada — INGORGO FOSSILE (riferimento densità) + camion tappo + valigie + coni
        for (let n = 0; n < 6; n++) car(n + 1, true, n % 4, [0x6a3a3a, 0x3a5a6a, 0x6a6a5a, 0x4a4a4a, 0x7a5a3a][n % 5]);
        car(40, false, 3, 0x3a3a3a, 1.5); car(85, true, 2, 0x5a3a2a, 1, true); // tappo + eroe bruciato
        for (let n = 0; n < 6; n++) this.wrapX(rnd(n + 50) * PW, xx => this.luggage(g, xx, oy(n + 55)));
        g.fillStyle(0xc05a1a, 0.9); for (let n = 0; n < 7; n++) this.wrapX(rnd(n + 70) * PW, xx => { const y = oy(n + 75); g.fillTriangle(xx, y - 4, xx - 3, y + 3, xx + 3, y + 3); }); // coni
        break;
      case 2: // Deserto — carcasse sabbiate (più dense), gomme, ossa
        for (let i = 0; i < 5; i++) car(i + 1, i % 2 === 0, i % 2 === 0 ? 1 : 2, [0x7a6a4a, 0x6a5a3a, 0x5a4a36][i % 3]);
        g.fillStyle(0x161616, 0.85); for (let n = 0; n < 10; n++) this.wrapX(rnd(n + 20) * PW, xx => { const y = oy(n + 25); g.fillStyle(0x161616, 0.85); g.fillCircle(xx, y, 4); g.fillStyle(this.env.groundColor); g.fillCircle(xx, y, 2); }); // gomme
        g.fillStyle(0xcac0a8, 0.85); for (let n = 0; n < 12; n++) this.wrapX(rnd(n + 40) * PW, xx => { const y = oy(n + 45); g.fillRect(xx, y, 6, 2); g.fillCircle(xx, y + 1, 2); }); // ossa
        break;
      case 3: // Foresta — relitti inghiottiti dal verde (più) + cartelli muschiati
        for (let i = 0; i < 4; i++) car(i + 1, i % 2 === 0, i % 2 === 0 ? 1 : 0, [0x3a4a3a, 0x4a4a3a][i % 2]);
        g.fillStyle(0x2a5a22, 0.55); for (let n = 0; n < 44; n++) this.wrapX(rnd(n + 20) * PW, xx => g.fillEllipse(xx, oy(n + 25), 7, 5)); // verde che ricopre
        for (let n = 0; n < 3; n++) this.wrapX(rnd(n + 60) * PW, xx => { const y = oy(n + 65); g.fillStyle(0x4a4438); g.fillRect(xx, y, 12, 10); this.rimTL(g, xx, y, 12, 10, 0x4a4438, 0.25); g.fillStyle(0x3a6a2a, 0.7); g.fillEllipse(xx + 6, y + 5, 12, 8); }); // cartelli muschiati
        break;
      case 4: // Zona Industriale — container, bidoni tossici (eroe emissivo), tubi
        g.lineStyle(3, 0x3a3a40, 0.8); for (let n = 0; n < 4; n++) { const y = oy(n + 40); g.lineBetween(0, y, PW, y); } // tubi
        for (let n = 0; n < 4; n++) this.wrapX(rnd(n + 20) * PW, xx => { const y = oy(n + 25), c = n % 2 ? 0x6a3a2a : 0x2a4a5a; g.fillStyle(0x000000, 0.25); g.fillRect(xx + 1, y + 2, 40, 16); g.fillStyle(c); g.fillRect(xx, y, 40, 16); g.lineStyle(1, 0x141414, 0.7); g.strokeRect(xx, y, 40, 16); for (let r = 1; r < 5; r++) g.lineBetween(xx + r * 8, y, xx + r * 8, y + 16); this.rimTL(g, xx, y, 40, 16, c, 0.28); }); // container
        for (let n = 0; n < 10; n++) this.wrapX(rnd(n + 1) * PW, xx => this.barrel(g, xx, oy(n + 10), n % 3 === 0 ? 0x5a8a1a : 0x6a4a1a)); // bidoni
        this.wrapX(rnd(60) * PW, xx => { const y = oy(65); g.fillStyle(em, 0.16); g.fillCircle(xx, y, 13); this.barrel(g, xx, y, em); }); // EROE: bidone tossico che perde
        break;
      case 5: // Base Militare — blindati distrutti (più), sacchi, casse, filo spinato
        for (let i = 0; i < 4; i++) car(i + 1, i % 2 === 0, i % 2 === 0 ? 2 : 0, [0x3a4a2a, 0x4a5a3a][i % 2]);
        car(80, false, 2, 0x2a3a1a, 1, true); // EROE: blindato in fiamme
        for (let n = 0; n < 5; n++) this.wrapX(rnd(n + 20) * PW, xx => this.sandbags(g, xx, oy(n + 25), 4));
        for (let n = 0; n < 6; n++) this.wrapX(rnd(n + 40) * PW, xx => this.crate(g, xx, oy(n + 45), 0x5a5226));
        for (let n = 0; n < 3; n++) { const y = oy(n + 60); g.lineStyle(1, 0x6a6a6a, 0.7); g.lineBetween(0, y, PW, y); g.fillStyle(0x8a8a8a, 0.8); for (let x = 0; x < PW; x += 16) g.fillRect(x, y - 2, 2, 4); } // filo spinato
        break;
      default: // Città Finale — relitti (toni neon) + barricate luminose
        for (let i = 0; i < 7; i++) car(i + 1, i % 2 === 0, i % 3, [0x222a3a, 0x2a2236, 0x3a2a3a, 0x1a2230][i % 4]);
        car(90, false, 2, 0x2a2030, 1, true); // EROE: relitto con brace al neon
        for (let n = 0; n < 6; n++) this.wrapX(rnd(n + 30) * PW, xx => this.barrier(g, xx, oy(n + 35), 30, em)); // barricate luminose
        break;
    }
  }

  /** Volume distante "in piedi" (M2): ombra a contatto + corpo con lean condiviso + faccia dx in ombra
   *  + top-face chiaro. Ritorna lo shear e la quota del tetto per i dettagli (finestre). */
  private drawFarBox(g: TexGraphics, x: number, baseY: number, w: number, h: number, color: number, FH: number) {
    const shx = (xx: number, yy: number) => xx + FAR_SHEAR * (FH - yy);
    const topY = baseY - h;
    g.fillStyle(0x000000, 0.3); g.fillEllipse(x + w / 2 + w * 0.35, baseY, w * 1.1, Math.max(3, h * 0.13));
    g.fillStyle(color); g.fillPoints([{ x: shx(x, baseY), y: baseY }, { x: shx(x + w, baseY), y: baseY }, { x: shx(x + w, topY), y: topY }, { x: shx(x, topY), y: topY }], true);
    g.fillStyle(Environment.mix(color, 0x000000, 0.28), 0.5); g.fillPoints([{ x: shx(x + w * 0.78, baseY), y: baseY }, { x: shx(x + w, baseY), y: baseY }, { x: shx(x + w, topY), y: topY }, { x: shx(x + w * 0.78, topY), y: topY }], true);
    const td = h * FAR_TOP; g.fillStyle(Environment.mix(color, 0xffffff, 0.14));
    g.fillPoints([{ x: shx(x, topY), y: topY }, { x: shx(x + w, topY), y: topY }, { x: shx(x + w + td * 0.5, topY - td), y: topY - td }, { x: shx(x + td * 0.5, topY - td), y: topY - td }], true);
    return { shx, topY };
  }

  /** Skyline DISTANTE del layer FAR (oggetti verticali, ancorati col metodo M2). Sta nella metà alta
   *  della fascia (lontano); sotto continua il terreno fino alla strada. Velato dalla foschia in cima. */
  private drawFarObjects(g: TexGraphics, FH: number) {
    const rnd = (n: number) => { const s = Math.sin(n * 19.7 + this.idx * 53.3 + 3.7) * 12987.21; return s - Math.floor(s); };
    const hy = Math.round(FH * 0.6); // linea d'orizzonte su cui appoggiano i volumi distanti
    const em = this.emissive;
    const tall = (n: number, w: number, hMin: number, hVar: number, color: number) =>
      this.wrapX(rnd(n) * PW, xx => this.drawFarBox(g, xx, hy, w, hMin + rnd(n + 5) * hVar, color, FH));
    switch (this.idx) {
      case 0: // Città Distrutta — palazzi sventrati + gru + fumo
        for (let n = 0; n < 6; n++) this.wrapX(rnd(n + 1) * PW, xx => { const w = 28 + rnd(n) * 24, h = 22 + rnd(n + 5) * (hy - 16); const r = this.drawFarBox(g, xx, hy, w, h, 0x24242c, FH);
          g.fillStyle(0x0a0a12); for (let wy = hy - h + 6; wy < hy - 4; wy += 9) for (let wx = xx + 4; wx < xx + w - 4; wx += 8) if (rnd((wx + wy * 3) | 0) > 0.4) g.fillRect(r.shx(wx, wy), wy, 4, 5);
          g.fillStyle(0x000000, 0.55); g.fillRect(r.shx(xx + w * 0.3, hy - h * 0.65), hy - h * 0.65, w * 0.35, h * 0.22); }); // squarcio
        this.wrapX(rnd(20) * PW, xx => { const r = this.drawFarBox(g, xx, hy, 5, hy - 6, 0x3a3026, FH); g.fillStyle(0x3a3026); g.fillRect(r.shx(xx - 16, r.topY), r.topY, 38, 4); }); // gru
        g.fillStyle(0x6a6a6a, 0.1); for (let n = 0; n < 5; n++) this.wrapX(rnd(n + 30) * PW, xx => g.fillEllipse(xx, rnd(n + 35) * hy * 0.5, 50, 28)); // fumo
        break;
      case 1: // Autostrada — pali alti + cartelloni + guardrail
        for (let n = 0; n < 4; n++) tall(n, 3, 28, hy - 18, 0x2a2820);
        for (let n = 0; n < 3; n++) this.wrapX(rnd(n + 10) * PW, xx => { const bh = 16 + rnd(n + 12) * 12; this.drawFarBox(g, xx, hy - 22, 34, bh, 0x3a3a44, FH); g.fillStyle(rnd(n) > 0.5 ? 0x6a5a3a : 0x4a4a5a, 0.75); g.fillRect(xx + 3, hy - 22 - bh + 3, 28, bh - 6); g.fillStyle(0x2a2820); g.fillRect(xx + 15, hy - 22, 4, 22); }); // cartellone su palo
        g.fillStyle(0x3a3830); g.fillRect(0, hy - 4, PW, 4); for (let x = 0; x < PW; x += 40) g.fillRect(x, hy - 10, 3, 8); // guardrail
        break;
      case 2: // Deserto — stazione di servizio + relitti distanti
        this.wrapX(rnd(0) * PW, xx => { this.drawFarBox(g, xx, hy, 58, 24, 0x4a4236, FH); this.drawFarBox(g, xx + 22, hy - 28, 8, 28, 0x3a3a40, FH); g.fillStyle(0xc05a2a, 0.85); g.fillRect(xx + 16, hy - 56, 20, 9); });
        for (let n = 0; n < 3; n++) this.wrapX(rnd(n + 10) * PW, xx => this.drawFarBox(g, xx, hy, 18, 9 + rnd(n) * 7, 0x5a4a36, FH));
        break;
      case 3: // Foresta — alberi fitti + tralicci
        for (let n = 0; n < 14; n++) this.wrapX(rnd(n + 1) * PW, xx => { const h = 28 + rnd(n) * (hy - 14); g.fillStyle(0x000000, 0.22); g.fillEllipse(xx + 3, hy, 20, 7); for (let dy = 0; dy < h; dy++) { const w = Math.round((dy / h) * 11); g.fillStyle(Environment.mix(0x0e2e0c, 0x000000, (1 - dy / h) * 0.25)); g.fillRect(xx - w + FAR_SHEAR * dy, hy - h + dy, w * 2, 2); } }); // pini fitti
        for (let n = 0; n < 2; n++) this.wrapX(rnd(n + 20) * PW, xx => this.drawFarBox(g, xx, hy, 4, hy - 8, 0x2a2a2e, FH)); // tralicci
        break;
      case 4: // Zona Industriale — fabbrica + ciminiere fumanti + serbatoi
        this.wrapX(rnd(0) * PW, xx => this.drawFarBox(g, xx, hy, 88, 20, 0x26241e, FH));
        for (let n = 0; n < 4; n++) this.wrapX(rnd(n + 5) * PW, xx => { const h = 34 + rnd(n) * (hy - 20); this.drawFarBox(g, xx, hy, 12, h, 0x322c26, FH); g.fillStyle(0x6a6a6a, 0.12); g.fillEllipse(xx + 4 + FAR_SHEAR * h, hy - h - 8, 22, 14); }); // ciminiere + fumo
        for (let n = 0; n < 2; n++) this.wrapX(rnd(n + 20) * PW, xx => { this.drawFarBox(g, xx, hy, 28, 20, 0x3a4248, FH); g.fillStyle(0x2a3236); g.fillEllipse(xx + 14 + FAR_SHEAR * 20, hy - 20, 28, 7); }); // serbatoi
        break;
      case 5: // Base Militare — torrette + antenne + recinzione
        for (let n = 0; n < 3; n++) this.wrapX(rnd(n) * PW, xx => { const h = 38 + rnd(n) * (hy - 22); const r = this.drawFarBox(g, xx, hy, 9, h, 0x2a341e, FH); g.fillStyle(0x1e2614); g.fillRect(r.shx(xx - 4, r.topY), r.topY - 4, 18, 7); });
        for (let n = 0; n < 2; n++) tall(n + 10, 2, hy - 10, 6, 0x4a4a4a);
        g.fillStyle(0x2a3820); g.fillRect(0, hy - 5, PW, 3); for (let x = 0; x < PW; x += 14) g.fillRect(x, hy - 12, 2, 9);
        break;
      default: // Città Finale — grattacieli al neon + ponte
        for (let n = 0; n < 6; n++) this.wrapX(rnd(n + 1) * PW, xx => { const w = 24 + rnd(n) * 22, h = 34 + rnd(n + 5) * (hy - 18); const r = this.drawFarBox(g, xx, hy, w, h, 0x14101e, FH);
          g.fillStyle(Environment.mix(0x14101e, em, 0.55)); for (let wy = hy - h + 5; wy < hy - 4; wy += 8) for (let wx = xx + 4; wx < xx + w - 4; wx += 7) if (rnd((wx * 2 + wy) | 0) > 0.45) g.fillRect(r.shx(wx, wy), wy, 3, 4);
          g.fillStyle(em, 0.55); g.fillRect(r.shx(xx + 3, r.topY), r.topY, w - 6, 2); }); // grattacieli + neon + tetto
        this.wrapX(rnd(20) * PW, xx => { g.fillStyle(0x1a1626); g.fillRect(xx, hy - 28, 120, 6); g.fillStyle(em, 0.3); g.fillRect(xx, hy - 28, 120, 1); }); // ponte
        break;
    }
    const haze = this.hazeColor; // foschia all'orizzonte (alto = distante): sfuma i volumi più lontani
    g.fillGradientStyle(haze, haze, haze, haze, 0.4, 0.4, 0, 0); g.fillRect(0, 0, PW, hy);
  }

  /** Feature ripetuta a x e x±PW: ciò che attraversa il bordo riappare sull'altro lato → tileable. */
  private wrapX(x: number, draw: (xx: number) => void) { draw(x); draw(x - PW); draw(x + PW); }

  /** Bordo strada = TERRENO PIATTO visto a piombo (niente skyline in piedi): coerente con la vista
   *  top-down e CONTIGUO alla strada. Resa AAA: macro-variazione tonale + grana fine + dettaglio denso
   *  e coerente per ambiente + AO ai bordi. Tutto deterministico (rnd da seno) → tileable senza giunta. */
  private drawGroundBand(g: TexGraphics, H: number, roadAtTop: boolean) {
    const base = this.env.groundColor;
    // PRNG deterministico (no Math.random → bake riproducibile e tileable con wrapX)
    const rnd = (n: number) => { const s = Math.sin(n * 12.9898 + this.idx * 78.233) * 43758.5453; return s - Math.floor(s); };
    const lite = (t: number) => Environment.mix(base, 0xffffff, t);
    const dark = (t: number) => Environment.mix(base, 0x000000, t);

    g.fillStyle(base); g.fillRect(0, 0, PW, H);
    // 1. macro-variazione tonale (blotch grandi e morbide) — rompe il colore piatto, dà "materia"
    for (let n = 0; n < 26; n++) {
      const y = rnd(n + 50) * H, r = 22 + rnd(n + 99) * 46;
      g.fillStyle(rnd(n + 7) < 0.5 ? lite(0.07) : dark(0.18), 0.45);
      this.wrapX(rnd(n) * PW, xx => g.fillEllipse(xx, y, r * 2, r * 1.25));
    }
    // 2. grana fine (speckle ad alta frequenza) — superficie non liscia
    for (let n = 0; n < 240; n++) {
      g.fillStyle(rnd(n + 600) < 0.5 ? lite(0.14) : dark(0.32), 0.4);
      g.fillRect(rnd(n + 200) * PW, rnd(n + 400) * H, 2, 2);
    }
    // 3. dettaglio coerente, denso, per ambiente
    this.drawGroundDetail(g, H, rnd, lite, dark);
    // 4. AO SOLO sul lato che TOCCA la strada (contiguità), basso e leggero → il dettaglio (relitti/
    //    clutter) resta leggibile invece di affogare in penombra. far: bordo basso · near: bordo alto.
    const edge = dark(0.5), eh = Math.round(H * 0.16);
    if (roadAtTop) { g.fillGradientStyle(edge, edge, edge, edge, 0.38, 0.38, 0, 0); g.fillRect(0, 0, PW, eh); }
    else           { g.fillGradientStyle(edge, edge, edge, edge, 0, 0, 0.38, 0.38); g.fillRect(0, H - eh, PW, eh); }
  }

  /** Strato di elementi top-down densi e coerenti per i 7 ambienti (chiamato da drawGroundBand). */
  private drawGroundDetail(g: TexGraphics, H: number, rnd: (n: number) => number, lite: (t: number) => number, dark: (t: number) => number) {
    const base = this.env.groundColor, em = this.emissive;
    switch (this.idx) {
      case 0: { // Città Distrutta — lastre crepate, macerie, tondini, chiazze d'olio, erbacce
        for (let n = 0; n < 7; n++) { const y = rnd(n) * H, w = 40 + rnd(n + 3) * 70, h = 18 + rnd(n + 9) * 22; // lastre di cemento
          this.wrapX(rnd(n + 1) * PW, xx => { g.fillStyle(dark(0.12), 0.5); g.fillRect(xx, y, w, h); g.lineStyle(2, dark(0.45), 0.7); g.strokeRect(xx, y, w, h); }); }
        g.lineStyle(1, this.crackColor, 0.7); // reticolo di crepe
        for (let n = 0; n < 16; n++) { let x = rnd(n + 20) * PW, y = rnd(n + 40) * H; for (let s = 0; s < 4; s++) { const nx = x + (rnd(n * 4 + s) - 0.5) * 38, ny = y + (rnd(n * 4 + s + 99) - 0.5) * 30; g.lineBetween(x, y, nx, ny); x = nx; y = ny; } }
        for (let n = 0; n < 40; n++) { g.fillStyle(rnd(n + 70) < 0.5 ? dark(0.5) : lite(0.05), 0.85); const s = 2 + rnd(n + 80) * 5; this.wrapX(rnd(n + 60) * PW, xx => g.fillRect(xx, rnd(n + 90) * H, s + 3, s)); } // macerie
        g.lineStyle(1, 0x6a6a6a, 0.5); for (let n = 0; n < 10; n++) { const y = rnd(n + 110) * H; this.wrapX(rnd(n + 120) * PW, xx => g.lineBetween(xx, y, xx + 14, y + (rnd(n + 130) - 0.5) * 6)); } // tondini
        g.fillStyle(0x0a0a0a, 0.4); for (let n = 0; n < 6; n++) this.wrapX(rnd(n + 140) * PW, xx => g.fillEllipse(xx, rnd(n + 150) * H, 26, 14)); // olio
        g.fillStyle(0x2a4a1e, 0.55); for (let n = 0; n < 22; n++) this.wrapX(rnd(n + 160) * PW, xx => g.fillEllipse(xx, rnd(n + 170) * H, 4, 3)); // erbacce nelle crepe
        break;
      }
      case 1: { // Autostrada — ghiaia, tracce pneumatici, olio, ciuffi d'erba secca, rifiuti
        g.fillStyle(dark(0.42), 0.55); g.fillRect(0, H * 0.32, PW, 5); g.fillRect(0, H * 0.6, PW, 5); // tracce gemellate
        g.fillStyle(dark(0.28), 0.4); g.fillRect(0, H * 0.32 + 6, PW, 3); g.fillRect(0, H * 0.6 + 6, PW, 3);
        for (let n = 0; n < 120; n++) { g.fillStyle(rnd(n) < 0.5 ? lite(0.12) : dark(0.4), 0.6); const s = 1 + rnd(n + 5) * 2; g.fillRect(rnd(n + 10) * PW, rnd(n + 20) * H, s, s); } // ghiaia
        for (let n = 0; n < 26; n++) { const cx = rnd(n + 40) * PW, cy = rnd(n + 50) * H; g.fillStyle(0x6a6a2e, 0.6); this.wrapX(cx, xx => { for (let b = 0; b < 5; b++) g.fillRect(xx + b - 2, cy - rnd(n * 5 + b) * 5, 1, 3 + rnd(n + b) * 3); }); } // ciuffi erba secca
        g.fillStyle(0x0a0a0a, 0.45); for (let n = 0; n < 5; n++) this.wrapX(rnd(n + 70) * PW, xx => g.fillEllipse(xx, rnd(n + 80) * H, 22, 12)); // olio
        for (let n = 0; n < 10; n++) { g.fillStyle(rnd(n + 90) < 0.5 ? 0x8a8a7a : 0x5a4a3a, 0.7); this.wrapX(rnd(n + 100) * PW, xx => g.fillRect(xx, rnd(n + 110) * H, 3 + rnd(n) * 3, 2)); } // rifiuti
        break;
      }
      case 2: { // Deserto — increspature, rocce con volume, terra screpolata, sterpaglia, ossa
        for (let y = 0; y < H; y += 3) { const w = Math.sin(y / H * Math.PI * 7) * 0.5 + 0.5; g.fillStyle(w > 0.5 ? lite(0.06) : dark(0.12), 0.3); g.fillRect(0, y, PW, 2); } // increspature da vento
        g.lineStyle(1, dark(0.3), 0.4); for (let n = 0; n < 8; n++) { const x = rnd(n) * PW, y = rnd(n + 9) * H; g.lineBetween(x, y, x + 30, y + 6); g.lineBetween(x + 14, y, x + 8, y + 16); } // terra screpolata
        for (let n = 0; n < 24; n++) { const y = rnd(n + 20) * H, r = 4 + rnd(n + 30) * 9; this.wrapX(rnd(n + 10) * PW, xx => { g.fillStyle(dark(0.35), 0.6); g.fillEllipse(xx + 2, y + 2, r * 2.2, r * 1.3); g.fillStyle(lite(0.1)); g.fillEllipse(xx, y, r * 2, r * 1.2); g.fillStyle(dark(0.1), 0.5); g.fillEllipse(xx + r * 0.4, y + r * 0.3, r, r * 0.6); }); } // rocce (luce/ombra)
        g.fillStyle(0x4a5a2a, 0.5); for (let n = 0; n < 14; n++) { const cx = rnd(n + 50) * PW, cy = rnd(n + 60) * H; this.wrapX(cx, xx => { for (let b = 0; b < 6; b++) { const a = b / 6 * Math.PI * 2; g.fillRect(xx + Math.cos(a) * 4, cy + Math.sin(a) * 3, 1, 2); } }); } // sterpaglia
        g.fillStyle(lite(0.2), 0.6); for (let n = 0; n < 8; n++) this.wrapX(rnd(n + 70) * PW, xx => g.fillRect(xx, rnd(n + 80) * H, 5 + rnd(n) * 4, 2)); // ossa/detriti sbiancati
        break;
      }
      case 3: { // Foresta — sottobosco a strati, tronchi con corteccia, foglie, muschio, sassi
        for (let n = 0; n < 70; n++) { const t = rnd(n + 5); g.fillStyle(Environment.mix(0x14380f, t < 0.5 ? 0x000000 : 0x3a6a22, Math.abs(t - 0.5)), 0.6); const r = 4 + rnd(n + 9) * 6; this.wrapX(rnd(n) * PW, xx => g.fillEllipse(xx, rnd(n + 20) * H, r * 2, r * 1.6)); } // sottobosco a strati
        for (let n = 0; n < 4; n++) { const y = rnd(n + 40) * (H - 8), w = 40 + rnd(n + 45) * 50; this.wrapX(rnd(n + 41) * PW, xx => { g.fillStyle(0x3a2814, 0.9); g.fillRoundedRect(xx, y, w, 8, 3); g.lineStyle(1, 0x241006, 0.7); for (let l = 0; l < 4; l++) g.lineBetween(xx + 4, y + 1 + l * 2, xx + w - 4, y + 1 + l * 2); g.fillStyle(0x1a0e06); g.fillCircle(xx, y + 4, 4); g.fillCircle(xx + w, y + 4, 4); }); } // tronchi (corteccia + estremità)
        for (let n = 0; n < 50; n++) { g.fillStyle(rnd(n + 80) < 0.5 ? 0x5a4a22 : 0x2a4a18, 0.5); g.fillRect(rnd(n + 60) * PW, rnd(n + 70) * H, 2, 2); } // foglie/lettiera
        g.fillStyle(0x3a6a2a, 0.4); for (let n = 0; n < 10; n++) this.wrapX(rnd(n + 90) * PW, xx => g.fillEllipse(xx, rnd(n + 100) * H, 16, 9)); // muschio
        g.fillStyle(0x4a4a44, 0.7); for (let n = 0; n < 12; n++) this.wrapX(rnd(n + 110) * PW, xx => g.fillEllipse(xx, rnd(n + 120) * H, 6, 4)); // sassi
        break;
      }
      case 4: { // Zona Industriale — giunti, piastre con rivetti, ruggine, olio iridescente, linee
        g.lineStyle(2, dark(0.35), 0.6); for (let x = 0; x <= PW; x += 60) g.lineBetween(x, 0, x, H); for (let y = 0; y < H; y += 40) g.lineBetween(0, y, PW, y); // giunti
        for (let n = 0; n < 6; n++) { const y = rnd(n + 5) * (H - 20); this.wrapX(rnd(n) * PW, xx => { g.fillStyle(lite(0.07), 0.7); g.fillRect(xx, y, 44, 18); g.lineStyle(1, dark(0.4), 0.8); g.strokeRect(xx, y, 44, 18); g.fillStyle(dark(0.2)); for (let r = 0; r < 4; r++) g.fillCircle(xx + 5 + r * 11, y + 4, 1.4); for (let r = 0; r < 4; r++) g.fillCircle(xx + 5 + r * 11, y + 14, 1.4); }); } // piastre + rivetti
        g.fillStyle(0x6a3a1a, 0.4); for (let n = 0; n < 14; n++) this.wrapX(rnd(n + 20) * PW, xx => g.fillEllipse(xx, rnd(n + 30) * H, 10, 7)); // ruggine
        for (let n = 0; n < 4; n++) this.wrapX(rnd(n + 40) * PW, xx => { const y = rnd(n + 45) * H; g.fillStyle(0x080808, 0.6); g.fillEllipse(xx, y, 26, 14); g.fillStyle(em, 0.08); g.fillEllipse(xx - 3, y - 2, 16, 8); }); // olio iridescente
        g.fillStyle(0xb0a020, 0.45); for (let x = 0; x < PW; x += 24) g.fillRect(x, H * 0.5, 14, 3); // linea di pericolo tratteggiata
        break;
      }
      case 5: { // Base Militare — terra battuta, tracce, sacchi a file, casse, stencil, mimetica
        g.fillStyle(dark(0.42), 0.5); g.fillRect(0, H * 0.36, PW, 5); g.fillRect(0, H * 0.36 + 7, PW, 3);
        for (let n = 0; n < 30; n++) { const t = rnd(n); g.fillStyle(Environment.mix(base, t < 0.5 ? 0x2a3a1a : 0x4a3a22, 0.4), 0.4); this.wrapX(rnd(n + 5) * PW, xx => g.fillEllipse(xx, rnd(n + 15) * H, 18, 11)); } // mimetica a chiazze
        for (let n = 0; n < 4; n++) { const y = rnd(n + 30) * (H - 12); this.wrapX(rnd(n + 31) * PW, xx => { for (let s = 0; s < 5; s++) { g.fillStyle(Environment.mix(0x6a6240, 0x000000, (s % 2) * 0.15), 0.85); g.fillRoundedRect(xx + s * 18, y, 17, 10, 3); } }); } // file di sacchi
        for (let n = 0; n < 5; n++) { const y = rnd(n + 50) * (H - 16); this.wrapX(rnd(n + 51) * PW, xx => { g.fillStyle(0x4a3a1e, 0.9); g.fillRect(xx, y, 18, 14); g.lineStyle(1, 0x2a1e0e, 0.8); g.strokeRect(xx, y, 18, 14); g.lineBetween(xx, y, xx + 18, y + 14); g.lineBetween(xx + 18, y, xx, y + 14); }); } // casse
        g.fillStyle(lite(0.18), 0.35); for (let n = 0; n < 3; n++) this.wrapX(rnd(n + 70) * PW, xx => g.fillRect(xx, rnd(n + 75) * H, 22, 8)); // stencil sbiaditi
        break;
      }
      default: { // Città Finale — pavimento bagnato, pozze al neon riflettenti, tombini, griglie, vapore
        g.fillStyle(dark(0.15)); g.fillRect(0, 0, PW, H); // velo "bagnato" leggero (era 0.35 → spegneva tutto)
        for (let n = 0; n < 9; n++) { const y = rnd(n + 5) * H, rw = 24 + rnd(n + 9) * 30; this.wrapX(rnd(n) * PW, xx => { g.fillStyle(0x000000, 0.4); g.fillEllipse(xx, y, rw * 2, rw); g.fillStyle(em, 0.18); g.fillEllipse(xx, y, rw * 1.6, rw * 0.7); g.fillStyle(lite(0.3), 0.25); g.fillRect(xx - rw * 0.6, y, rw * 1.2, 2); }); } // pozze al neon + riflesso
        for (let n = 0; n < 3; n++) this.wrapX(rnd(n + 20) * PW, xx => { const y = rnd(n + 25) * H; g.fillStyle(dark(0.4)); g.fillCircle(xx, y, 9); g.lineStyle(1, dark(0.6), 0.8); g.strokeCircle(xx, y, 9); for (let r = 0; r < 4; r++) g.lineBetween(xx - 7, y - 6 + r * 4, xx + 7, y - 6 + r * 4); }); // tombini
        g.lineStyle(1, dark(0.5), 0.6); for (let n = 0; n < 4; n++) { const x = rnd(n + 40) * PW, y = rnd(n + 45) * H; for (let l = 0; l < 6; l++) g.lineBetween(x, y + l * 3, x + 22, y + l * 3); } // griglie
        g.fillStyle(em, 0.05); for (let n = 0; n < 5; n++) this.wrapX(rnd(n + 60) * PW, xx => g.fillEllipse(xx, rnd(n + 70) * H, 40, 20)); // aloni di luce/vapore
        break;
      }
    }
  }

  // ─── §7 Decal (memoria della strada) ────────────────────────────────────────
  private buildDecalTextures() {
    if (!this.has('env_scorch')) {
      const g = this.gfx();
      for (let r = 30; r >= 1; r--) { g.fillStyle(0x000000, 0.045); g.fillCircle(32, 32, r); }
      g.fillStyle(0x3a1d0e, 0.3); g.fillCircle(32, 32, 16);
      g.fillStyle(0x000000, 0.4); g.fillCircle(32, 32, 8);
      g.generateTexture('env_scorch', 64, 64); g.destroy();
    }
    if (!this.has('env_blood')) {
      const g = this.gfx();
      g.fillStyle(0x4a0e0a, 0.9); g.fillEllipse(28, 28, 42, 30);
      g.fillStyle(0x6e1810, 0.7); g.fillEllipse(26, 27, 26, 18);
      g.fillStyle(0x2a0606, 0.8);
      for (let i = 0; i < 7; i++) { const a = Math.random() * Math.PI * 2, d = 16 + Math.random() * 12; g.fillEllipse(28 + Math.cos(a) * d, 28 + Math.sin(a) * d, 4 + Math.random() * 5, 3 + Math.random() * 4); }
      g.generateTexture('env_blood', 56, 56); g.destroy();
    }
    if (!this.has('env_skid')) {
      const g = this.gfx();
      g.fillStyle(0x000000, 0.5); g.fillRect(0, 1, 80, 2); g.fillRect(0, 6, 80, 2);
      g.generateTexture('env_skid', 80, 9); g.destroy();
    }
    if (!this.has('env_debris')) {
      const g = this.gfx();
      g.fillStyle(0x4a463e, 0.9);
      for (let i = 0; i < 9; i++) g.fillRect(Math.random() * 38, Math.random() * 22, 2 + Math.random() * 3, 2 + Math.random() * 3);
      g.generateTexture('env_debris', 40, 24); g.destroy();
    }
  }

  // ─── §6 Illuminazione: cono fari ────────────────────────────────────────────
  private buildHeadlightTexture() {
    if (this.has('env_headlight')) return;
    const CW = 240, CH = 180, g = this.gfx();
    for (let x = 0; x < CW; x += 2) {
      const t = x / CW;                       // 0 al veicolo → 1 lontano
      const halfH = 10 + t * 78;              // il cono si apre
      const a = (1 - t) * (1 - t) * 0.18;     // più luminoso vicino alla sorgente
      g.fillStyle(0xffffff, a); g.fillEllipse(x, CH / 2, 6, halfH * 2);
    }
    g.generateTexture('env_headlight', CW, CH); g.destroy();
  }

  // ─── Composizione scena (depth espliciti) ───────────────────────────────────
  private buildObjects() {
    const { W, H, roadTop, roadBottom, roadCenter } = this.g;

    // Vista a piombo: niente cielo. Base TERRENO dietro i layer far/near (che la coprono col dettaglio).
    const ground = this.scene.add.graphics().setDepth(0.1);
    ground.fillStyle(Environment.mix(this.env.groundColor, 0x000000, 0.12)); ground.fillRect(0, 0, W, H);

    // Terreno fuori strada, top-down, sopra (far) e sotto (near) la carreggiata — contiguo, scorre con essa
    this.far  = this.scene.add.tileSprite(W / 2, roadTop / 2, W, roadTop, `env_far_${this.idx}`).setDepth(0.2);
    this.near = this.scene.add.tileSprite(W / 2, (roadBottom + H) / 2, W, H - roadBottom, `env_near_${this.idx}`).setDepth(0.3);

    // §4 asfalto tileato (copre il rettangolo piatto + le linee di bordo)
    this.asphalt = this.scene.add.tileSprite(W / 2, roadCenter, W, roadBottom - roadTop, `env_asphalt_${this.idx}`).setDepth(0.5);
    // Dettaglio FBM in shader sulla strada (opzione Grafica + WebGL): scorre col manto.
    if (Settings.asphaltDetail && this.scene.game.renderer.type === Phaser.WEBGL) {
      this.asphalt.setPostPipeline(AsphaltPipeline);
    }

    // §6 luce di carreggiata: incassa i bordi nella notte, centro leggibile (sotto le entità)
    const rl = this.scene.add.graphics().setDepth(2);
    rl.fillGradientStyle(0, 0, 0, 0, 0.45, 0.45, 0, 0); rl.fillRect(0, roadTop, W, roadCenter - roadTop);
    rl.fillGradientStyle(0, 0, 0, 0, 0, 0, 0.5, 0.5);   rl.fillRect(0, roadCenter, W, roadBottom - roadCenter);

    // §6 cono dei fari (additivo, segue il veicolo)
    this.headlight = this.scene.add.image(0, roadCenter, 'env_headlight')
      .setOrigin(0.04, 0.5).setDepth(2.6).setTint(0xffeebb).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
  }

  // ─── API runtime ────────────────────────────────────────────────────────────

  /** Chiamala ogni frame: scorre gli strati a velocità di parallasse diverse + muove i decal + fari. */
  update(dt: number, vehicleX: number, vehicleY: number) {
    const sx = this.g.scrollSpeed * dt;
    this.asphalt.tilePositionX += sx;
    // NEAR (foreground, contiguo) scorre con la strada; FAR (skyline distante) a parallasse più lenta.
    this.far.tilePositionX  += sx * 0.5;
    this.near.tilePositionX += sx;
    asphaltParams.scroll = this.asphalt.tilePositionX; // alimenta lo shader di superficie

    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      if (!d.active) { this.decals.splice(i, 1); continue; }
      d.x -= sx;
      if (d.x < -70) { d.destroy(); this.decals.splice(i, 1); }
    }

    this.headlight.setPosition(vehicleX + 16, vehicleY);
  }

  /** Lascia un segno sull'asfalto (scorre con la strada, fire-and-forget). */
  addDecal(type: DecalType, x: number, y: number) {
    if (y < this.g.roadTop + 8 || y > this.g.roadBottom - 8) return; // solo sulla carreggiata

    let key = 'env_scorch', life = 4000, alpha = 0.9, scale = 1, rot = Math.random() * Math.PI;
    switch (type) {
      case 'blood':
        if (this.scene.time.now - this.lastBlood < BLOOD_THROTTLE) return;
        this.lastBlood = this.scene.time.now;
        key = 'env_blood'; life = 3200; alpha = 0.85; scale = 0.6 + Math.random() * 0.5; break;
      case 'scorch': key = 'env_scorch'; life = 4200; alpha = 0.9;  scale = 1.0 + Math.random() * 0.6; break;
      case 'skid':   key = 'env_skid';   life = 2600; alpha = 0.55; scale = 0.8 + Math.random() * 0.4; rot = (Math.random() - 0.5) * 0.2; break;
      case 'debris': key = 'env_debris'; life = 2200; alpha = 0.9;  scale = 1.0 + Math.random() * 0.4; break;
    }

    const img = this.scene.add.image(x, y, key).setDepth(1.8).setAlpha(alpha).setScale(scale).setRotation(rot);
    this.scene.tweens.add({ targets: img, alpha: 0, duration: life, ease: 'Quad.easeIn', onComplete: () => img.destroy() });

    this.decals.push(img);
    if (this.decals.length > DECAL_CAP) { const old = this.decals.shift(); old?.destroy(); }
  }
}
