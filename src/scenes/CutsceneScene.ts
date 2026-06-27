import Phaser from 'phaser';
import Ui from '../Ui';
import Juice from '../Juice';
import { setupCamera, DESIGN_H } from '../Config';
import { t } from '../i18n';

/**
 * Filmati "motion comic" diegetici — pannelli dipinti 100% in codice (Graphics + aloni additivi),
 * Ken Burns con PARALLASSE multi-piano, tratteggio/grana/lettera-box filmici, didascalie a macchina
 * da scrivere. Coerente coi vincoli del progetto: nessun PNG, nessun video, tutto procedurale.
 *
 * È un PLAYER generico guidato dai dati (`SEQUENCES`): la scena riceve `{ cutscene, next }` da
 * `scene.start`, riproduce la sequenza di beat e poi avvia `next`. Oggi esiste solo il **prologo**
 * (alla Nuova Partita); le soste e gli epiloghi si aggiungeranno come nuovi pannelli + sequenze, non
 * ri-architettando la scena.
 *
 * Revertibile: spegni `PROLOGUE_ENABLED` (il gioco torna identico) o cancella questo file + la riga di
 * aggancio in MenuScene + la registrazione in game.ts.
 *
 * Stile: vedi prototipo `prototypes/motion-comic.html` (fonte della direzione visiva).
 */

/** Interruttori di feature: false = il gioco salta del tutto il filmato (revert immediato). */
export const PROLOGUE_ENABLED = true;
export const EPILOGUE_ENABLED = true;

const H = DESIGN_H;            // 600 — lo spazio di design è alto fisso
const FADE = 700;             // ms dissolvenza in/out di ogni beat

type PanelId = 'city' | 'radio' | 'collapse' | 'convoy' | 'title' | 'refuge' | 'card';
type Mood = 'gold' | 'grey' | 'cold' | 'ash';
interface KB { z0: number; z1: number; panX: number; panY: number; fx: number; fy: number; }
interface Beat { panel: PanelId; captionKey?: string; text?: string; sub?: string; mood?: Mood; hintKey?: string; title?: boolean; dur: number; kb: KB; }
interface Layer { z: number; node: Phaser.GameObjects.Container; }

/** Dati di esito passati da GameScene per comporre l'epilogo (filmati finali, §6 NARRATIVA_PERSONAGGI). */
export interface EpiData { endKey: 'convoy' | 'few' | 'alone' | 'fallen'; cards: string[]; survivors: number; fallen: string; score: number; earned: number; }

/** Palette del rifugio per esito: l'alba è calda se arrivi in molti, spenta se il rifugio è caduto. */
const REFUGE_PAL: Record<Mood, { skyTop: number; skyBot: number; dawn: number; dawnA: number; wall: number; gateLight: number | null; mote: number }> = {
  gold: { skyTop: 0x14181f, skyBot: 0x6b4a22, dawn: 0xffcf7a, dawnA: 0.5,  wall: 0x141820, gateLight: 0xffcf7a, mote: 0xffe0a0 },
  grey: { skyTop: 0x12151a, skyBot: 0x3a3d42, dawn: 0xaebccc, dawnA: 0.4,  wall: 0x14171c, gateLight: 0xbcd0e0, mote: 0x9aa6b4 },
  cold: { skyTop: 0x0a0d14, skyBot: 0x1a2230, dawn: 0x5a7fa8, dawnA: 0.35, wall: 0x0e1219, gateLight: 0x5a7fa8, mote: 0x6a86a8 },
  ash:  { skyTop: 0x0c0a0a, skyBot: 0x2a140e, dawn: 0xc0531f, dawnA: 0.5,  wall: 0x0c0a0a, gateLight: null,     mote: 0xff6a30 },
};

/** Compone i beat dell'epilogo dai dati di esito: il rifugio (esito convoglio) + una carta per sopravvissuto + il referto. */
function buildEpilogueBeats(epi: EpiData): Beat[] {
  const moodByEnd: Record<EpiData['endKey'], Mood> = { convoy: 'gold', few: 'grey', alone: 'cold', fallen: 'ash' };
  // 'alone' ha due varianti: senza caduti (mai reclutato → niente "i tuoi morti") vs con caduti.
  const lineKey = epi.endKey === 'alone' && !epi.fallen
    ? 'campaign.ending.alone.lineNoLoss'
    : `campaign.ending.${epi.endKey}.line`;
  const sub = [
    t(lineKey),
    t('campaign.survivorsArrived', { n: epi.survivors }),
    epi.fallen ? t('campaign.fallen', { names: epi.fallen }) : '',
  ].filter(Boolean).join('\n');

  const beats: Beat[] = [
    { panel: 'refuge', mood: moodByEnd[epi.endKey], title: true, text: t(`campaign.ending.${epi.endKey}.title`), sub, dur: 12000,
      kb: { z0: 1.10, z1: 1.22, panX: 0.0, panY: -0.02, fx: 0.5, fy: 0.42 } },
  ];
  for (const k of epi.cards) beats.push({ panel: 'card', text: t(k), dur: 8500,
    kb: { z0: 1.12, z1: 1.22, panX: 0.02, panY: 0.0, fx: 0.5, fy: 0.55 } });
  beats.push({ panel: 'card', title: true, text: t('game.scoreLine', { n: epi.score }),
    sub: t('game.coinsEarned', { n: epi.earned }),
    hintKey: 'cutscene.toMenu', dur: 20000, kb: { z0: 1.05, z1: 1.12, panX: 0.0, panY: 0.0, fx: 0.5, fy: 0.5 } });
  return beats;
}

/** Le sequenze di filmato, indicizzate per id (passato in `scene.start(... { cutscene })`). */
const SEQUENCES: Record<string, Beat[]> = {
  prologue: [
    { panel: 'city',     captionKey: 'prologue.line1', dur: 9500,  kb: { z0: 1.12, z1: 1.26, panX: -0.022, panY: 0.018, fx: 0.45, fy: 0.52 } },
    { panel: 'radio',    captionKey: 'prologue.line2', dur: 9000,  kb: { z0: 1.14, z1: 1.24, panX: 0.030, panY: 0.000, fx: 0.60, fy: 0.55 } },
    { panel: 'collapse', captionKey: 'prologue.line3', dur: 9500,  kb: { z0: 1.10, z1: 1.30, panX: 0.020, panY: -0.026, fx: 0.66, fy: 0.32 } },
    { panel: 'convoy',   captionKey: 'prologue.line4', dur: 10000, kb: { z0: 1.16, z1: 1.24, panX: 0.000, panY: 0.020, fx: 0.50, fy: 0.60 } },
    { panel: 'title',    captionKey: 'prologue.title', dur: 12000, kb: { z0: 1.06, z1: 1.14, panX: 0.000, panY: 0.000, fx: 0.50, fy: 0.52 }, title: true },
  ],
};

type GfxTex = Phaser.GameObjects.Graphics & { generateTexture(k: string, w: number, h: number): void };

export default class CutsceneScene extends Phaser.Scene {
  private designW = 800;
  private next = 'GameScene';
  private seq: Beat[] = SEQUENCES['prologue']!;
  private index = 0;
  private transitioning = false;

  private beatRoot?: Phaser.GameObjects.Container;
  private caption?: Phaser.GameObjects.Text;
  private subCaption?: Phaser.GameObjects.Text;
  private startHint?: Phaser.GameObjects.Text;
  private grain: Phaser.GameObjects.TileSprite | null = null;
  private autoTimer?: Phaser.Time.TimerEvent;
  private beatTweens: Phaser.Tweens.Tween[] = [];
  private beatTimers: Phaser.Time.TimerEvent[] = [];
  // Stato bottoni pad (edge-trigger in update). Inizializzati a quello corrente così un tasto tenuto dal
  // menu — es. lo Start/A che ha avviato la partita — non conta come pressione fresca qui.
  private prevPadA = false; private prevPadB = false; private prevPadStart = false;

  constructor() { super({ key: 'CutsceneScene' }); }

  init(data: { cutscene?: string; next?: string; beats?: Beat[]; epi?: EpiData }) {
    this.next = data.next ?? 'GameScene';
    if (data.cutscene === 'epilogue' && data.epi) this.seq = buildEpilogueBeats(data.epi);
    else if (Array.isArray(data.beats)) this.seq = data.beats;
    else this.seq = SEQUENCES[data.cutscene ?? 'prologue'] ?? SEQUENCES['prologue']!;
    this.index = 0;
    this.transitioning = false;
  }

  create() {
    this.designW = setupCamera(this).designW;
    this.cameras.main.setBackgroundColor('#000000');
    Juice.buildTextures(this);

    // I test E2E (e qualunque flusso che voglia bypassare i filmati) impostano questo flag sul registry.
    if (this.registry.get('skipCutscenes')) { this.transitioning = true; this.scene.start(this.next); return; }

    this.buildHatchTexture();
    this.buildOverlays();
    this.buildSkipHint();

    // Ingresso: clic/SPAZIO/A = avanti · ESC/INVIO/B/Start = salta tutto (mouse, tastiera E pad).
    this.input.on('pointerdown', () => this.advance());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ESC', () => this.skip());
    this.input.keyboard?.on('keydown-ENTER', () => this.skip());
    const pad = this.input.gamepad?.getPad(0);
    this.prevPadA = !!pad?.A; this.prevPadB = !!pad?.B; this.prevPadStart = !!pad?.buttons[9]?.pressed;

    Juice.fadeIn(this, 450);
    this.playBeat(0);
  }

  override update() {
    Juice.jitterGrain(this.grain);
    this.pollPad();
  }

  /** Pad (edge-trigger, mapping standard): B/Start saltano il filmato, A avanza — coerente coi menu. */
  private pollPad() {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad?.connected) return;
    const a = !!pad.A, b = !!pad.B, st = !!pad.buttons[9]?.pressed;
    if ((b && !this.prevPadB) || (st && !this.prevPadStart)) this.skip();
    else if (a && !this.prevPadA) this.advance();
    this.prevPadA = a; this.prevPadB = b; this.prevPadStart = st;
  }

  // ─── Flusso a beat ──────────────────────────────────────────────────────────

  private playBeat(i: number) {
    const beat = this.seq[i];
    if (!beat) { this.finish(); return; }
    this.index = i;
    this.transitioning = false;

    const root = this.add.container(0, 0).setDepth(2).setAlpha(0);
    for (const layer of this.buildPanel(beat)) {
      root.add(layer.node);
      this.applyKenBurns(layer, beat.kb, beat.dur);
    }
    this.beatRoot = root;
    this.pushTween({ targets: root, alpha: 1, duration: FADE, ease: 'Linear' });

    this.buildCaption(beat);
    this.autoTimer = this.time.delayedCall(beat.dur, () => this.advance());
  }

  /** Avanza al beat successivo (o avvia il gioco se è l'ultimo). Clic/SPAZIO o auto-avanzamento. */
  private advance() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.autoTimer?.remove();
    const wasLast = this.index >= this.seq.length - 1;
    const targets = [this.beatRoot, this.caption, this.subCaption, this.startHint].filter(Boolean);
    this.pushTween({
      targets, alpha: 0, duration: FADE, ease: 'Linear',
      onComplete: () => {
        this.teardownBeat();
        if (wasLast) this.finish(); else this.playBeat(this.index + 1);
      },
    });
  }

  /** Salta l'intero filmato (ESC / INVIO). */
  private skip() {
    if (this.transitioning) return;
    this.transitioning = true;
    Juice.go(this, this.next);
  }

  private finish() { Juice.go(this, this.next); }

  private teardownBeat() {
    for (const tw of this.beatTweens) tw.remove();
    for (const tm of this.beatTimers) tm.remove();
    this.beatTweens = [];
    this.beatTimers = [];
    this.beatRoot?.destroy(); this.beatRoot = undefined;
    this.caption?.destroy(); this.caption = undefined;
    this.subCaption?.destroy(); this.subCaption = undefined;
    this.startHint?.destroy(); this.startHint = undefined;
  }

  private pushTween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const tw = this.tweens.add(cfg);
    this.beatTweens.push(tw);
    return tw;
  }

  /**
   * Ken Burns + parallasse: ogni piano (z 0=fondale … 1=primo piano) zooma e deriva di più quanto più è
   * vicino. Lo zoom è ancorato al punto focale (fx,fy): essendo scala e posizione lineari nel parametro,
   * basta interpolarli con la stessa ease perché il fuoco resti fisso.
   */
  private applyKenBurns(layer: Layer, kb: KB, dur: number) {
    const w = this.designW, f = 0.97 + layer.z * 0.15;
    const s0 = kb.z0 * f, s1 = kb.z1 * f;
    const px = kb.fx * w, py = kb.fy * H;
    const panX = kb.panX * w * (0.15 + layer.z), panY = kb.panY * H * (0.15 + layer.z);
    layer.node.setScale(s0).setPosition(px * (1 - s0), py * (1 - s0));
    this.pushTween({
      targets: layer.node,
      x: px * (1 - s1) + panX, y: py * (1 - s1) + panY, scaleX: s1, scaleY: s1,
      duration: dur, ease: 'Sine.easeInOut',
    });
  }

  // ─── Didascalie (dissolvenza + macchina da scrivere) ────────────────────────

  private buildCaption(beat: Beat) {
    const serif = 'Georgia, "Times New Roman", serif';
    const body = beat.captionKey ? t(beat.captionKey) : (beat.text ?? '');
    const isLast = this.index >= this.seq.length - 1;
    if (beat.title) {
      this.caption = Ui.text(this, this.designW / 2, beat.sub ? 232 : 264, '', {
        fontFamily: serif, fontSize: '48px', fontStyle: 'bold', color: '#f0ead8', align: 'center',
        wordWrap: { width: this.designW * 0.86 },
      }).setOrigin(0.5).setDepth(20).setAlpha(0).setShadow(0, 2, '#000000', 12, false, true);
    } else {
      this.caption = Ui.text(this, this.designW / 2, 502, '', {
        fontFamily: serif, fontSize: '26px', fontStyle: 'italic', color: '#e6ddcb', align: 'center',
        wordWrap: { width: this.designW * 0.82 },
      }).setOrigin(0.5).setDepth(20).setAlpha(0).setShadow(0, 2, '#000000', 10, false, true);
    }
    this.pushTween({ targets: this.caption, alpha: 1, duration: FADE, ease: 'Linear' });

    const cps = beat.title ? 13 : 30;
    let n = 0;
    this.beatTimers.push(this.time.addEvent({
      delay: Math.round(1000 / cps), repeat: body.length - 1,
      callback: () => {
        n++; this.caption?.setText(body.slice(0, n));
        if (n >= body.length) {
          if (beat.sub) this.showSub(beat.sub, serif);
          if (isLast) this.showEndHint(beat.hintKey ?? 'prologue.start');
        }
      },
    }));
  }

  /** Sotto-didascalia (sotto un titolo): la riga d'esito + conteggi dell'epilogo. Appare dopo il titolo. */
  private showSub(text: string, serif: string) {
    if (this.subCaption) return;
    this.subCaption = Ui.text(this, this.designW / 2, 312, text, {
      fontFamily: serif, fontSize: '17px', color: '#cbbfa6', align: 'center', wordWrap: { width: this.designW * 0.78 },
    }).setOrigin(0.5, 0).setDepth(20).setAlpha(0).setShadow(0, 2, '#000000', 8, false, true);
    this.pushTween({ targets: this.subCaption, alpha: 0.95, duration: 700, ease: 'Linear' });
  }

  /** Prompt finale lampeggiante (solo sull'ultimo beat): "clic per cominciare" / "…tornare al menu". */
  private showEndHint(key: string) {
    if (this.startHint) return;
    this.startHint = Ui.text(this, this.designW / 2, this.subCaption ? 430 : 336, t(key), { fontSize: '14px', color: '#b9b1a0' })
      .setOrigin(0.5).setDepth(20).setAlpha(0.3);
    this.pushTween({ targets: this.startHint, alpha: 0.85, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ─── Pannelli (pile di piani) ───────────────────────────────────────────────

  private buildPanel(beat: Beat): Layer[] {
    switch (beat.panel) {
      case 'city': return this.panelCity();
      case 'radio': return this.panelRadio();
      case 'collapse': return this.panelCollapse();
      case 'convoy': return this.panelConvoy();
      case 'title': return this.panelTitle();
      case 'refuge': return this.panelRefuge(beat.mood ?? 'grey');
      case 'card': return this.panelCard();
    }
  }

  /** Crea un piano (container + Graphics già dentro) al dato z. */
  private mk(z: number): { z: number; node: Phaser.GameObjects.Container; g: Phaser.GameObjects.Graphics } {
    const node = this.add.container(0, 0);
    const g = this.add.graphics();
    node.add(g);
    return { z, node, g };
  }

  private sky(g: Phaser.GameObjects.Graphics, top: number, bot: number) {
    g.fillGradientStyle(top, top, bot, bot, 1, 1, 1, 1);
    g.fillRect(-80, -80, this.designW + 160, H + 160);
  }

  private glow(node: Phaser.GameObjects.Container, x: number, y: number, r: number, color: number, alpha: number) {
    const img = this.add.image(x, y, 'fx_light').setTint(color).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(r * 2, r * 2).setAlpha(alpha);
    node.add(img);
    return img;
  }

  private pulse(img: Phaser.GameObjects.Image, to: number, ms: number) {
    this.pushTween({ targets: img, alpha: to, duration: ms, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private skyline(g: Phaser.GameObjects.Graphics, baseY: number, hMin: number, hMax: number,
                  fill: number, density: number, win: number | null, winChance: number, rim: number | null) {
    let x = -20;
    while (x < this.designW + 20) {
      const bw = Phaser.Math.Between(34, 92), bh = Phaser.Math.Between(hMin, hMax);
      g.fillStyle(fill, 1); g.fillRect(x, baseY - bh, bw, bh + 70);
      if (rim !== null) { g.lineStyle(1.5, rim, 0.5); g.lineBetween(x, baseY - bh, x + bw, baseY - bh); }
      if (win !== null) {
        for (let wy = baseY - bh + 9; wy < baseY - 7; wy += 13)
          for (let wx = x + 6; wx < x + bw - 6; wx += 11)
            if (Math.random() < winChance) { g.fillStyle(win, 0.5 + Math.random() * 0.45); g.fillRect(wx, wy, 4, 6); }
      }
      x += bw * density;
    }
  }

  /**
   * Sagoma UMANA in piedi: busto con spalle inclinate + collo, e **testa tonda staccata** (cerchio).
   * `ws<0.9` = bambino → testa proporzionalmente più grande e corpo più piccolo (così adulto e bambino
   * si distinguono, es. nella scena della radio). `rim` = filo di luce/inchiostro sul contorno.
   */
  private figure(g: Phaser.GameObjects.Graphics, x: number, footY: number, h: number, ws: number, rim: number | null) {
    const child = ws < 0.9;
    const shoulderW = h * 0.30 * ws;
    const hipW = shoulderW * 0.82;
    const neckW = shoulderW * 0.34;
    const shoulderY = footY - h * 0.64;
    const neckTopY = footY - h * 0.80;
    const headR = h * (child ? 0.115 : 0.085);
    const headCy = neckTopY - headR * 0.55;            // testa appoggiata al collo (si sovrappone → collegata)

    // Busto (fianchi → spalle inclinate → collo)
    g.beginPath();
    g.moveTo(x - hipW / 2, footY);
    g.lineTo(x - shoulderW / 2, shoulderY);
    g.lineTo(x - shoulderW * 0.34, shoulderY - h * 0.05);
    g.lineTo(x - neckW / 2, neckTopY);
    g.lineTo(x + neckW / 2, neckTopY);
    g.lineTo(x + shoulderW * 0.34, shoulderY - h * 0.05);
    g.lineTo(x + shoulderW / 2, shoulderY);
    g.lineTo(x + hipW / 2, footY);
    g.closePath();
    g.fillStyle(0x04050a, 1); g.fillPath();
    if (rim !== null) { g.lineStyle(2, rim, 0.5); g.strokePath(); }

    // Testa (cerchio)
    g.fillStyle(0x04050a, 1); g.fillCircle(x, headCy, headR);
    if (rim !== null) { g.lineStyle(2, rim, 0.5); g.strokeCircle(x, headCy, headR); }
  }

  /** Sagoma curva (zombi controluce). */
  private hunched(g: Phaser.GameObjects.Graphics, x: number, footY: number, h: number, rim: number | null) {
    g.beginPath();
    g.moveTo(x - 11, footY);
    g.lineTo(x - 13, footY - h * 0.55);
    g.lineTo(x + 4, footY - h * 0.82);
    g.lineTo(x + 14, footY - h * 0.78);
    g.lineTo(x + 12, footY - h * 0.5);
    g.lineTo(x + 11, footY);
    g.closePath();
    g.fillStyle(0x010204, 1); g.fillPath();
    if (rim !== null) { g.lineStyle(2, rim, 0.45); g.strokePath(); }
  }

  /** Particelle additive (braci/polvere) che salgono in loop. */
  private moteField(node: Phaser.GameObjects.Container, count: number,
                    area: { x: number; y: number; w: number; h: number },
                    color: number, sizeMin: number, sizeMax: number, riseMs: number, sway: number) {
    for (let i = 0; i < count; i++) {
      const x = area.x + Math.random() * area.w, y = area.y + Math.random() * area.h;
      const s = sizeMin + Math.random() * (sizeMax - sizeMin);
      const m = this.add.image(x, y, 'fx_light').setTint(color).setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(s * 2, s * 2).setAlpha(0);
      node.add(m);
      const dur = riseMs * (0.7 + Math.random() * 0.6), delay = Math.random() * riseMs;
      this.pushTween({ targets: m, y: y - area.h, duration: dur, delay, repeat: -1, ease: 'Linear' });
      this.pushTween({ targets: m, alpha: 0.8, duration: dur / 2, delay, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (sway > 0) this.pushTween({ targets: m, x: x + sway, duration: dur / 2, delay, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ── 1 · la città, prima ──
  private panelCity(): Layer[] {
    const w = this.designW;
    const l0 = this.mk(0.0);
    this.sky(l0.g, 0x0c0f15, 0x3a2f2a);
    this.glow(l0.node, w * 0.72, H * 0.74, H * 0.62, 0x9a5a30, 0.5);
    l0.g.lineStyle(1.5, 0x12161c, 0.8);
    for (let i = 0; i < 6; i++) {
      const bx = 120 + Math.random() * (w - 240), by = 70 + Math.random() * 90, s = 6 + Math.random() * 5;
      l0.g.lineBetween(bx - s, by, bx, by - s * 0.5); l0.g.lineBetween(bx, by - s * 0.5, bx + s, by);
    }
    const l1 = this.mk(0.35); this.skyline(l1.g, H * 0.80, 70, 150, 0x1a1f29, 1.02, 0xffc878, 0.10, 0x5a4630);
    const l2 = this.mk(0.60); this.skyline(l2.g, H * 0.86, 110, 220, 0x11151d, 0.92, 0xffbe6e, 0.16, 0x6e4a30);
    const l3 = this.mk(0.92); this.skyline(l3.g, H * 0.97, 150, 300, 0x080b10, 0.88, 0xffcd82, 0.22, 0x463830);
    return [l0, l1, l2, l3];
  }

  // ── 2 · la radio mente ──
  private panelRadio(): Layer[] {
    const w = this.designW;
    const l0 = this.mk(0.0);
    this.sky(l0.g, 0x0a0d12, 0x05070a);
    this.glow(l0.node, w * 0.20, H * 0.40, 80, 0xffcf7a, 0.6);
    this.glow(l0.node, w * 0.26, H * 0.52, 230, 0xe8a23c, 0.5);
    this.moteField(l0.node, 14, { x: w * 0.05, y: H * 0.25, w: w * 0.45, h: H * 0.55 }, 0xffdca0, 1, 2, 6000, 8);

    const l1 = this.mk(0.45);
    l1.g.fillStyle(0x0c0f14, 1); l1.g.fillRect(0, H * 0.74, w, H * 0.26);
    l1.g.fillStyle(0x15110c, 1);
    l1.g.beginPath(); l1.g.moveTo(w * 0.30, H * 0.74); l1.g.lineTo(w * 0.92, H * 0.74);
    l1.g.lineTo(w * 0.98, H * 0.86); l1.g.lineTo(w * 0.24, H * 0.86); l1.g.closePath(); l1.g.fillPath();
    const rx = w * 0.60, ry = H * 0.66;
    const cold = this.glow(l1.node, rx + 18, ry - 6, 120, 0x5a7fa8, 0.45); this.pulse(cold, 0.62, 1400);
    l1.g.fillStyle(0x1b1c20, 1); l1.g.fillRect(rx, ry - 42, 88, 54);
    l1.g.fillStyle(0x0a0b0d, 1); l1.g.fillRect(rx + 7, ry - 34, 48, 24);
    l1.g.fillStyle(0x9fc2e6, 0.85); l1.g.fillRect(rx + 62, ry - 30, 18, 5);

    const l2 = this.mk(0.92);
    this.figure(l2.g, w * 0.40, H * 0.78, 150, 1.0, 0xe8a23c);
    this.figure(l2.g, w * 0.50, H * 0.78, 98, 0.78, 0x5a7fa8);
    return [l0, l1, l2];
  }

  // ── 3 · il crollo ──
  private panelCollapse(): Layer[] {
    const w = this.designW;
    const l0 = this.mk(0.0); this.sky(l0.g, 0x0a0c10, 0x191510);
    this.glow(l0.node, w * 0.18, H * 0.90, H * 0.62, 0xc0531f, 0.55);

    const l1 = this.mk(0.25);
    for (let i = 0; i < 4; i++) {
      const sx = w * 0.12 + i * w * 0.24 + Math.random() * 40;
      l1.g.fillStyle(0x1d2026, 0.4); l1.g.beginPath(); l1.g.moveTo(sx, H * 0.62);
      for (let yy = H * 0.62; yy > 20; yy -= 26) { const sway = Math.sin(yy * 0.02 + i) * 36 * (1 - yy / H); l1.g.lineTo(sx + sway - 22 * (1 - yy / H), yy); }
      for (let yy = 20; yy < H * 0.62; yy += 26) { const sway = Math.sin(yy * 0.02 + i) * 36 * (1 - yy / H); l1.g.lineTo(sx + sway + 22 * (1 - yy / H), yy); }
      l1.g.closePath(); l1.g.fillPath();
    }

    const l2 = this.mk(0.55);
    this.skyline(l2.g, H * 0.98, 150, 300, 0x070a0e, 0.9, null, 0, 0x3c322c);
    this.glow(l2.node, w * 0.66, H * 0.30, 46, 0xffcf7a, 0.95);
    l2.g.fillStyle(0xffcf7a, 1); l2.g.fillRect(w * 0.66 - 4, H * 0.30 - 7, 9, 14);

    const l3 = this.mk(0.95);
    l3.g.fillStyle(0x04060a, 1); l3.g.fillRect(0, H * 0.82, w, H * 0.18);
    this.glow(l3.node, w * 0.5, H * 0.94, H * 0.8, 0x6e2e16, 0.45);
    for (let i = 0; i < 9; i++) this.hunched(l3.g, 70 + Math.random() * (w - 140), H * (0.84 + Math.random() * 0.09), 46 + Math.random() * 34, 0xc85a28);
    this.moteField(l3.node, 16, { x: 0, y: H * 0.5, w, h: H * 0.45 }, 0xff8c3c, 1, 2.4, 5200, 7);
    return [l0, l1, l2, l3];
  }

  // ── 4 · il convoglio ──
  private panelConvoy(): Layer[] {
    const w = this.designW;
    const l0 = this.mk(0.0); this.sky(l0.g, 0x0a0d13, 0x05070b);
    this.glow(l0.node, w * 0.5, H * 0.28, 160, 0x5a7fa8, 0.4);

    const l1 = this.mk(0.4);
    l1.g.fillStyle(0x070a0f, 1); l1.g.fillRect(0, H * 0.58, w, H * 0.42);
    l1.g.fillStyle(0x0c1016, 1);
    l1.g.beginPath(); l1.g.moveTo(w * 0.40, H * 0.58); l1.g.lineTo(w * 0.60, H * 0.58);
    l1.g.lineTo(w * 0.95, H); l1.g.lineTo(w * 0.05, H); l1.g.closePath(); l1.g.fillPath();
    l1.g.fillStyle(0x788aaa, 0.18);
    for (let i = 0; i < 7; i++) { const tt = i / 7, yy = H * 0.6 + tt * tt * H * 0.42, seg = 3 + tt * 22; l1.g.fillRect(w * 0.5 - seg / 2, yy, seg, 4 + tt * 14); }

    const l2 = this.mk(0.85);
    const vx = w * 0.5, vy = H * 0.70;
    this.glow(l2.node, vx - 46, vy - 70, 80, 0xffdd96, 0.10);
    this.glow(l2.node, vx + 46, vy - 70, 80, 0xffdd96, 0.10);
    l2.g.fillStyle(0x05070b, 1);
    l2.g.fillRoundedRect(vx - 95, vy - 84, 190, 96, 12);
    l2.g.fillRoundedRect(vx - 76, vy - 134, 152, 64, 14);
    l2.g.lineStyle(1.5, 0x7896be, 0.28);
    l2.g.strokeRoundedRect(vx - 95, vy - 84, 190, 96, 12);
    l2.g.strokeRoundedRect(vx - 76, vy - 134, 152, 64, 14);
    l2.g.fillStyle(0x0a0e14, 1); l2.g.fillRect(vx - 84, vy - 143, 168, 9);
    this.glow(l2.node, vx, vy - 96, 62, 0xe8a23c, 0.32);
    l2.g.fillStyle(0x281e12, 0.9); l2.g.fillRect(vx - 60, vy - 124, 120, 40);
    this.figure(l2.g, vx - 28, vy - 84, 76, 0.7, 0xe8a23c);
    this.figure(l2.g, vx + 28, vy - 84, 70, 0.7, 0xe8a23c);
    this.glow(l2.node, vx - 76, vy - 12, 48, 0xff3322, 0.6);
    this.glow(l2.node, vx + 76, vy - 12, 48, 0xff3322, 0.6);
    l2.g.fillStyle(0xff3326, 1); l2.g.fillRect(vx - 90, vy - 22, 19, 11); l2.g.fillRect(vx + 71, vy - 22, 19, 11);

    const l3 = this.mk(1.0);
    l3.g.fillStyle(0x282c34, 0.22); l3.g.fillEllipse(vx, vy + 18, 290, 60);
    this.moteField(l3.node, 16, { x: w * 0.25, y: H * 0.62, w: w * 0.5, h: H * 0.3 }, 0x968c78, 1, 2, 5200, 12);
    return [l0, l1, l2, l3];
  }

  // ── 5 · title beat ──
  private panelTitle(): Layer[] {
    const w = this.designW;
    const l0 = this.mk(0.0); this.sky(l0.g, 0x070a0f, 0x020305);
    this.glow(l0.node, w * 0.5, H * 0.55, 200, 0x28384f, 0.4);
    const l1 = this.mk(0.9);
    const a = this.glow(l1.node, w * 0.47, H * 0.52, 26, 0xffdd96, 0.55);
    const b = this.glow(l1.node, w * 0.53, H * 0.52, 26, 0xffdd96, 0.55);
    this.pulse(a, 0.8, 2600); this.pulse(b, 0.8, 2600);
    return [l0, l1];
  }

  // ── EPILOGO · il rifugio all'alba (calore = esito del convoglio) ──
  private panelRefuge(mood: Mood): Layer[] {
    const w = this.designW, pal = REFUGE_PAL[mood];
    const l0 = this.mk(0.0); this.sky(l0.g, pal.skyTop, pal.skyBot);
    this.glow(l0.node, w * 0.5, H * 0.64, H * 0.75, pal.dawn, pal.dawnA);

    const l1 = this.mk(0.4);
    l1.g.fillStyle(0x04060a, 1); l1.g.fillRect(0, H * 0.5, w, H * 0.5);                       // terra
    l1.g.fillStyle(pal.wall, 1); l1.g.fillRect(0, H * 0.30, w, H * 0.22);                      // muro del rifugio
    l1.g.fillStyle(0x020306, 1); l1.g.fillRect(w * 0.44, H * 0.34, w * 0.12, H * 0.18);        // varco
    for (let x = 0; x < w; x += 26) l1.g.fillRect(x, H * 0.28, 14, 14);                        // merlatura (fillStyle ancora muro)
    if (pal.gateLight !== null) {                                                              // luce sul varco — spenta se "caduto"
      this.glow(l1.node, w * 0.5, H * 0.40, 60, pal.gateLight, 0.85);
      l1.g.fillStyle(pal.gateLight, 0.9); l1.g.fillRect(w * 0.49, H * 0.30, w * 0.02, 10);
    }

    const l2 = this.mk(0.82);                                                                  // il convoglio che arriva (di spalle)
    const vx = w * 0.5, vy = H * 0.74;
    l2.g.fillStyle(0x05070b, 1);
    l2.g.fillRoundedRect(vx - 64, vy - 52, 128, 64, 10);
    l2.g.fillRoundedRect(vx - 50, vy - 86, 100, 42, 12);
    l2.g.lineStyle(1.5, 0x7896be, 0.22); l2.g.strokeRoundedRect(vx - 64, vy - 52, 128, 64, 10);
    const interiorA = mood === 'ash' ? 0 : mood === 'cold' ? 0.18 : 0.30;                      // calore abitacolo = persone a bordo
    if (interiorA > 0) this.glow(l2.node, vx, vy - 60, 44, 0xe8a23c, interiorA);
    this.glow(l2.node, vx - 50, vy - 6, 34, 0xff3322, 0.55); this.glow(l2.node, vx + 50, vy - 6, 34, 0xff3322, 0.55);
    l2.g.fillStyle(0xff3326, 1); l2.g.fillRect(vx - 60, vy - 14, 13, 8); l2.g.fillRect(vx + 47, vy - 14, 13, 8);

    const l3 = this.mk(1.0);
    this.moteField(l3.node, 14, { x: 0, y: H * 0.45, w, h: H * 0.45 }, pal.mote, 1, 2.2, 6000, mood === 'ash' ? 8 : 10);
    return [l0, l1, l2, l3];
  }

  // ── EPILOGO · carta personale: una veglia a lume di candela (testo = la sua eco) ──
  private panelCard(): Layer[] {
    const w = this.designW;
    const l0 = this.mk(0.0); this.sky(l0.g, 0x0a0b0f, 0x050507);
    this.glow(l0.node, w * 0.34, H * 0.52, 200, 0xe8a23c, 0.30);
    this.moteField(l0.node, 10, { x: w * 0.12, y: H * 0.30, w: w * 0.4, h: H * 0.5 }, 0xffdca0, 1, 2, 7000, 6);

    const l1 = this.mk(0.5);
    l1.g.fillStyle(0x0b0e13, 1); l1.g.fillRect(0, H * 0.72, w, H * 0.28);
    const cxp = w * 0.32, cyp = H * 0.60;
    this.glow(l1.node, cxp, cyp - 6, 40, 0xffcf7a, 0.9);
    l1.g.fillStyle(0xffcf7a, 0.95); l1.g.fillEllipse(cxp, cyp - 12, 6, 12);                    // fiamma
    l1.g.fillStyle(0x2a2118, 1); l1.g.fillRect(cxp - 4, cyp - 2, 8, 18);                       // candela
    this.figure(l1.g, w * 0.6, H * 0.80, 150, 1.0, 0xe8a23c);                                  // figura in veglia
    return [l0, l1];
  }

  // ─── Overlay filmici (lettera-box · vignetta · grana · tratteggio) ──────────

  private buildHatchTexture() {
    if (this.textures.exists('cs_hatch')) return;
    const g = this.make.graphics({ x: 0, y: 0 }) as GfxTex;
    g.lineStyle(1, 0x2a2f37, 0.5);
    for (let i = -64; i < 64; i += 6) g.lineBetween(i, 0, i + 64, 64);
    g.lineStyle(1, 0x14181e, 0.35);
    for (let i = -64; i < 128; i += 9) g.lineBetween(i, 64, i + 64, 0);
    g.generateTexture('cs_hatch', 64, 64);
    g.destroy();
  }

  private buildOverlays() {
    const W = this.scale.width, Hh = this.scale.height;

    // Tratteggio "tavola disegnata" (spazio di design, sotto le didascalie): MULTIPLY dà il tono ai mezzitoni.
    this.add.tileSprite(this.designW / 2, H / 2, this.designW, H, 'cs_hatch')
      .setDepth(6).setAlpha(0.6).setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Vignetta (pixel nativi, fuori dallo zoom).
    const a = 0.55, b = 0.62, ex = Math.round(W * 0.26), ey = Math.round(Hh * 0.26);
    const v = this.add.graphics().setScrollFactor(0).setDepth(28);
    v.fillGradientStyle(0, 0, 0, 0, a, a, 0, 0); v.fillRect(0, 0, W, ey);
    v.fillGradientStyle(0, 0, 0, 0, 0, 0, b, b); v.fillRect(0, Hh - ey, W, ey);
    v.fillGradientStyle(0, 0, 0, 0, a, 0, a, 0); v.fillRect(0, 0, ex, Hh);
    v.fillGradientStyle(0, 0, 0, 0, 0, a, 0, a); v.fillRect(W - ex, 0, ex, Hh);

    // Grana di pellicola animata (jitter nell'update).
    this.grain = this.add.tileSprite(W / 2, Hh / 2, W, Hh, 'fx_grain').setScrollFactor(0).setDepth(31).setAlpha(0.05);

    // Lettera-box cinematografico.
    const bar = Math.round(Hh * 0.09);
    this.add.rectangle(W / 2, bar / 2, W, bar, 0x000000).setScrollFactor(0).setDepth(33);
    this.add.rectangle(W / 2, Hh - bar / 2, W, bar, 0x000000).setScrollFactor(0).setDepth(33);
  }

  private buildSkipHint() {
    Ui.text(this, this.designW - 16, 14, t('prologue.skip'), { fontSize: '12px', color: '#6a7488' })
      .setOrigin(1, 0).setDepth(34).setAlpha(0.75);
  }
}
