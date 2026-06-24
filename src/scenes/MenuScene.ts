import Phaser from 'phaser';
import Juice from '../Juice';
import Ui, { UI } from '../Ui';
import MenuPad from '../MenuPad';
import { buildVehicleTexture, buildTurretTextures, TURRET_DX } from '../VehicleTextures';
import { setupCamera, DESIGN_W, OVERSAMPLE } from '../Config';
import { resetRunState, getRun, restoreRun } from '../RunState';
import SaveData from '../SaveData';
import { t } from '../i18n';

const H = 600;

/**
 * Schermata del titolo — la prima scena del gioco.
 * Due voci: "Nuova Partita" (azzera il progresso e parte) e "Impostazioni".
 * Stile coerente con l'art bible: notturno desaturato, accenti emissivi firma
 * (malato-verde · arancio-fuoco · rosso-sangue), vignetta + grana, transizioni in dissolvenza.
 */
export default class MenuScene extends Phaser.Scene {
  /** Larghezza di design (800 in 4:3, maggiore in 16:9). */
  private designW = DESIGN_W;

  constructor() { super({ key: 'MenuScene' }); }

  create() {
    this.designW = setupCamera(this).designW;
    Juice.buildTextures(this);
    this.buildBackdrop();
    this.buildAtmosphere();
    this.buildTitle();
    this.buildButtons();

    Ui.text(this, this.designW / 2, 552, t('menu.hint'), {
      fontSize: '12px', color: UI.ghost,
    }).setOrigin(0.5).setDepth(10);

    this.input.keyboard?.on('keydown-ENTER', () => this.hasProgress() ? this.continueGame() : this.newGame());

    Ui.enter(this); // sola dissolvenza; i menu NON hanno effetti schermo (vivono solo in GameScene)
  }

  // ─── Sfondo procedurale (cielo notturno + skyline in rovina) ──────────────────

  private buildBackdrop() {
    const horizon = 300;
    const g = this.add.graphics();

    // Cielo: alto quasi nero → orizzonte blu-grigio malato
    g.fillGradientStyle(0x07070d, 0x07070d, 0x141320, 0x18121e, 1, 1, 1, 1);
    g.fillRect(0, 0, this.designW, horizon);
    // Terreno: leggermente più caldo, scuro
    g.fillStyle(0x090910, 1);
    g.fillRect(0, horizon, this.designW, H - horizon);

    // Skyline in rovina: edifici scuri con rare finestre fioche (1 accento caldo)
    for (let x = -10; x < this.designW + 10; x += Phaser.Math.Between(34, 58)) {
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
    g.fillRect(0, horizon - 1, this.designW, 2);

    // Carreggiata accennata sotto i pulsanti + strisce consumate (texture, non gameplay)
    g.fillStyle(0x111119, 1);
    g.fillRect(0, 360, this.designW, 150);
    for (let sx = 40; sx < this.designW; sx += 110) {
      g.fillStyle(0x3a3520, 0.22);
      g.fillRect(sx, 432, 48, 5);
    }
  }

  // ─── Atmosfera (foschia alla deriva + veicolo che sfreccia) ─────────────────────

  private buildAtmosphere() {
    // Foschia: 3 aloni scuri morbidi che derivano lenti sull'orizzonte (profondità + mood)
    for (let i = 0; i < 3; i++) {
      const fog = this.add.image(Phaser.Math.Between(60, this.designW - 60), Phaser.Math.Between(150, 300), 'fx_light')
        .setTint(0x2a2a3a).setAlpha(0.10).setScale(7, 3).setDepth(1);
      this.tweens.add({
        targets: fog, x: `+=${Phaser.Math.Between(120, 200)}`,
        duration: Phaser.Math.Between(9000, 14000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // Veicolo che attraversa la strada accennata, fari accesi (silhouette del gioco)
    if (!this.textures.exists('vehicle_armored_truck')) buildVehicleTexture(this, 'armored_truck');
    if (!this.textures.exists('aim_turret_mg')) buildTurretTextures(this); // torretta = overlay (combat reboot)
    const car = this.add.image(-150, 470, 'vehicle_armored_truck').setScale(1 / OVERSAMPLE).setDepth(2);
    // Torretta sul mozzo, in avanti (= direzione di marcia): segue auto e dosso con le stesse tween.
    const turret = this.add.image(car.x + (TURRET_DX['armored_truck'] ?? 0), car.y, 'aim_turret_mg')
      .setOrigin(0.11, 0.5).setScale(1 / OVERSAMPLE).setDepth(3);
    const beam = this.add.image(car.x + 70, 468, 'fx_light')
      .setTint(0xfff4bc).setBlendMode(Phaser.BlendModes.ADD).setScale(3, 1.2).setAlpha(0.35).setDepth(2);
    this.tweens.add({
      targets: [car, turret, beam], x: `+=${this.designW + 320}`,
      duration: 7200, repeat: -1, repeatDelay: 1200, ease: 'Linear',
    });
    this.tweens.add({ targets: [car, turret], y: '+=3', duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ─── Titolo ───────────────────────────────────────────────────────────────────

  private buildTitle() {
    // Alone emissivo morbido dietro il titolo (malato-verde firma, pulsante)
    const glow = this.add.image(this.designW / 2, 148, 'fx_light')
      .setTint(UI.greenSig).setBlendMode(Phaser.BlendModes.ADD)
      .setScale(8, 3).setAlpha(0.16).setDepth(3);
    this.tweens.add({
      targets: glow, alpha: 0.30, scaleX: 9,
      duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Entrata cinematografica: il titolo "atterra" (scala + dissolvenza), poi il sottotitolo
    const title = Ui.text(this, this.designW / 2, 142, 'ZOMBIE ROAD', {
      fontSize: '64px', fontStyle: 'bold', color: '#c8d0a0',
      stroke: '#2a0c08', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(4).setAlpha(0).setScale(1.35);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 650, ease: 'Back.easeOut' });

    const sub = Ui.text(this, this.designW / 2, 196, 'Last Escape', {
      fontSize: '22px', fontStyle: 'italic', color: '#7a8a55',
    }).setOrigin(0.5).setDepth(4).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, y: 200, duration: 500, delay: 450, ease: 'Power2' });

    // Record persistente (G5): mostrato solo se è stata giocata almeno una corsa.
    if (SaveData.bestMission > 0) {
      Ui.text(this, this.designW / 2, 234,
        t('menu.record', { mission: SaveData.bestMission, score: SaveData.bestScore }),
        { fontSize: '12px', color: UI.goldDim },
      ).setOrigin(0.5).setDepth(4);
    }
  }

  // ─── Pulsanti ───────────────────────────────────────────────────────────────────

  private buildButtons() {
    const cx = this.designW / 2;
    const prog = this.hasProgress();
    const btns: ReturnType<typeof Ui.button>[] = [];

    if (prog) {
      // C'è una corsa in corso (uscita al menu dalla pausa): "Continua" è l'azione primaria (verde),
      // NUOVA PARTITA è demota a secondaria con avviso che azzera tutto (U12).
      btns.push(Ui.button(this, cx, 312, 340, 54, t('menu.continue'), {
        fill: 0x13260f, hover: 0x1f3a17, border: UI.greenSig, color: UI.green,
        fontSize: '24px', scaleOnHover: 1.04, onClick: () => this.continueGame(),
      }));
      btns.push(Ui.button(this, cx, 378, 340, 50, t('menu.newGame'), {
        fill: 0x101826, hover: 0x1a2740, border: UI.blueLine, color: UI.blue,
        fontSize: '20px', scaleOnHover: 1.04, onClick: () => this.newGame(),
      }));
      Ui.text(this, cx, 408, t('menu.newGameWarn'), { fontSize: '11px', color: UI.faint })
        .setOrigin(0.5).setDepth(11);
      btns.push(Ui.button(this, cx, 446, 340, 50, t('common.settings'), {
        fill: 0x101826, hover: 0x1a2740, border: UI.blueLine, color: UI.blue,
        fontSize: '20px', scaleOnHover: 1.04, onClick: () => this.openSettings(),
      }));
    } else {
      btns.push(Ui.button(this, cx, 330, 340, 58, t('menu.newGame'), {
        fill: 0x13260f, hover: 0x1f3a17, border: UI.greenSig, color: UI.green,
        fontSize: '24px', scaleOnHover: 1.04, onClick: () => this.newGame(),
      }));
      btns.push(Ui.button(this, cx, 402, 340, 58, t('common.settings'), {
        fill: 0x101826, hover: 0x1a2740, border: UI.blueLine, color: UI.blue,
        fontSize: '24px', scaleOnHover: 1.04, onClick: () => this.openSettings(),
      }));
    }
    for (const b of btns) { b.bg.setDepth(10); b.txt.setDepth(11); }

    // Navigazione col gamepad: registra i pulsanti nell'ordine verticale (Start = attiva il focalizzato).
    const nav = new MenuPad(this);
    for (const b of btns) nav.add(b.bg);
  }

  /** Una corsa è in corso se il registry ha stato oltre i default (es. uscita al menu dalla pausa). */
  private hasProgress(): boolean {
    if (SaveData.hasRun()) return true;    // checkpoint su disco → "CONTINUA" anche a freddo (cross-sessione)
    const mn = getRun(this.registry, 'missionNumber');
    if (typeof mn !== 'number') return false;
    return mn > 1
      || (getRun(this.registry, 'money') ?? 0) > 0
      || (getRun(this.registry, 'survivors')?.length ?? 0) > 0
      || (getRun(this.registry, 'ownedWeapons')?.length ?? 1) > 1
      || (getRun(this.registry, 'ownedVehicles')?.length ?? 1) > 1
      || getRun(this.registry, 'components') != null;
  }

  private continueGame() {
    this.registry.set('debugRun', false);  // resume di una corsa reale → persiste normalmente
    const saved = SaveData.loadRun();      // riprende il checkpoint salvato (anche cross-sessione)
    if (saved) restoreRun(this.registry, saved);
    Juice.go(this, 'GameScene');
  }

  // ─── Azioni ───────────────────────────────────────────────────────────────────

  private newGame() {
    // Azzera completamente il progresso: è l'UNICO vero reset (cancella anche il checkpoint salvato).
    SaveData.clearRun();
    this.registry.set('debugRun', false);
    resetRunState(this.registry);
    Juice.go(this, 'GameScene');
  }

  private openSettings() {
    Juice.go(this, 'SettingsScene');
  }
}
