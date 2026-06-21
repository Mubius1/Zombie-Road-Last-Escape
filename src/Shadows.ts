import Phaser from 'phaser';

/**
 * Shadows — ombre di contatto sotto le entità (radicamento "2.5D").
 *
 * Interpretazione art-compatibile della "luce 2.5D": gli sprite del gioco sono
 * **pre-ombreggiati** (regola di luce alto-sinistra cotta nella texture), quindi un
 * normal-mapping per-sprite produrrebbe doppia ombreggiatura. La via giusta per dare
 * dimensionalità a un'arte pre-shaded è la **drop shadow** a terra (look alla
 * Darkest Dungeon / Don't Starve): radica le entità nel mondo e legge come "oggetti
 * reali in una scena illuminata".
 *
 * Implementazione: una **sola RenderTexture** sul piano-terra (depth sotto le entità),
 * ridisegnata ogni frame stampando un'ellisse morbida sotto ogni entità attiva. Niente
 * sprite-ombra accoppiati né gestione lifecycle: la lista viva ricostruisce il layer ogni
 * frame, quindi le entità morte spariscono da sole. Tutto procedurale, nessun asset.
 */

/** Depth del piano-ombre: sopra strada/decal (~2.6), sotto pickup/hazard/entità (≥5). */
export const SHADOW_DEPTH = 4;

const TEX_KEY = 'fx_shadow';
const TEX_W = 64;
const TEX_H = 28; // ellisse schiacciata (prospettiva a terra)

// Taratura (conservativa): l'ombra è un po' più stretta dello sprite, morbida, spostata
// in basso-destra coerente con la luce alto-sinistra.
const WIDEN = 0.92;     // larghezza ombra / larghezza sprite
const ALPHA = 0.34;     // opacità di base
const OFF_X_FRAC = 0.05; // scostamento orizzontale (luce da sinistra → ombra a destra)
const OFF_Y_FRAC = 0.30; // scostamento verticale verso la base dello sprite

export default class Shadows {
  private rt: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, designW: number, designH: number) {
    Shadows.buildTexture(scene);
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(designW), Math.ceil(designH))
      .setOrigin(0, 0)
      .setDepth(SHADOW_DEPTH);
    // Stampo riusato: ne impostiamo trasformazione/alpha e lo disegniamo nella RT.
    this.stamp = scene.make.image({ key: TEX_KEY, add: false }).setOrigin(0.5, 0.5);

    // Lo stampo non è aggiunto alla scena → non viene auto-distrutto: lo smontiamo a mano.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.stamp.destroy(); this.rt.destroy(); });
  }

  /** Ellisse nera morbida (alone accumulato), una sola volta. */
  static buildTexture(scene: Phaser.Scene) {
    if (scene.textures.exists(TEX_KEY)) return;
    const g = scene.make.graphics({ add: false } as any);
    // Cerchi concentrici accumulati → centro pieno, bordo sfumato (come fx_light ma nero).
    const cx = TEX_W / 2, cy = TEX_H / 2;
    const steps = TEX_H / 2;
    for (let i = steps; i >= 1; i--) {
      const t = i / steps;
      g.fillStyle(0x000000, 0.05);
      g.fillEllipse(cx, cy, TEX_W * t, TEX_H * t);
    }
    (g as Phaser.GameObjects.Graphics & { generateTexture(k: string, w: number, h: number): void })
      .generateTexture(TEX_KEY, TEX_W, TEX_H);
    g.destroy();
  }

  /** Ridisegna il layer ombre per la lista di entità attive di questo frame. */
  update(casters: Phaser.GameObjects.Sprite[]): void {
    this.rt.clear();
    this.rt.beginDraw();
    for (const e of casters) {
      const w = e.displayWidth;
      const h = e.displayHeight;
      if (w <= 0) continue;
      const s = (w * WIDEN) / TEX_W;
      this.stamp.setScale(s).setAlpha(ALPHA);
      this.rt.batchDraw(this.stamp, e.x + w * OFF_X_FRAC, e.y + h * OFF_Y_FRAC);
    }
    this.rt.endDraw();
  }
}
