import Phaser from 'phaser';
import Juice from '../Juice';
import Settings from '../Settings';
import SoundManager from '../SoundManager';
import Ui, { UI } from '../Ui';
import MenuPad, { Focusable } from '../MenuPad';
import { setupCamera, applyBrightness, DESIGN_W, RESOLUTIONS, currentResolution } from '../Config';
import { t, LANGS } from '../i18n';

const H = 600;
const VOL_STEPS = 10;
const BRIGHT_STEPS = 9, BRIGHT_MIN = 0.6, BRIGHT_STEP = 0.1; // luminosità 60%..140% (1.0 = nativo)

// Effetti schermo (post-fx): invece di 6 toggle tecnici sparsi, dei PRESET d'impatto (Off/Minimo/
// Cinematico/Pieno) + un "Avanzato" che rivela i 6 toggle fini. `on` = quali dei 6 flag sono accesi.
type FxKey = 'vignetteFx' | 'grainFx' | 'scanlineFx' | 'gradingFx' | 'aberrationFx' | 'bloom';
const FX_CHIPS: Array<{ k: FxKey; label: string }> = [
  { k: 'vignetteFx',   label: 'settings.vignette' },
  { k: 'grainFx',      label: 'settings.grain' },
  { k: 'scanlineFx',   label: 'settings.scanline' },
  { k: 'gradingFx',    label: 'settings.grading' },
  { k: 'aberrationFx', label: 'settings.aberration' },
  { k: 'bloom',        label: 'settings.bloom' },
];
const FX_PRESETS: Array<{ key: string; label: string; on: FxKey[] }> = [
  { key: 'off',       label: 'settings.fxPresetOff', on: [] },
  { key: 'minimal',   label: 'settings.fxMinimal',   on: ['vignetteFx', 'gradingFx'] },
  { key: 'cinematic', label: 'settings.fxCinematic', on: ['vignetteFx', 'grainFx', 'gradingFx', 'bloom'] },
  { key: 'full',      label: 'settings.fxFull',      on: ['vignetteFx', 'grainFx', 'scanlineFx', 'gradingFx', 'aberrationFx', 'bloom'] },
];

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
  private volCells: Phaser.GameObjects.Rectangle[] = [];
  private volLabel!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private brightCells: Phaser.GameObjects.Rectangle[] = [];
  private brightLabel!: Phaser.GameObjects.Text;
  private preview?: SoundManager;
  /** Larghezza di design (800 in 4:3, maggiore in 16:9). */
  private designW = DESIGN_W;
  /** Elementi navigabili col gamepad (con opzioni ←/→ per slider e selettori), raccolti a ogni create(). */
  private navItems: Array<{ go: Focusable; opts?: { onLeft?: () => void; onRight?: () => void; onActivate?: () => void } }> = [];

  /** Registra un elemento per la navigazione col pad e lo restituisce. */
  private reg<T extends Focusable>(go: T, opts?: { onLeft?: () => void; onRight?: () => void; onActivate?: () => void }): T {
    this.navItems.push({ go, opts });
    return go;
  }

  // ── Effetti schermo: preset + "Avanzato" (riferimenti per l'aggiornamento live, vedi refreshFx) ──
  private fxAdvanced = false; // i 6 toggle fini sono espansi?
  private fxPresetBtns: Array<{ key: string; rect: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text }> = [];
  private fxChips: Array<{ k: FxKey; rect: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text }> = [];
  private fxSummary?: Phaser.GameObjects.Text; // riepilogo del preset attivo (solo quando "Avanzato" è chiuso)

  constructor() { super({ key: 'SettingsScene' }); }

  init(data: { from?: string; page?: SettingsPage; nav?: boolean; fxAdvanced?: boolean }) {
    this.fromKey = data?.from ?? 'MenuScene';
    this.page = data?.page ?? 'hub';
    this.nav = !!data?.nav;
    this.fxAdvanced = !!data?.fxAdvanced;
  }

  create() {
    this.designW = setupCamera(this).designW;
    this.volCells = [];
    this.brightCells = [];
    this.navItems = [];
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

    // Navigazione col gamepad: B = indietro (dall'hub esce, da una categoria torna all'hub).
    const pad = new MenuPad(this).setBack(() => { if (this.page === 'hub') this.goBack(); else this.goPage('hub'); });
    for (const { go, opts } of this.navItems) pad.add(go, opts);

    // Niente fade quando si naviga tra categorie (snappy). I MENU non hanno effetti schermo:
    // il post-processing filmico vive solo in GameScene (vedi Ui.enter), qualunque sia `screenFx`.
    if (!this.nav) Juice.fadeIn(this);

    // L'anteprima audio è per-istanza: a ogni restart (toggle fx/risoluzione/lingua) va smontata,
    // altrimenti lascia un master+limiter appeso al context condiviso (AU7).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.preview?.dispose());
  }

  // ─── Volume ─────────────────────────────────────────────────────────────────

  /** Traccia invisibile sopra le celle di uno slider: regolabile a CLIC o TRASCINANDO il mouse.
   *  `onFrac` riceve la frazione 0..1 (clamp); `onCommit` (opzionale) scatta al rilascio. */
  private dragTrack(startX: number, total: number, yc: number, h: number, onFrac: (f: number) => void, onCommit?: () => void): Phaser.GameObjects.Rectangle {
    const track = this.add.rectangle(startX + total / 2, yc, total, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    const apply = (worldX: number) => onFrac(Phaser.Math.Clamp((worldX - startX) / total, 0, 1));
    let dragging = false;
    track.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; apply(p.worldX); });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (dragging) apply(p.worldX); });
    this.input.on('pointerup', () => { if (dragging) { dragging = false; onCommit?.(); } });
    return track;
  }

  private buildVolume(y: number) {
    const cx = this.designW / 2;
    Ui.text(this, cx - 230, y - 28, t('settings.volume'), { fontSize: '15px', fontStyle: 'bold', color: UI.goldDim });
    this.volLabel = Ui.text(this, cx + 230, y - 28, '', { fontSize: '15px', color: UI.text }).setOrigin(1, 0);

    const cellW = 38, gap = 6, total = VOL_STEPS * cellW + (VOL_STEPS - 1) * gap;
    const startX = cx - total / 2;
    for (let i = 0; i < VOL_STEPS; i++) {
      const x = startX + i * (cellW + gap) + cellW / 2;
      this.volCells.push(this.add.rectangle(x, y + 6, cellW, 30, 0x1a1a24).setStrokeStyle(1, UI.strokeSoft));
    }
    // Clic o TRASCINA per regolare (continuo); l'anteprima sonora suona al RILASCIO (non a ogni frame).
    const track = this.dragTrack(startX, total, y + 6, 34,
      f => { Settings.volume = f; this.refreshVolume(); },
      () => this.playPreview());
    // Col pad: ←/→ regolano a passi di 1/VOL_STEPS; A non fa nulla (no-op, evita il pointerdown della traccia).
    const stepVol = (d: number) => { Settings.volume = Phaser.Math.Clamp(Settings.volume + d / VOL_STEPS, 0, 1); this.refreshVolume(); this.playPreview(); };
    this.reg(track, { onLeft: () => stepVol(-1), onRight: () => stepVol(1), onActivate: () => {} });

    this.muteBtn = Ui.text(this, cx, y + 42, t('settings.mute'), { fontSize: '14px', color: UI.muted })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerover', () => this.muteBtn.setColor(UI.redSoft));
    this.muteBtn.on('pointerout',  () => this.refreshVolume());
    this.muteBtn.on('pointerdown', () => this.setVolume(0));
    this.reg(this.muteBtn);

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
      this.brightCells.push(this.add.rectangle(x, y + 6, cellW, 30, 0x1a1a24).setStrokeStyle(1, UI.strokeSoft));
    }
    // Clic o TRASCINA per regolare (continuo); anteprima live via applyBrightness in setBrightness.
    const bMax = BRIGHT_MIN + (BRIGHT_STEPS - 1) * BRIGHT_STEP;
    const track = this.dragTrack(startX, total, y + 6, 34, f => this.setBrightness(BRIGHT_MIN + f * (bMax - BRIGHT_MIN)));
    const stepBright = (d: number) => this.setBrightness(Phaser.Math.Clamp(Settings.brightness + d * BRIGHT_STEP, BRIGHT_MIN, bMax));
    this.reg(track, { onLeft: () => stepBright(-1), onRight: () => stepBright(1), onActivate: () => {} });
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

  /**
   * Effetti schermo: **preset** (Off/Minimo/Cinematico/Pieno) al posto di 6 toggle tecnici sparsi, con un
   * "Avanzato" che rivela i 6 toggle fini. Aggiornamento **live** (vedi `setFx`/`refreshFx`): il restart
   * scatta solo quando si attraversa la soglia master `screenFx` (l'overlay del menu va ri-attaccato).
   * Ritorna la `y` inferiore così la pagina Grafica può far fluire sotto ombre/asfalto.
   */
  private buildScreenFx(y: number): number {
    const cx = this.designW / 2;
    this.fxPresetBtns = []; this.fxChips = []; this.fxSummary = undefined;
    Ui.text(this, cx - 230, y, t('settings.screenFx'), { fontSize: '15px', fontStyle: 'bold', color: UI.cyan });

    // ── Preset (radio): una combo d'impatto, non 6 interruttori tecnici ──
    const py = y + 28, bw = 102, gap = 8, n = FX_PRESETS.length;
    const sx = cx - (n * bw + (n - 1) * gap) / 2;
    FX_PRESETS.forEach((p, i) => {
      const x = sx + i * (bw + gap) + bw / 2;
      const rect = this.add.rectangle(x, py, bw, 30, 0x14141f).setStrokeStyle(2, UI.blueLine, 0.5).setInteractive({ useHandCursor: true });
      const txt = Ui.text(this, x, py, t(p.label), { fontSize: '12px', fontStyle: 'bold', color: UI.blue }).setOrigin(0.5);
      rect.on('pointerover', () => rect.setFillStyle(0x1d1d2e));
      rect.on('pointerout',  () => this.refreshFx()); // ripristina i colori attivo/inattivo
      rect.on('pointerdown', () => this.applyFxPreset(p));
      this.fxPresetBtns.push({ key: p.key, rect, txt });
      this.reg(rect);
    });

    // ── "Avanzato": espande i 6 toggle fini (restart per ri-layout + ri-registrazione pad) ──
    const expY = py + 28;
    const exp = Ui.text(this, cx - 230, expY, (this.fxAdvanced ? '▾ ' : '▸ ') + t('settings.fxAdvanced'), { fontSize: '12px', color: UI.blueInfo })
      .setInteractive({ useHandCursor: true });
    exp.on('pointerover', () => exp.setColor(UI.white));
    exp.on('pointerout',  () => exp.setColor(UI.blueInfo));
    exp.on('pointerdown', () => this.scene.restart({ from: this.fromKey, page: 'graphics', nav: true, fxAdvanced: !this.fxAdvanced }));
    this.reg(exp);

    let bottom = expY + 18;

    if (this.fxAdvanced) {
      const cols = 3, cw = 146, ch = 30, gapX = 10, gapY = 8;
      const startX = cx - (cols * cw + (cols - 1) * gapX) / 2;
      const chipY0 = expY + 40; // stacco netto dal link "Avanzato" (niente più chip sopra il testo)
      FX_CHIPS.forEach((c, i) => {
        const x = startX + (i % cols) * (cw + gapX) + cw / 2;
        const cyy = chipY0 + Math.floor(i / cols) * (ch + gapY);
        const rect = this.add.rectangle(x, cyy, cw, ch, 0x26262e).setStrokeStyle(2, UI.blueLine, 0.8).setInteractive({ useHandCursor: true });
        const txt = Ui.text(this, x, cyy, t(c.label), { fontSize: '12px', fontStyle: 'bold', color: UI.faint }).setOrigin(0.5);
        rect.on('pointerover', () => rect.setFillStyle(Settings[c.k] ? 0x1d3d22 : 0x32323c));
        rect.on('pointerout',  () => this.refreshFx());
        rect.on('pointerdown', () => this.setFx(() => { Settings[c.k] = !Settings[c.k]; }));
        this.fxChips.push({ k: c.k, rect, txt });
        this.reg(rect);
      });
      bottom = chipY0 + Math.ceil(FX_CHIPS.length / cols) * (ch + gapY);
    } else {
      // Riepilogo del preset attivo (così sai lo stato senza espandere).
      this.fxSummary = Ui.text(this, cx + 230, expY, '', { fontSize: '11px', color: UI.faint }).setOrigin(1, 0);
    }

    this.refreshFx();
    return bottom;
  }

  /** Quale preset corrisponde ESATTAMENTE allo stato corrente dei 6 flag (o 'custom'). */
  private activeFxPreset(): string {
    for (const p of FX_PRESETS) if (FX_CHIPS.every(c => Settings[c.k] === p.on.includes(c.k))) return p.key;
    return 'custom';
  }

  /** Applica un preset: accende/spegne i 6 flag secondo `on`, con la stessa logica soglia-aware di setFx. */
  private applyFxPreset(p: { on: FxKey[] }) {
    this.setFx(() => { for (const c of FX_CHIPS) Settings[c.k] = p.on.includes(c.k); });
  }

  /** Applica un cambiamento agli FX: restart SOLO se la soglia master `screenFx` cambia (l'overlay del menu
   *  va ri-attaccato/staccato); altrimenti aggiorna i colori dal vivo, senza flash. */
  private setFx(apply: () => void) {
    const was = Settings.screenFx;
    apply();
    if (Settings.screenFx !== was) this.scene.restart({ from: this.fromKey, page: 'graphics', nav: true, fxAdvanced: this.fxAdvanced });
    else this.refreshFx();
  }

  /** Ricolora preset (attivo verde) e chip (acceso verde) + il riepilogo, dallo stato corrente di Settings. */
  private refreshFx() {
    const active = this.activeFxPreset();
    for (const b of this.fxPresetBtns) {
      const on = b.key === active;
      b.rect.setFillStyle(on ? 0x16301a : 0x14141f).setStrokeStyle(2, on ? UI.hpHigh : UI.blueLine, on ? 0.9 : 0.5);
      b.txt.setColor(on ? UI.greenSoft : UI.blue);
    }
    for (const c of this.fxChips) {
      const on = Settings[c.k];
      c.rect.setFillStyle(on ? 0x16301a : 0x26262e).setStrokeStyle(2, on ? UI.hpHigh : UI.blueLine, 0.8);
      c.txt.setColor(on ? UI.greenSoft : UI.faint);
    }
    if (this.fxSummary) {
      const p = FX_PRESETS.find(pr => pr.key === active);
      this.fxSummary.setText(p ? t(p.label) : t('settings.fxCustom'));
    }
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

    const label = Ui.text(this, cx + 185, y - 5, res.label, { fontSize: '15px', fontStyle: 'bold', color: UI.blueBright }).setOrigin(0.5);
    Ui.text(this, cx + 185, y + 13, res.aspect, { fontSize: '10px', color: UI.faint }).setOrigin(0.5);
    // Col pad il selettore (label) si focalizza e ←/→ ciclano (A = avanti); le frecce restano per il mouse.
    this.reg(label, { onLeft: () => this.cycleResolution(-1), onRight: () => this.cycleResolution(1), onActivate: () => this.cycleResolution(1) });

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
    const r = RESOLUTIONS[next]!;
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

    this.reg(btn);
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

    this.reg(btn);
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
    const label = Ui.text(this, cx + 185, y + 2, LANGS[idx]!.label, { fontSize: '15px', fontStyle: 'bold', color: UI.blueBright }).setOrigin(0.5);
    this.reg(label, { onLeft: () => this.cycleLanguage(-1), onRight: () => this.cycleLanguage(1), onActivate: () => this.cycleLanguage(1) });

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
    Settings.language = LANGS[next]!.code;
    // In pausa l'HUD vive in GameScene (congelata sotto l'overlay): ricostruiscilo nella nuova lingua.
    if (this.fromKey === 'GameScene') {
      (this.scene.get('GameScene') as Phaser.Scene & { refreshLanguage?: () => void }).refreshLanguage?.();
    }
    this.scene.restart({ from: this.fromKey, page: this.page, nav: true }); // ridisegna l'intera schermata nella nuova lingua
  }

  // ─── Indietro / Riprendi ──────────────────────────────────────────────────────

  private buildBack(inGame: boolean) {
    const by = H / 2 + 236; // dentro il box 540×576 (REG5: prima a H-64 sbordava sotto il pannello)
    this.reg(Ui.button(this, this.designW / 2, by, 240, 46, inGame ? t('settings.resume') : t('settings.back'), {
      fill: 0x14141f, hover: 0x1d1d2e, border: UI.blueLine, color: UI.blue,
      onClick: () => this.goBack(),
    }).bg);

    if (inGame) {
      const exit = Ui.text(this, this.designW / 2, H / 2 + 264, t('settings.exitToMenu'), { fontSize: '12px', color: '#886677' })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      exit.on('pointerover', () => exit.setColor(UI.redSoft));
      exit.on('pointerout',  () => exit.setColor('#886677'));
      exit.on('pointerdown', () => this.exitToMenu());
      this.reg(exit);
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
    this.reg(Ui.button(this, cx, H / 2 - 74, 320, 56, t('settings.catGraphics'), { ...cat, onClick: () => this.goPage('graphics') }).bg);
    this.reg(Ui.button(this, cx, H / 2,      320, 56, t('settings.catAudio'),    { ...cat, onClick: () => this.goPage('audio') }).bg);
    this.reg(Ui.button(this, cx, H / 2 + 74, 320, 56, t('settings.catGeneral'),  { ...cat, onClick: () => this.goPage('general') }).bg);

    this.buildBack(inGame); // Riprendi/ESC (in pausa) o Indietro (dal menu) + "Esci al menu"
  }

  /** Pagina GRAFICA: risoluzione, schermo intero, effetti filmici, bloom, ombre, asfalto. */
  private buildGraphicsPage(inGame: boolean) {
    this.pageHeader(t('settings.catGraphics'));
    this.buildResolution(H / 2 - 170, inGame);
    this.buildFullscreen(H / 2 - 116);
    const fxBottom = this.buildScreenFx(H / 2 - 76); // preset + "Avanzato"; ritorna la y inferiore (dinamica)
    this.buildToggle(fxBottom + 36, t('settings.shadows'), t('settings.shadowsDesc'), () => Settings.shadows,       v => { Settings.shadows = v; });
    this.buildToggle(fxBottom + 88, t('settings.asphalt'), t('settings.asphaltDesc'), () => Settings.asphaltDetail, v => { Settings.asphaltDetail = v; });
    this.pageFooter();
  }

  /** Pagina AUDIO: volume + anteprima sonora. */
  private buildAudioPage() {
    this.pageHeader(t('settings.catAudio'));
    this.buildVolume(H / 2 - 20);
    this.pageFooter();
  }

  /** Pagina GENERALE: lingua + accessibilità (daltonismo) + tutorial. */
  private buildGeneralPage() {
    this.pageHeader(t('settings.catGeneral'));
    this.buildBrightness(H / 2 - 150); // Luminosità: prima opzione in alto
    this.buildLanguage(H / 2 - 40);
    this.buildColorblind(H / 2 + 60);
    // Tutorial di onboarding (docs/TUTORIAL.md): toggle "mostra" = !tutorialSeen. Riusa buildToggle.
    this.buildToggle(H / 2 + 150, t('settings.tutorial'), t('settings.tutorialDesc'),
      () => !Settings.tutorialSeen, v => { Settings.tutorialSeen = !v; });
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
    this.reg(Ui.button(this, this.designW / 2, H / 2 + 236, 240, 46, t('settings.backHub'), {
      fill: 0x14141f, hover: 0x1d1d2e, border: UI.blueLine, color: UI.blue,
      onClick: () => this.goPage('hub'),
    }).bg);
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

    this.reg(btn);
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
