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
    if (!this.has(farKey))  { const g = this.gfx(); this.drawGroundBand(g, FH); g.generateTexture(farKey, PW, FH);  g.destroy(); }
    if (!this.has(nearKey)) { const g = this.gfx(); this.drawGroundBand(g, NH); g.generateTexture(nearKey, PW, NH); g.destroy(); }
  }

  /** Bordo strada = TERRENO PIATTO visto a piombo (niente skyline in piedi): coerente con la vista
   *  top-down e CONTIGUO alla strada. Pattern a passo che divide PW=480 → tileable senza giunta. */
  private drawGroundBand(g: TexGraphics, H: number) {
    const base = this.env.groundColor;
    g.fillStyle(base); g.fillRect(0, 0, PW, H);
    const light = Environment.mix(base, 0xffffff, 0.09);
    const dark  = Environment.mix(base, 0x000000, 0.34);
    // grana tonale (chiazze chiaro/scuro, y deterministica) — antidoto al colore piatto
    for (let x = 0, n = 0; x < PW; x += 8, n++) {
      g.fillStyle((n % 2) ? light : dark, 0.30);
      g.fillEllipse(x + 2, (n * 53) % (H - 4) + 2, 5, 3);
    }
    switch (this.idx) {
      case 0: // Città Distrutta — concreto crepato + macerie
        g.lineStyle(1, this.crackColor, 0.55);
        for (let x = 0, n = 0; x < PW; x += 60, n++) { const y = (n * 41) % (H - 14) + 4; g.lineBetween(x, y, x + 26, y + 10); g.lineBetween(x + 26, y + 10, x + 44, y + 2); }
        g.fillStyle(Environment.mix(base, 0x000000, 0.5), 0.85);
        for (let x = 0, n = 0; x < PW; x += 48, n++) g.fillRect(x + 6, (n * 67) % (H - 8) + 2, 9 + (n % 3) * 3, 5);
        break;
      case 1: // Autostrada — tracce pneumatici + ghiaia + erba secca
        g.fillStyle(Environment.mix(base, 0x000000, 0.4), 0.5);
        g.fillRect(0, Math.round(H * 0.34), PW, 4); g.fillRect(0, Math.round(H * 0.62), PW, 4);
        g.fillStyle(0x5a5a2a, 0.5);
        for (let x = 0, n = 0; x < PW; x += 40, n++) g.fillRect(x + (n % 3) * 6, (n * 71) % (H - 5) + 2, 3, 4);
        break;
      case 2: // Deserto — sabbia a increspature (bande orizzontali)
        for (let y = 0; y < H; y += 4) { const n = y / 4; g.fillStyle((n % 2) ? light : dark, 0.28); g.fillRect(0, y, PW, 2); }
        g.fillStyle(Environment.mix(base, 0x000000, 0.45), 0.7);
        for (let x = 0, n = 0; x < PW; x += 60, n++) g.fillEllipse(x + 20, (n * 71) % (H - 6) + 3, 11, 6);
        break;
      case 3: // Foresta — sottobosco (chiazze verdi) + tronchi caduti
        for (let x = 0, n = 0; x < PW; x += 12, n++) { g.fillStyle(Environment.mix(0x183a14, 0x000000, (n % 3) * 0.16), 0.55); g.fillEllipse(x + 4, (n * 53) % H, 8, 6); }
        g.fillStyle(0x2a1c10, 0.85);
        for (let x = 0, n = 0; x < PW; x += 96, n++) g.fillRect(x + 6, (n * 89) % (H - 6) + 2, 46, 6);
        break;
      case 4: // Zona Industriale — cemento (giunti) + piastre + olio
        g.fillStyle(Environment.mix(base, 0x000000, 0.3), 0.6); for (let x = 0; x < PW; x += 60) g.fillRect(x, 0, 2, H);
        g.fillStyle(Environment.mix(base, 0xffffff, 0.06), 0.6); for (let x = 0, n = 0; x < PW; x += 80, n++) g.fillRect(x + 8, (n * 41) % (H - 18) + 2, 42, 16);
        g.fillStyle(0x0a0a0a, 0.5); for (let x = 0, n = 0; x < PW; x += 96, n++) g.fillEllipse(x + 30, (n * 67) % (H - 6) + 3, 24, 12);
        break;
      case 5: // Base Militare — terra battuta + traccia + sacchi
        g.fillStyle(Environment.mix(base, 0x000000, 0.4), 0.5); g.fillRect(0, Math.round(H * 0.4), PW, 5);
        g.fillStyle(Environment.mix(base, 0x000000, 0.24), 0.65);
        for (let x = 0, n = 0; x < PW; x += 40, n++) g.fillRoundedRect(x + 4, (n * 53) % (H - 9) + 2, 16, 8, 3);
        break;
      default: // Città Finale — pavimento bagnato + pozze al neon
        g.fillStyle(Environment.mix(base, 0x000000, 0.4)); g.fillRect(0, 0, PW, H);
        g.fillStyle(this.emissive, 0.15); for (let x = 0, n = 0; x < PW; x += 60, n++) g.fillEllipse(x + 24, (n * 53) % (H - 8) + 4, 30 + (n % 3) * 8, 10);
        g.fillStyle(Environment.mix(this.emissive, 0x000000, 0.3), 0.18); for (let x = 0; x < PW; x += 96) g.fillRect(x + 10, Math.round(H * 0.5), 60, 2);
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
    // Bordi top-down contigui: il terreno fuori strada scorre CON la strada (1.0×) → niente "slittamento".
    this.far.tilePositionX  += sx;
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
