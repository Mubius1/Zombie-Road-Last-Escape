import Phaser from 'phaser';
import Juice from '../Juice';
import Settings from '../Settings';
import { enterScreen } from '../PostFx';
import SoundManager from '../SoundManager';
import Ui, { UI, MENU_VIGNETTE } from '../Ui';
import { setupCamera, applyBrightness, DESIGN_W, RESOLUTIONS, currentResolution } from '../Config';
import { t, LANGS } from '../i18n';

const H = 600;
const VOL_STEPS = 10;
const BRIGHT_STEPS = 9, BRIGHT_MIN = 0.6, BRIGHT_STEP = 0.1; // luminosità 60%..140% (1.0 = nativo)

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
type SettingsPage = 'hub' | 'graphics' | 'audio' | 'general';

export default class SettingsScene extends Phaser.Scene {
  private fromKey = 'MenuScene';
  private page: SettingsPage = 'hub';   // hub a categorie (struttura AAA)
  private nav = false;                  // true = navigazione tra categorie → niente fade
  private grain: Phaser.GameObjects.TileSprite | null = null;
  private volCells: Phaser.GameObjects.Rectangle[] = [];
  private volLabel!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private brightCells: Phaser.GameObjects.Rectangle[] = [];
  private brightLabel!: Phaser.GameObjects.Text;
  private preview?: SoundManager;
  /** Larghezza di design (800 in 4:3, maggiore in 16:9). */
  private designW = DESIGN_W;

  constructor() { super({ key: 'SettingsScene' }); }

  init(data: { from?: string; page?: SettingsPage; nav?: boolean }) {
    this.fromKey = data?.from ?? 'MenuScene';
    this.page = data?.page ?? 'hub';
    this.nav = !!data?.nav;
  }

  create() {
    this.designW = setupCamera(this).designW;
    this.volCells = [];
    this.brightCells = [];
    const inGame = this.fromKey === 'GameScene';

    // In pausa: fondo semi-trasparente così si intravede la partita congelata.
    this.add.rectangle(this.designW / 2, H / 2, this.designW, H, UI.bg, inGame ? 0.8 : 1);
    // Pannello più alto (576) per ospitare la riga LINGUA in più rispetto alle 5 originali.
    Ui.panel(this, this.designW / 2, H / 2, 540, 576, {
      fill: UI.panel, fillAlpha: inGame ? 0.96 : 1, stroke: UI.stroke, strokeWidth: 2,
    });

    // Etichetta PAUSA solo sull'hub (le pagine categoria hanno il proprio titolo).
    if (inGame && this.page === 'hub') {
      Ui.text(this, this.designW / 2, H / 2 - 236, t('settings.paused'), {
        fontSize: '13px', fontStyle: 'bold', color: UI.blue,
      }).setOrigin(0.5);
    }

    switch (this.page) {
      case 'graphics': this.buildGraphicsPage(inGame); break;
      case 'audio':    this.buildAudioPage(); break;
      case 'general':  this.buildGeneralPage(); break;
      default:         this.buildHub(inGame);
    }

    // L'overlay filmico proprio serve solo a scena piena (dal menu); in pausa quello del
    // gioco è già sotto. Niente fade quando si naviga tra categorie (snappy).
    if (!this.nav) Juice.fadeIn(this);
    if (!inGame && Settings.screenFx) this.grain = enterScreen(this, MENU_VIGNETTE);

    // L'anteprima audio è per-istanza: a ogni restart (toggle fx/risoluzione/lingua) va smontata,
    // altrimenti lascia un master+limiter appeso al context condiviso (AU7).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.preview?.dispose());
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

  // ─── Luminosità ──────────────────────────────────────────────────────────────

  private buildBrightness(y: number) {
    const cx = this.designW / 2;
    Ui.text(this, cx - 230, y - 28, t('settings.brightness'), { fontSize: '15px', fontStyle: 'bold', color: UI.goldDim });
    this.brightLabel = Ui.text(this, cx + 230, y - 28, '', { fontSize: '15px', color: UI.text }).setOrigin(1, 0);

    const cellW = 38, gap = 6, total = BRIGHT_STEPS * cellW + (BRIGHT_STEPS - 1) * gap;
    const startX = cx - total / 2;
    for (let i = 0; i < BRIGHT_STEPS; i++) {
      const x = startX + i * (cellW + gap) + cellW / 2;
      const cell = this.add.rectangle(x, y + 6, cellW, 30, 0x1a1a24)
        .setStrokeStyle(1, UI.strokeSoft)
        .setInteractive({ useHandCursor: true });
      cell.on('pointerdown', () => this.setBrightness(BRIGHT_MIN + i * BRIGHT_STEP));
      this.brightCells.push(cell);
    }
    Ui.text(this, cx - 230, y + 30, t('settings.brightnessDesc'), { fontSize: '11px', color: UI.faint });
    this.refreshBrightness();
  }

  private setBrightness(v: number) {
    Settings.brightness = v;
    this.refreshBrightness();
    applyBrightness(this); // anteprima live sull'intero schermo
  }

  private refreshBrightness() {
    const v = Settings.brightness;
    const idx = Math.round((v - BRIGHT_MIN) / BRIGHT_STEP);
    this.brightCells.forEach((cell, i) => cell.setFillStyle(i <= idx ? 0xc8a84a : 0x1a1a24));
    this.brightLabel.setText(`${Math.round(v * 100)}%`);
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
      this.scene.restart({ from: this.fromKey, page: this.page, nav: true }); // riapplica/rimuove l'overlay all'istante
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
    this.scene.restart({ from: this.fromKey, page: this.page, nav: true }); // ridisegna il layout alla nuova dimensione
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
    this.scene.restart({ from: this.fromKey, page: this.page, nav: true }); // ridisegna l'intera schermata nella nuova lingua
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

  // ─── Hub a categorie (struttura AAA) ────────────────────────────────────────────

  /** Hub: titolo + tre categorie (Grafica · Audio · Generale) + Riprendi/Indietro. */
  private buildHub(inGame: boolean) {
    const cx = this.designW / 2;
    Ui.text(this, cx, H / 2 - 212, t('common.settings'), {
      fontSize: '34px', fontStyle: 'bold', color: UI.blue,
    }).setOrigin(0.5);

    const cat = { fill: 0x14141f, hover: 0x1d1d2e, border: UI.blueLine, color: UI.blue } as const;
    Ui.button(this, cx, H / 2 - 74, 320, 56, t('settings.catGraphics'), { ...cat, onClick: () => this.goPage('graphics') });
    Ui.button(this, cx, H / 2,      320, 56, t('settings.catAudio'),    { ...cat, onClick: () => this.goPage('audio') });
    Ui.button(this, cx, H / 2 + 74, 320, 56, t('settings.catGeneral'),  { ...cat, onClick: () => this.goPage('general') });

    this.buildBack(inGame); // Riprendi/ESC (in pausa) o Indietro (dal menu) + "Esci al menu"
  }

  /** Pagina GRAFICA: risoluzione, schermo intero, effetti filmici, bloom, ombre, asfalto. */
  private buildGraphicsPage(inGame: boolean) {
    this.pageHeader(t('settings.catGraphics'));
    this.buildResolution(H / 2 - 150, inGame);
    this.buildFullscreen(H / 2 - 88);
    this.buildScreenFx(H / 2 - 26);
    this.buildToggle(H / 2 + 36,  t('settings.bloom'),   t('settings.bloomDesc'),   () => Settings.bloom,         v => { Settings.bloom = v; });
    this.buildToggle(H / 2 + 98,  t('settings.shadows'), t('settings.shadowsDesc'), () => Settings.shadows,       v => { Settings.shadows = v; });
    this.buildToggle(H / 2 + 160, t('settings.asphalt'), t('settings.asphaltDesc'), () => Settings.asphaltDetail, v => { Settings.asphaltDetail = v; });
    this.pageFooter();
  }

  /** Pagina AUDIO: volume + anteprima sonora. */
  private buildAudioPage() {
    this.pageHeader(t('settings.catAudio'));
    this.buildVolume(H / 2 - 20);
    this.pageFooter();
  }

  /** Pagina GENERALE: lingua + accessibilità (daltonismo). */
  private buildGeneralPage() {
    this.pageHeader(t('settings.catGeneral'));
    this.buildLanguage(H / 2 - 120);
    this.buildBrightness(H / 2 + 10);
    this.buildColorblind(H / 2 + 130);
    this.pageFooter();
  }

  /** Titolo di categoria + ESC torna all'hub (back di un livello). */
  private pageHeader(title: string) {
    Ui.text(this, this.designW / 2, H / 2 - 212, title, {
      fontSize: '34px', fontStyle: 'bold', color: UI.blue,
    }).setOrigin(0.5);
    this.input.keyboard?.on('keydown-ESC', () => this.goPage('hub'));
  }

  /** Pulsante "‹ Categorie" → hub (stessa posizione di INDIETRO/RIPRENDI). */
  private pageFooter() {
    Ui.button(this, this.designW / 2, H / 2 + 236, 240, 46, t('settings.backHub'), {
      fill: 0x14141f, hover: 0x1d1d2e, border: UI.blueLine, color: UI.blue,
      onClick: () => this.goPage('hub'),
    });
  }

  /** Toggle booleano generico (opzioni Grafica): aggiornamento in-place, niente restart. */
  private buildToggle(y: number, label: string, desc: string, get: () => boolean, set: (v: boolean) => void) {
    const cx = this.designW / 2;
    Ui.text(this, cx - 230, y - 12, label, { fontSize: '15px', fontStyle: 'bold', color: UI.cyan });
    Ui.text(this, cx - 230, y + 8, desc, { fontSize: '11px', color: UI.faint });

    const fillOn = 0x16301a, fillOff = 0x222238;
    let on = get();
    const btn = this.add.rectangle(cx + 190, y + 2, 130, 38, on ? fillOn : fillOff)
      .setStrokeStyle(2, on ? UI.hpHigh : UI.blueLine, 0.8)
      .setInteractive({ useHandCursor: true });
    const lbl = Ui.text(this, cx + 190, y + 2, on ? t('settings.cbOn') : t('settings.cbOff'), {
      fontSize: '15px', fontStyle: 'bold', color: on ? UI.greenSoft : UI.blue,
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(get() ? 0x1d3d22 : 0x2c2c48));
    btn.on('pointerout',  () => btn.setFillStyle(get() ? fillOn : fillOff));
    btn.on('pointerdown', () => {
      on = !get(); set(on);
      btn.setFillStyle(on ? fillOn : fillOff).setStrokeStyle(2, on ? UI.hpHigh : UI.blueLine, 0.8);
      lbl.setText(on ? t('settings.cbOn') : t('settings.cbOff')).setColor(on ? UI.greenSoft : UI.blue);
    });
  }

  /** Naviga a una pagina/hub: restart della stessa scena senza fade (snappy). */
  private goPage(page: SettingsPage) {
    this.scene.restart({ from: this.fromKey, page, nav: true });
  }
}
