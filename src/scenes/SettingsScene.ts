import Phaser from 'phaser';
import Juice from '../Juice';
import Settings from '../Settings';
import SoundManager from '../SoundManager';
import Ui, { UI, MENU_VIGNETTE } from '../Ui';
import { setupCamera, DESIGN_W, RESOLUTIONS, currentResolution } from '../Config';
import { t, LANGS } from '../i18n';

const H = 600;
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
  /** Larghezza di design (800 in 4:3, maggiore in 16:9). */
  private designW = DESIGN_W;

  constructor() { super({ key: 'SettingsScene' }); }

  init(data: { from?: string }) {
    this.fromKey = data?.from ?? 'MenuScene';
  }

  create() {
    this.designW = setupCamera(this).designW;
    this.volCells = [];
    const inGame = this.fromKey === 'GameScene';

    // In pausa: fondo semi-trasparente così si intravede la partita congelata.
    this.add.rectangle(this.designW / 2, H / 2, this.designW, H, UI.bg, inGame ? 0.8 : 1);
    // Pannello più alto (576) per ospitare la riga LINGUA in più rispetto alle 5 originali.
    Ui.panel(this, this.designW / 2, H / 2, 540, 576, {
      fill: UI.panel, fillAlpha: inGame ? 0.96 : 1, stroke: UI.stroke, strokeWidth: 2,
    });

    if (inGame) {
      // Etichetta PAUSA leggibile (era UI.faint, troppo spenta) + scorciatoia ESC esplicita (U9).
      Ui.text(this, this.designW / 2, H / 2 - 236, t('settings.paused'), {
        fontSize: '13px', fontStyle: 'bold', color: UI.blue,
      }).setOrigin(0.5);
    }
    Ui.text(this, this.designW / 2, H / 2 - 212, t('common.settings'), {
      fontSize: '34px', fontStyle: 'bold', color: UI.blue,
    }).setOrigin(0.5);

    this.buildVolume(H / 2 - 160);
    this.buildScreenFx(H / 2 - 92);
    this.buildResolution(H / 2 - 28, inGame);
    this.buildFullscreen(H / 2 + 36);
    this.buildColorblind(H / 2 + 100);
    this.buildLanguage(H / 2 + 164);
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
    const cx = this.designW / 2;
    Ui.text(this, cx - 230, y - 28, t('settings.volume'), { fontSize: '15px', fontStyle: 'bold', color: UI.goldDim });
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

    this.muteBtn = Ui.text(this, cx, y + 42, t('settings.mute'), { fontSize: '14px', color: UI.muted })
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
    this.volLabel.setText(v <= 0 ? t('settings.muted') : `${Math.round(v * 100)}%`);
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
    const cx = this.designW / 2;
    Ui.text(this, cx - 230, y - 12, t('settings.screenFx'), { fontSize: '15px', fontStyle: 'bold', color: UI.cyan });
    Ui.text(this, cx - 230, y + 8, t('settings.screenFxDesc'), { fontSize: '11px', color: UI.faint });

    const on = Settings.screenFx;
    const btn = this.add.rectangle(cx + 190, y + 2, 130, 38, on ? 0x16301a : 0x301616)
      .setStrokeStyle(2, on ? UI.hpHigh : 0x995544, 0.8)
      .setInteractive({ useHandCursor: true });
    Ui.text(this, cx + 190, y + 2, on ? t('settings.fxOn') : t('settings.fxOff'), {
      fontSize: '16px', fontStyle: 'bold', color: on ? UI.greenSoft : UI.amberSoft,
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(on ? 0x1d3d22 : 0x3d1d1d));
    btn.on('pointerout',  () => btn.setFillStyle(on ? 0x16301a : 0x301616));
    btn.on('pointerdown', () => {
      Settings.screenFx = !Settings.screenFx;
      this.scene.restart({ from: this.fromKey }); // riapplica/rimuove l'overlay all'istante
    });
  }

  // ─── Risoluzione ──────────────────────────────────────────────────────────────

  private buildResolution(y: number, inGame: boolean) {
    const cx = this.designW / 2;
    Ui.text(this, cx - 230, y - 12, t('settings.resolution'), { fontSize: '15px', fontStyle: 'bold', color: UI.amber });
    Ui.text(this, cx - 230, y + 8, t('settings.resolutionDesc'), { fontSize: '11px', color: UI.faint });

    const res = currentResolution();

    // In pausa il cambio risoluzione riallineerebbe la partita congelata sotto:
    // qui è di sola lettura, si cambia dal menu principale.
    if (inGame) {
      Ui.text(this, cx + 185, y - 4, res.label, { fontSize: '15px', color: UI.muted }).setOrigin(0.5);
      Ui.text(this, cx + 185, y + 14, t('settings.resFromMenu'), { fontSize: '9px', color: UI.faint }).setOrigin(0.5);
      return;
    }

    Ui.text(this, cx + 185, y - 5, res.label, { fontSize: '15px', fontStyle: 'bold', color: UI.blueBright }).setOrigin(0.5);
    Ui.text(this, cx + 185, y + 13, res.aspect, { fontSize: '10px', color: UI.faint }).setOrigin(0.5);

    const arrow = (x: number, char: string, dir: number) => {
      const a = Ui.text(this, x, y + 2, char, { fontSize: '24px', fontStyle: 'bold', color: UI.blue })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      a.on('pointerover', () => a.setColor(UI.white));
      a.on('pointerout',  () => a.setColor(UI.blue));
      a.on('pointerdown', () => this.cycleResolution(dir));
      return a;
    };
    arrow(cx + 100, '◂', -1);
    arrow(cx + 268, '▸', +1);
  }

  private cycleResolution(dir: number) {
    const n = RESOLUTIONS.length;
    const next = ((Settings.resolution % n) + n + dir) % n;
    Settings.resolution = next;
    const r = RESOLUTIONS[next];
    this.scale.setGameSize(r.w, r.h);     // cambia la risoluzione interna nativa
    this.scene.restart({ from: this.fromKey }); // ridisegna il layout alla nuova dimensione
  }

  // ─── Schermo intero ───────────────────────────────────────────────────────────

  private buildFullscreen(y: number) {
    const cx = this.designW / 2;
    Ui.text(this, cx - 230, y - 12, t('settings.fullscreen'), { fontSize: '15px', fontStyle: 'bold', color: UI.cyan });
    Ui.text(this, cx - 230, y + 8, t('settings.fullscreenDesc'), { fontSize: '11px', color: UI.faint });

    const draw = (on: boolean) => ({ fill: on ? 0x16301a : 0x222238, stroke: on ? UI.hpHigh : UI.blueLine });
    let on = this.scale.isFullscreen;
    const d = draw(on);
    const btn = this.add.rectangle(cx + 190, y + 2, 130, 38, d.fill)
      .setStrokeStyle(2, d.stroke, 0.8)
      .setInteractive({ useHandCursor: true });
    const lbl = Ui.text(this, cx + 190, y + 2, on ? t('settings.fsOn') : t('settings.fsOff'), {
      fontSize: '16px', fontStyle: 'bold', color: on ? UI.greenSoft : UI.blue,
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(this.scale.isFullscreen ? 0x1d3d22 : 0x2c2c48));
    btn.on('pointerout',  () => btn.setFillStyle(this.scale.isFullscreen ? 0x16301a : 0x222238));
    btn.on('pointerdown', () => {
      // L'API fullscreen aggiorna isFullscreen in modo asincrono: lo stato intenzionale
      // è semplicemente l'opposto di quello attuale.
      on = !this.scale.isFullscreen;
      this.scale.toggleFullscreen();
      Settings.fullscreen = on;
      const nd = draw(on);
      btn.setFillStyle(nd.fill).setStrokeStyle(2, nd.stroke, 0.8);
      lbl.setText(on ? t('settings.fsOn') : t('settings.fsOff')).setColor(on ? UI.greenSoft : UI.blue);
    });
  }

  // ─── Daltonismo (U5) ───────────────────────────────────────────────────────────

  private buildColorblind(y: number) {
    const cx = this.designW / 2;
    Ui.text(this, cx - 230, y - 12, t('settings.colorblind'), { fontSize: '15px', fontStyle: 'bold', color: UI.cyan });
    Ui.text(this, cx - 230, y + 8, t('settings.colorblindDesc'), { fontSize: '11px', color: UI.faint });

    const draw = (on: boolean) => ({ fill: on ? 0x16301a : 0x222238, stroke: on ? UI.hpHigh : UI.blueLine });
    let on = Settings.colorblind;
    const d = draw(on);
    const btn = this.add.rectangle(cx + 190, y + 2, 130, 38, d.fill)
      .setStrokeStyle(2, d.stroke, 0.8)
      .setInteractive({ useHandCursor: true });
    const lbl = Ui.text(this, cx + 190, y + 2, on ? t('settings.cbOn') : t('settings.cbOff'), {
      fontSize: '15px', fontStyle: 'bold', color: on ? UI.greenSoft : UI.blue,
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(Settings.colorblind ? 0x1d3d22 : 0x2c2c48));
    btn.on('pointerout',  () => btn.setFillStyle(Settings.colorblind ? 0x16301a : 0x222238));
    btn.on('pointerdown', () => {
      on = !Settings.colorblind;
      Settings.colorblind = on;
      const nd = draw(on);
      btn.setFillStyle(nd.fill).setStrokeStyle(2, nd.stroke, 0.8);
      lbl.setText(on ? t('settings.cbOn') : t('settings.cbOff')).setColor(on ? UI.greenSoft : UI.blue);
    });
  }

  // ─── Lingua (i18n) ───────────────────────────────────────────────────────────────

  private buildLanguage(y: number) {
    const cx = this.designW / 2;
    Ui.text(this, cx - 230, y - 12, t('settings.language'), { fontSize: '15px', fontStyle: 'bold', color: UI.blueBright });
    Ui.text(this, cx - 230, y + 8, t('settings.languageDesc'), { fontSize: '11px', color: UI.faint });

    const idx = Math.max(0, LANGS.findIndex(l => l.code === Settings.language));
    Ui.text(this, cx + 185, y + 2, LANGS[idx].label, { fontSize: '15px', fontStyle: 'bold', color: UI.blueBright }).setOrigin(0.5);

    const arrow = (x: number, char: string, dir: number) => {
      const a = Ui.text(this, x, y + 2, char, { fontSize: '24px', fontStyle: 'bold', color: UI.blue })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      a.on('pointerover', () => a.setColor(UI.white));
      a.on('pointerout',  () => a.setColor(UI.blue));
      a.on('pointerdown', () => this.cycleLanguage(dir));
      return a;
    };
    arrow(cx + 100, '◂', -1);
    arrow(cx + 268, '▸', +1);
  }

  private cycleLanguage(dir: number) {
    const n = LANGS.length;
    const idx = Math.max(0, LANGS.findIndex(l => l.code === Settings.language));
    const next = ((idx % n) + n + dir) % n;
    Settings.language = LANGS[next].code;
    // In pausa l'HUD vive in GameScene (congelata sotto l'overlay): ricostruiscilo nella nuova lingua.
    if (this.fromKey === 'GameScene') {
      (this.scene.get('GameScene') as Phaser.Scene & { refreshLanguage?: () => void }).refreshLanguage?.();
    }
    this.scene.restart({ from: this.fromKey }); // ridisegna l'intera schermata nella nuova lingua
  }

  // ─── Indietro / Riprendi ──────────────────────────────────────────────────────

  private buildBack(inGame: boolean) {
    const by = H / 2 + 236; // dentro il box 540×576 (REG5: prima a H-64 sbordava sotto il pannello)
    Ui.button(this, this.designW / 2, by, 240, 46, inGame ? t('settings.resume') : t('settings.back'), {
      fill: 0x14141f, hover: 0x1d1d2e, border: UI.blueLine, color: UI.blue,
      onClick: () => this.goBack(),
    });

    if (inGame) {
      const exit = Ui.text(this, this.designW / 2, H / 2 + 264, t('settings.exitToMenu'), { fontSize: '12px', color: '#886677' })
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
