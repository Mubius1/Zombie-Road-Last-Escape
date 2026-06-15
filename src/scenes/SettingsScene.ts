import Phaser from 'phaser';
import Juice from '../Juice';
import Settings from '../Settings';
import SoundManager from '../SoundManager';
import Ui, { UI, MENU_VIGNETTE } from '../Ui';

const W = 800, H = 600;
const VOL_STEPS = 10;

/**
 * Schermata Impostazioni. Due modi d'uso:
 *  · da MENU      → scena a sé, "INDIETRO" torna al menu.
 *  · da PARTITA   → overlay di pausa (ESC in GameScene), "RIPRENDI" riprende il gioco
 *                   sopra la scena congelata; in più "Esci al menu" abbandona la partita.
 *
 * Preferenze persistenti (vedi src/Settings.ts):
 *  · Volume audio  — barra a 10 segmenti + muto, con anteprima sonora.
 *  · Effetti schermo — overlay filmico (vignetta + grana + scanline) on/off.
 */
export default class SettingsScene extends Phaser.Scene {
  private fromKey = 'MenuScene';
  private grain: Phaser.GameObjects.TileSprite | null = null;
  private volCells: Phaser.GameObjects.Rectangle[] = [];
  private volLabel!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private preview?: SoundManager;

  constructor() { super({ key: 'SettingsScene' }); }

  init(data: { from?: string }) {
    this.fromKey = data?.from ?? 'MenuScene';
  }

  create() {
    this.volCells = [];
    const inGame = this.fromKey === 'GameScene';

    // In pausa: fondo semi-trasparente così si intravede la partita congelata.
    this.add.rectangle(W / 2, H / 2, W, H, UI.bg, inGame ? 0.8 : 1);
    Ui.panel(this, W / 2, H / 2, 540, 380, {
      fill: UI.panel, fillAlpha: inGame ? 0.96 : 1, stroke: UI.stroke, strokeWidth: 2,
    });

    if (inGame) {
      Ui.text(this, W / 2, H / 2 - 182, '❚❚  PAUSA', { fontSize: '15px', fontStyle: 'bold', color: UI.faint }).setOrigin(0.5);
    }
    Ui.text(this, W / 2, H / 2 - 158, 'IMPOSTAZIONI', {
      fontSize: '34px', fontStyle: 'bold', color: UI.blue,
    }).setOrigin(0.5);

    this.buildVolume(H / 2 - 70);
    this.buildScreenFx(H / 2 + 36);
    this.buildBack(inGame);

    // L'overlay filmico proprio serve solo a scena piena (dal menu);
    // in pausa quello del gioco è già sotto.
    Juice.fadeIn(this);
    if (!inGame && Settings.screenFx) this.grain = Juice.addOverlay(this, 18, MENU_VIGNETTE);
  }

  update() {
    Juice.jitterGrain(this.grain);
  }

  // ─── Volume ─────────────────────────────────────────────────────────────────

  private buildVolume(y: number) {
    const cx = W / 2;
    Ui.text(this, cx - 230, y - 28, 'VOLUME AUDIO', { fontSize: '15px', fontStyle: 'bold', color: UI.goldDim });
    this.volLabel = Ui.text(this, cx + 230, y - 28, '', { fontSize: '15px', color: UI.text }).setOrigin(1, 0);

    const cellW = 38, gap = 6, total = VOL_STEPS * cellW + (VOL_STEPS - 1) * gap;
    const startX = cx - total / 2;
    for (let i = 0; i < VOL_STEPS; i++) {
      const x = startX + i * (cellW + gap) + cellW / 2;
      const cell = this.add.rectangle(x, y + 6, cellW, 30, 0x1a1a24)
        .setStrokeStyle(1, UI.strokeSoft)
        .setInteractive({ useHandCursor: true });
      cell.on('pointerdown', () => this.setVolume((i + 1) / VOL_STEPS));
      this.volCells.push(cell);
    }

    this.muteBtn = Ui.text(this, cx, y + 42, '🔇  Muto', { fontSize: '14px', color: UI.muted })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerover', () => this.muteBtn.setColor(UI.redSoft));
    this.muteBtn.on('pointerout',  () => this.refreshVolume());
    this.muteBtn.on('pointerdown', () => this.setVolume(0));

    this.refreshVolume();
  }

  private setVolume(v: number) {
    Settings.volume = v;
    this.refreshVolume();
    this.playPreview();
  }

  private refreshVolume() {
    const v = Settings.volume;
    const lit = Math.round(v * VOL_STEPS);
    this.volCells.forEach((cell, i) => cell.setFillStyle(i < lit ? UI.greenCell : 0x1a1a24));
    this.volLabel.setText(v <= 0 ? 'Muto' : `${Math.round(v * 100)}%`);
    this.muteBtn.setColor(v <= 0 ? UI.red : UI.muted);
  }

  /** Suono di prova al volume scelto, così il giocatore sente il livello. */
  private playPreview() {
    const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (!webAudio?.context) return;
    if (!this.preview) this.preview = new SoundManager(webAudio.context);
    this.preview.setVolume(Settings.volume);
    this.preview.playZombieKill();
  }

  // ─── Effetti schermo ─────────────────────────────────────────────────────────

  private buildScreenFx(y: number) {
    const cx = W / 2;
    Ui.text(this, cx - 230, y - 12, 'EFFETTI SCHERMO', { fontSize: '15px', fontStyle: 'bold', color: UI.cyan });
    Ui.text(this, cx - 230, y + 8, 'Vignetta · grana · scanline CRT', { fontSize: '11px', color: UI.faint });

    const on = Settings.screenFx;
    const btn = this.add.rectangle(cx + 190, y + 2, 130, 38, on ? 0x16301a : 0x301616)
      .setStrokeStyle(2, on ? UI.hpHigh : 0x995544, 0.8)
      .setInteractive({ useHandCursor: true });
    Ui.text(this, cx + 190, y + 2, on ? 'ATTIVI' : 'DISATTIVI', {
      fontSize: '16px', fontStyle: 'bold', color: on ? UI.greenSoft : UI.amberSoft,
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(on ? 0x1d3d22 : 0x3d1d1d));
    btn.on('pointerout',  () => btn.setFillStyle(on ? 0x16301a : 0x301616));
    btn.on('pointerdown', () => {
      Settings.screenFx = !Settings.screenFx;
      this.scene.restart({ from: this.fromKey }); // riapplica/rimuove l'overlay all'istante
    });
  }

  // ─── Indietro / Riprendi ──────────────────────────────────────────────────────

  private buildBack(inGame: boolean) {
    const by = H - 64;
    Ui.button(this, W / 2, by, 220, 46, inGame ? '▶  RIPRENDI' : '◂  INDIETRO', {
      fill: 0x14141f, hover: 0x1d1d2e, border: UI.blueLine, color: UI.blue,
      onClick: () => this.goBack(),
    });

    if (inGame) {
      const exit = Ui.text(this, W / 2, H - 26, 'Esci al menu principale', { fontSize: '12px', color: '#886677' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      exit.on('pointerover', () => exit.setColor(UI.redSoft));
      exit.on('pointerout',  () => exit.setColor('#886677'));
      exit.on('pointerdown', () => this.exitToMenu());
    }

    this.input.keyboard?.on('keydown-ESC', () => this.goBack());
  }

  private goBack() {
    if (this.fromKey === 'GameScene') {
      this.scene.resume('GameScene'); // riprende la partita congelata...
      this.scene.stop();              // ...e chiude l'overlay impostazioni
    } else {
      Juice.go(this, 'MenuScene');
    }
  }

  private exitToMenu() {
    this.scene.stop('GameScene'); // abbandona la partita in corso
    Juice.go(this, 'MenuScene');
  }
}
