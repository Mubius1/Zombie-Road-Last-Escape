import Phaser from 'phaser';
import Juice from '../Juice';
import Ui, { UI } from '../Ui';
import MenuPad from '../MenuPad';
import { setupCamera, DESIGN_W } from '../Config';
import { t } from '../i18n';

const H = 600;

/**
 * Menu di pausa (ESC durante la partita). Overlay sopra la GameScene congelata: tre
 * pulsanti nello stesso stile del "RIPRENDI" di SettingsScene —
 *   · Impostazioni            → apre la schermata Impostazioni completa
 *   · Riprendi (ESC)          → riprende la partita
 *   · Esci al menu principale → abbandona la run e torna al menu
 *
 * La GameScene resta in pausa (scene.pause in GameScene.openPauseMenu); riprendendola
 * scatta l'evento RESUME che riallinea volume e riavvia il motore audio.
 */
export default class PauseScene extends Phaser.Scene {
  private designW = DESIGN_W;

  constructor() { super({ key: 'PauseScene' }); }

  create() {
    this.designW = setupCamera(this).designW;
    const cx = this.designW / 2, cy = H / 2;

    // Fondo semi-trasparente: si intravede la partita congelata sotto.
    this.add.rectangle(cx, cy, this.designW, H, UI.bg, 0.72);
    Ui.panel(this, cx, cy, 400, 320, { fill: UI.panel, fillAlpha: 0.96, stroke: UI.stroke, strokeWidth: 2 });

    Ui.text(this, cx, cy - 116, t('settings.paused'), {
      fontSize: '15px', fontStyle: 'bold', color: UI.blue,
    }).setOrigin(0.5);

    // Tre pulsanti, stesso stile del "RIPRENDI" (buildBack di SettingsScene).
    const style = { fill: 0x14141f, hover: 0x1d1d2e, border: UI.blueLine, color: UI.blue } as const;
    const settings = Ui.button(this, cx, cy - 48, 300, 52, t('common.settings'),     { ...style, onClick: () => this.openSettings() });
    const resume   = Ui.button(this, cx, cy + 16, 300, 52, t('settings.resume'),     { ...style, onClick: () => this.resumeGame() });
    const exit     = Ui.button(this, cx, cy + 80, 300, 52, t('settings.exitToMenu'), { ...style, color: UI.redSoft, onClick: () => this.exitToMenu() });

    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame());

    // Navigazione col gamepad (B/Start = riprendi).
    new MenuPad(this)
      .setBack(() => this.resumeGame())
      .setStart(() => this.resumeGame())
      .add(settings.bg).add(resume.bg).add(exit.bg);
  }

  /** Apre le Impostazioni complete (la GameScene resta in pausa sotto). */
  private openSettings() {
    this.scene.launch('SettingsScene', { from: 'GameScene' });
    this.scene.stop(); // chiude il menu di pausa: il ritorno dalle Impostazioni riprende il gioco
  }

  /** Riprende la partita congelata e chiude l'overlay. */
  private resumeGame() {
    this.scene.resume('GameScene'); // → evento RESUME in GameScene: riavvia il motore audio
    this.scene.stop();
  }

  /** Abbandona la run e torna al menu principale. */
  private exitToMenu() {
    this.scene.stop('GameScene');
    Juice.go(this, 'MenuScene');
  }
}
