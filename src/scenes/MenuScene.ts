import Phaser from 'phaser';
import Juice from '../Juice';
import Ui, { UI } from '../Ui';
import GameScene from './GameScene';

const W = 800, H = 600;

/**
 * Schermata del titolo — la prima scena del gioco.
 * Due voci: "Nuova Partita" (azzera il progresso e parte) e "Impostazioni".
 * Stile coerente con l'art bible: notturno desaturato, accenti emissivi firma
 * (malato-verde · arancio-fuoco · rosso-sangue), vignetta + grana, transizioni in dissolvenza.
 */
export default class MenuScene extends Phaser.Scene {
  private grain: Phaser.GameObjects.TileSprite | null = null;

  constructor() { super({ key: 'MenuScene' }); }

  create() {
    Juice.buildTextures(this);
    this.buildBackdrop();
    this.buildAtmosphere();
    this.buildTitle();
    this.buildButtons();

    Ui.text(this, W / 2, 552, 'Premi  INVIO  per iniziare  ·  clic per scegliere', {
      fontSize: '12px', color: UI.ghost,
    }).setOrigin(0.5).setDepth(10);

    this.input.keyboard?.on('keydown-ENTER', () => this.newGame());

    this.grain = Ui.enter(this);
  }

  update() {
    Juice.jitterGrain(this.grain);
  }

  // ─── Sfondo procedurale (cielo notturno + skyline in rovina) ──────────────────

  private buildBackdrop() {
    const horizon = 300;
    const g = this.add.graphics();

    // Cielo: alto quasi nero → orizzonte blu-grigio malato
    g.fillGradientStyle(0x07070d, 0x07070d, 0x141320, 0x18121e, 1, 1, 1, 1);
    g.fillRect(0, 0, W, horizon);
    // Terreno: leggermente più caldo, scuro
    g.fillStyle(0x090910, 1);
    g.fillRect(0, horizon, W, H - horizon);

    // Skyline in rovina: edifici scuri con rare finestre fioche (1 accento caldo)
    for (let x = -10; x < W + 10; x += Phaser.Math.Between(34, 58)) {
      const bw = Phaser.Math.Between(28, 52);
      const bh = Phaser.Math.Between(40, 96);
      const bx = x, by = horizon - bh;
      g.fillStyle(0x04040a, 1);
      g.fillRect(bx, by, bw, bh);
      // qualche finestra accesa fioca (ambra), una su tante
      for (let wy = by + 8; wy < horizon - 6; wy += 12) {
        for (let wx = bx + 4; wx < bx + bw - 4; wx += 9) {
          if (Phaser.Math.Between(0, 9) === 0) {
            g.fillStyle(0xcaa84a, 0.5);
            g.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }

    // Linea d'orizzonte rosso-sangue: l'unico accento saturo del fondo
    g.fillStyle(0x7a1e12, 0.45);
    g.fillRect(0, horizon - 1, W, 2);

    // Carreggiata accennata sotto i pulsanti + strisce consumate (texture, non gameplay)
    g.fillStyle(0x111119, 1);
    g.fillRect(0, 360, W, 150);
    for (let sx = 40; sx < W; sx += 110) {
      g.fillStyle(0x3a3520, 0.22);
      g.fillRect(sx, 432, 48, 5);
    }
  }

  // ─── Atmosfera (foschia alla deriva + veicolo che sfreccia) ─────────────────────

  private buildAtmosphere() {
    // Foschia: 3 aloni scuri morbidi che derivano lenti sull'orizzonte (profondità + mood)
    for (let i = 0; i < 3; i++) {
      const fog = this.add.image(Phaser.Math.Between(60, W - 60), Phaser.Math.Between(150, 300), 'fx_light')
        .setTint(0x2a2a3a).setAlpha(0.10).setScale(7, 3).setDepth(1);
      this.tweens.add({
        targets: fog, x: `+=${Phaser.Math.Between(120, 200)}`,
        duration: Phaser.Math.Between(9000, 14000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Veicolo che attraversa la strada accennata, fari accesi (silhouette del gioco)
    if (!this.textures.exists('vehicle_armored_truck')) GameScene.buildVehicleTexture(this, 'armored_truck');
    const car = this.add.image(-150, 470, 'vehicle_armored_truck').setDepth(2);
    const beam = this.add.image(car.x + 70, 468, 'fx_light')
      .setTint(0xfff4bc).setBlendMode(Phaser.BlendModes.ADD).setScale(3, 1.2).setAlpha(0.35).setDepth(2);
    this.tweens.add({
      targets: [car, beam], x: `+=${W + 320}`,
      duration: 7200, repeat: -1, repeatDelay: 1200, ease: 'Linear',
    });
    this.tweens.add({ targets: car, y: '+=3', duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ─── Titolo ───────────────────────────────────────────────────────────────────

  private buildTitle() {
    // Alone emissivo morbido dietro il titolo (malato-verde firma, pulsante)
    const glow = this.add.image(W / 2, 148, 'fx_light')
      .setTint(UI.greenSig).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(8, 3).setAlpha(0.16).setDepth(3);
    this.tweens.add({
      targets: glow, alpha: 0.30, scaleX: 9,
      duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Entrata cinematografica: il titolo "atterra" (scala + dissolvenza), poi il sottotitolo
    const title = Ui.text(this, W / 2, 142, 'ZOMBIE ROAD', {
      fontSize: '64px', fontStyle: 'bold', color: '#c8d0a0',
      stroke: '#2a0c08', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(4).setAlpha(0).setScale(1.35);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 650, ease: 'Back.easeOut' });

    const sub = Ui.text(this, W / 2, 196, 'Last Escape', {
      fontSize: '22px', fontStyle: 'italic', color: '#7a8a55',
    }).setOrigin(0.5).setDepth(4).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, y: 200, duration: 500, delay: 450, ease: 'Power2' });
  }

  // ─── Pulsanti ───────────────────────────────────────────────────────────────────

  private buildButtons() {
    const nuova = Ui.button(this, W / 2, 330, 340, 58, 'NUOVA PARTITA', {
      fill: 0x13260f, hover: 0x1f3a17, border: UI.greenSig, color: UI.green,
      fontSize: '24px', scaleOnHover: 1.04, onClick: () => this.newGame(),
    });
    const imp = Ui.button(this, W / 2, 402, 340, 58, 'IMPOSTAZIONI', {
      fill: 0x101826, hover: 0x1a2740, border: UI.blueLine, color: UI.blue,
      fontSize: '24px', scaleOnHover: 1.04, onClick: () => this.openSettings(),
    });
    for (const b of [nuova, imp]) { b.bg.setDepth(10); b.txt.setDepth(11); }
  }

  // ─── Azioni ───────────────────────────────────────────────────────────────────

  private newGame() {
    // Azzera completamente il progresso (stessa logica del game over) e parte da capo.
    this.registry.set('missionNumber', 1);
    this.registry.set('money', 0);
    this.registry.set('survivors', []);
    this.registry.set('upgrades', {});
    this.registry.set('vehicle', 'civilian_car');
    this.registry.set('ownedVehicles', ['civilian_car']);
    this.registry.set('ownedWeapons', ['mg']);
    this.registry.set('currentWeapon', 'mg');
    this.registry.set('components', null);

    Juice.go(this, 'GameScene');
  }

  private openSettings() {
    Juice.go(this, 'SettingsScene');
  }
}
