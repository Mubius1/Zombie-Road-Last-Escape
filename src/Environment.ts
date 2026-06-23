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

// ── Proiezione obliqua 3/4 (single source dell'angolo; vedi ART_BIBLE_AMBIENTE §15) ──
// Tutto l'effetto 3/4 (lean, tetto, ombra) deriva da QUESTA costante: cambi l'angolo qui → cambia
// coerente ovunque. Look "Dead Nation": gli oggetti dei bordi appoggiano a terra invece di galleggiare.
const OBLIQUE = {
  SHEAR:      0.20, // shift orizzontale per unità di altezza (un solo angolo condiviso)
  TOP_DEPTH:  0.22, // frazione dell'altezza resa come "tetto" foreshortened
  SHADOW_DX:  0.45, // direzione ombra a contatto (basso-DESTRA → luce alto-sinistra)
  SHADOW_LEN: 0.55, // lunghezza ombra in frazione dell'altezza
  SHADOW_A:   0.35, // alpha ombra a contatto
  TOP_LIGHT:  0.18, // mix verso bianco del top-face (luce alto-sinistra)
  FACE_DARK:  0.22, // mix verso nero della faccia in ombra (lato basso-destra)
  FAR_SCALE:  0.85, // scala oggetti layer far (più lontani → più piccoli) — usata in M3
  NEAR_SCALE: 1.15, // scala oggetti layer near (più vicini → più grandi) — usata in M3
  NEAR_SHADOW_MUL: 1.6, // ombre near più lunghe (più vicino alla camera)
} as const;
const SKY_BAND = 0.45; // frazione di roadTop tenuta come striscia di cielo; il resto è piano di terra
// Shear tiling-safe: lo shift dipende SOLO da y → preserva la periodicità orizzontale (tileable a PW).
const shearX = (x: number, y: number, H: number) => x + OBLIQUE.SHEAR * (H - y);

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

  /** Ombra a contatto: ellisse scura schiacciata alla base, offset verso basso-destra (luce alto-sinistra).
   *  È ciò che fa "sedere" un oggetto sul piano di terra invece di farlo galleggiare. */
  private contactShadow(g: TexGraphics, x: number, baseY: number, w: number, h: number, mul = 1) {
    g.fillStyle(Environment.mix(this.env.groundColor, 0x000000, 0.55), OBLIQUE.SHADOW_A);
    g.fillEllipse(x + w / 2 + w * OBLIQUE.SHADOW_DX * 0.5, baseY - 2, w * 1.1, Math.max(3, h * 0.16 * mul));
  }

  /** Volume 3/4 obliquo: ombra a contatto → corpo shearato (lean condiviso) → faccia destra in ombra →
   *  top-face chiaro (accenno di tetto, luce alto-sinistra). Tiling-safe: lo shear dipende solo da y. */
  private obliqueBox(g: TexGraphics, x: number, baseY: number, w: number, h: number, H: number, color: number, scale = 1, shadowMul = 1) {
    const sw = w * scale, sh = h * scale, topY = baseY - sh;
    this.contactShadow(g, x, baseY, sw, sh, shadowMul);
    const bl = shearX(x, baseY, H), br = shearX(x + sw, baseY, H);
    const tl = shearX(x, topY, H),  tr = shearX(x + sw, topY, H);
    g.fillStyle(color);
    g.fillPoints([{ x: bl, y: baseY }, { x: br, y: baseY }, { x: tr, y: topY }, { x: tl, y: topY }], true);
    // faccia in ombra: striscia destra leggermente più scura (coerente con la luce alto-sinistra)
    g.fillStyle(Environment.mix(color, 0x000000, OBLIQUE.FACE_DARK), 0.5);
    g.fillPoints([
      { x: shearX(x + sw * 0.82, baseY, H), y: baseY }, { x: br, y: baseY },
      { x: tr, y: topY }, { x: shearX(x + sw * 0.82, topY, H), y: topY },
    ], true);
    // top-face: trapezio chiaro spostato in alto (profondità tetto foreshortened)
    const td = sh * OBLIQUE.TOP_DEPTH;
    g.fillStyle(Environment.mix(color, 0xffffff, OBLIQUE.TOP_LIGHT));
    g.fillPoints([
      { x: tl, y: topY }, { x: tr, y: topY },
      { x: shearX(x + sw + td * 0.5, topY - td, H), y: topY - td },
      { x: shearX(x + td * 0.5, topY - td, H), y: topY - td },
    ], true);
  }

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
    if (!this.has(farKey))  { const g = this.gfx(); this.drawFar(g, FH);  g.generateTexture(farKey, PW, FH);  g.destroy(); }
    if (!this.has(nearKey)) { const g = this.gfx(); this.drawNear(g, NH); g.generateTexture(nearKey, PW, NH); g.destroy(); }
  }

  /** Skyline lontana 3/4 (volumi obliqui ancorati al piano di terra). Pattern periodici → tileable. */
  private drawFar(g: TexGraphics, FH: number) {
    const B = FH; // baseline (orizzonte): i piedi degli oggetti appoggiano qui
    const lit = (i: number, j: number) => ((i * 7 + j * 13 + this.idx) % 3) === 0; // finestre deterministiche
    // neon emissivo (M4) sul top-face dei palazzi della Città Finale; altrove un tetto neutro chiaro.
    switch (this.idx) {
      case 0: { // Città Distrutta — palazzi (volumi 3/4 con finestre shearate)
        for (let i = 0; i < 6; i++) {
          const bx = i * 80 + 6, bw = 56, bh = 48 + Math.round(Math.sin(i / 6 * Math.PI * 2) * 16) + (i % 2) * 14;
          this.obliqueBox(g, bx, B, bw, bh, FH, 0x202028);
          for (let wy = B - bh + 6, j = 0; wy < B - 6; wy += 12, j++)
            for (let wx = bx + 5, k = 0; wx < bx + bw - 5; wx += 12, k++) {
              g.fillStyle(lit(j, k) ? 0x2a2a16 : 0x0c0c1c); g.fillRect(shearX(wx, wy, FH), wy, 5, 7);
            }
        }
        break;
      }
      case 1: { // Autostrada — alberi morti (volumi sottili) + guardrail shearato
        for (let i = 0; i < 3; i++) {
          const tx = i * 160 + 50, th = 60 + (i % 2) * 16;
          this.obliqueBox(g, tx, B, 5, th, FH, 0x2a2418);
          g.fillStyle(0x2a2418);
          g.fillRect(shearX(tx - 14, B - th + 8, FH), B - th + 8, 12, 4);
          g.fillRect(shearX(tx + 5, B - th + 16, FH), B - th + 16, 13, 4);
        }
        g.fillStyle(0x3a3830); g.fillRect(0, B - 14, PW, 4);
        for (let x = 0; x < PW; x += 40) g.fillRect(shearX(x, B - 20, FH), B - 20, 4, 12);
        break;
      }
      case 2: { // Deserto — dune (terreno, restano piatte) + cactus (volume)
        g.fillStyle(0x3a2c14);
        for (let x = 0; x <= PW; x += 2) {
          const crest = 30 + Math.round(Math.sin(x / PW * Math.PI * 2 * 4) * 16 + Math.sin(x / PW * Math.PI * 2 * 8) * 7);
          g.fillRect(x, B - crest, 2, crest + 2);
        }
        for (let i = 0; i < 3; i++) {
          const x = i * 160 + 70;
          this.obliqueBox(g, x + 4, B, 10, 50, FH, 0x2a441a);
          g.fillStyle(0x2a441a);
          g.fillRect(shearX(x - 8, B - 38, FH), B - 38, 12, 8); g.fillRect(shearX(x - 8, B - 50, FH), B - 50, 8, 14);
          g.fillRect(shearX(x + 14, B - 33, FH), B - 33, 12, 8); g.fillRect(shearX(x + 20, B - 45, FH), B - 45, 8, 14);
        }
        break;
      }
      case 3: { // Foresta — pini (triangoli shearati + ombra a contatto)
        for (let i = 0; i < 12; i++) {
          const cx = i * 40 + 20, th = 56 + (i % 3) * 8;
          this.contactShadow(g, cx - 17, B, 34, th);
          for (let dy = 0; dy < th; dy++) { const hw = Math.round((dy / th) * 17), y = B - th + dy; g.fillStyle(0x0a1e08); g.fillRect(shearX(cx - hw, y, FH), y, hw * 2, 3); }
          g.fillStyle(0x0a1e08); g.fillRect(shearX(cx - 4, B - 8, FH), B - 8, 8, 10);
          // accenno di luce sul fianco alto-sinistra (volume)
          g.fillStyle(Environment.mix(0x0a1e08, 0xffffff, OBLIQUE.TOP_LIGHT * 0.7));
          for (let dy = 2; dy < th; dy += 3) { const hw = Math.round((dy / th) * 17), y = B - th + dy; g.fillRect(shearX(cx - hw, y, FH), y, Math.max(1, Math.round(hw * 0.5)), 2); }
        }
        break;
      }
      case 4: { // Zona Industriale — fabbrica (slab basso) + ciminiere (volumi)
        g.fillStyle(0x1e1c18); g.fillRect(0, B - 34, PW, 34);
        for (let i = 0; i < 4; i++) {
          const sx = i * 120 + 40, sh = 64 + (i % 3) * 18;
          this.obliqueBox(g, sx, B, 20, sh, FH, 0x2a2420);
          g.fillStyle(0x181614); g.fillCircle(shearX(sx + 10, B - sh, FH), B - sh, 9); // fumo alla bocca
        }
        break;
      }
      case 5: { // Base Militare — torrette (volumi) + recinzione shearata
        for (let i = 0; i < 2; i++) {
          const tx = i * 240 + 90;
          this.obliqueBox(g, tx + 4, B, 7, 74, FH, 0x1e2a14);
          g.fillStyle(0x1e2a14);
          g.fillRect(shearX(tx - 18, B - 80, FH), B - 80, 46, 18); g.fillRect(shearX(tx - 20, B - 86, FH), B - 86, 50, 8);
          g.fillStyle(0x446644); g.fillRect(shearX(tx - 6, B - 74, FH), B - 74, 5, 10);
        }
        g.fillStyle(0x2a3820); g.fillRect(0, B - 18, PW, 4);
        for (let x = 0; x < PW; x += 16) g.fillRect(shearX(x, B - 26, FH), B - 26, 3, 12);
        break;
      }
      default: { // 6 Città Finale — grattacieli al neon (volumi + finestre shearate)
        for (let i = 0; i < 6; i++) {
          const bx = i * 80 + 4, bw = 60, bh = 64 + Math.round(Math.sin(i / 6 * Math.PI * 2) * 22);
          this.obliqueBox(g, bx, B, bw, bh, FH, 0x1a0c22);
          // M4: riflesso neon freddo sul tetto (cattura la luce obliqua)
          g.fillStyle(Environment.mix(0x1a0c22, this.emissive, 0.25));
          g.fillRect(shearX(bx + 4, B - bh, FH), B - bh - Math.round(bh * OBLIQUE.TOP_DEPTH) + 1, bw - 8, 2);
          for (let wy = B - bh + 6, j = 0; wy < B - 6; wy += 11, j++)
            for (let wx = bx + 5, k = 0; wx < bx + bw - 5; wx += 10, k++) {
              g.fillStyle(lit(j, k) ? 0x4a1a6a : 0x0e060e); g.fillRect(shearX(wx, wy, FH), wy, 4, 6);
            }
        }
      }
    }
  }

  /** Dettaglio vicino (ancorato in alto = appena sotto la strada). M3: shear coerente col `far` → la
   *  fascia che TOCCA la strada legge 3/4 come il resto, non alzato piatto. (Tiling-safe: shift solo da y.) */
  private drawNear(g: TexGraphics, NH: number) {
    const sx = (x: number, y: number) => shearX(x, y, NH); // stessa proiezione del far
    switch (this.idx) {
      case 0: g.fillStyle(0x252520); for (let x = 0; x < PW; x += 96) g.fillRect(sx(x + 10, 4), 4, 38, 14); break;
      case 1:
        g.fillStyle(0x3a3830); g.fillRect(0, 2, PW, 4); g.fillRect(0, 14, PW, 3);
        for (let x = 0; x < PW; x += 40) g.fillRect(sx(x, 0), 0, 4, 18);
        break;
      case 2: g.fillStyle(0x3a2c12); for (let x = 0; x <= PW; x += 2) { const h = Math.round(Math.sin(x / PW * Math.PI * 2 * 4) * 12 + 8); g.fillRect(x, 0, 2, h); } break;
      case 3: g.fillStyle(0x0c1a08); for (let x = 0; x < PW; x += 48) g.fillRect(sx(x, 0), 0, 32, 8 + (x % 4) * 3); break;
      case 4:
        g.fillStyle(0x302820); g.fillRect(0, 4, PW, 10); g.fillRect(0, 20, PW, 6);
        for (let x = 0; x < PW; x += 80) g.fillRect(sx(x, 0), 0, 14, 28);
        break;
      case 5: g.fillStyle(0x2a2a1a); for (let x = 0; x < PW; x += 48) { g.fillRect(sx(x, 2), 2, 42, 14); g.fillRect(sx(x + 5, 0), 0, 32, 10); } break;
      default:
        g.fillStyle(0x160820); g.fillRect(0, 0, PW, NH);
        g.fillStyle(0x220c30); for (let x = 0; x < PW; x += 120) g.fillRect(sx(x, 0), 0, 50, 40);
        g.fillStyle(this.emissive, 0.10); for (let x = 30; x < PW; x += 120) g.fillEllipse(sx(x, 18), 18, 60, 14);
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

    // §6 gradiente cielo + foschia all'orizzonte (statico, sotto i decoratori)
    const sky = this.scene.add.graphics().setDepth(0.1);
    const top = Environment.mix(this.env.skyColor, 0x000000, 0.30);
    const hor = Environment.mix(this.env.skyColor, this.hazeColor, 0.7);
    // M1: il cielo si comprime in una striscia alta velata; sotto, un PIANO DI TERRA continuo su cui i
    // decoratori del layer far appoggiano (niente più skyline che galleggia all'orizzonte).
    const skyH = Math.round(roadTop * SKY_BAND);
    sky.fillGradientStyle(top, top, hor, hor, 1, 1, 1, 1); sky.fillRect(0, 0, W, skyH);
    const gTop = Environment.mix(this.env.groundColor, this.hazeColor, 0.55);
    const gBot = Environment.mix(this.env.groundColor, 0x000000, 0.22);
    sky.fillGradientStyle(gTop, gTop, gBot, gBot, 1, 1, 1, 1); sky.fillRect(0, skyH, W, roadTop - skyH);
    sky.fillStyle(this.hazeColor, 0.25); sky.fillRect(0, skyH - 6, W, 10); // foschia sulla linea d'orizzonte

    // §5 parallasse: skyline lontana (lenta) + terreno vicino (veloce)
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
    this.far.tilePositionX  += sx * 0.22;
    this.near.tilePositionX += sx * 0.55;
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
