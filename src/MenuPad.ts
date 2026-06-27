import Phaser from 'phaser';

/**
 * Navigazione dei MENU col gamepad (pivot horror: il pad deve poter pilotare tutta l'esperienza, non solo
 * il gioco). Helper riusabile da ogni scena-menu: croce/stick sinistro spostano il **focus** fra gli elementi
 * (navigazione spaziale = funziona per liste e griglie); A/Start attivano, B torna indietro. L'attivazione
 * **riusa il `pointerdown` già esistente** dell'elemento (zero logica duplicata): nessun cambio ai call-site
 * delle azioni. Tastiera+mouse restano il default ("last input wins": il mouse/tastiera spengono il cursore pad).
 *
 * Stile coerente con l'input pad di GameScene (PAD indices standard mapping, deadzone, activePad, edge-trigger).
 */

const PAD = { A: 0, B: 1, START: 9 } as const;
const DEADZONE = 0.4;    // stick: soglia alta per la navigazione → niente doppi step accidentali
const REPEAT_MS = 220;   // ripetizione della navigazione a stick/croce tenuti

/** Un elemento focalizzabile: `RoundRect` (Ui.box/Ui.button) o GameObject nativo (Text/Rectangle).
 *  Entrambi espongono `getBounds()` ed `emit()` (a RoundRect aggiunti in Ui.ts). */
export interface Focusable {
  getBounds(): Phaser.Geom.Rectangle;
  emit(event: string, ...args: unknown[]): unknown;
}

interface ItemOpts {
  /** Slider/selettore: ←/→ regolano invece di navigare (es. volume, frecce risoluzione/lingua). */
  onLeft?: () => void;
  onRight?: () => void;
  /** Override dell'attivazione (default: emette 'pointerdown' sull'elemento). */
  onActivate?: () => void;
}
interface Item extends ItemOpts { go: Focusable; cx: number; cy: number; }

export default class MenuPad {
  /** Ultimo focus per scena (persiste fra i scene.restart di negozio/impostazioni → niente salto al top). */
  private static lastFocus: Record<string, number> = {};

  private scene: Phaser.Scene;
  private items: Item[] = [];
  private focus = -1;
  private cursor: Phaser.GameObjects.Graphics;
  private backFn?: () => void;
  private startFn?: () => void;
  private usingPad = false;
  private prevA = false; private prevB = false; private prevStart = false;
  private navAt = 0; private prevDir = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cursor = scene.add.graphics().setDepth(10000).setVisible(false);

    const pad = this.activePad();
    if (pad) {
      this.usingPad = true;
      // Inizializza lo stato dei bottoni a QUELLO CORRENTE: un tasto tenuto dalla scena precedente (es. lo
      // Start che ha aperto la pausa) non deve contare come pressione fresca nella nuova scena.
      this.prevA = !!pad.A; this.prevB = !!pad.B; this.prevStart = !!pad.buttons[PAD.START]?.pressed;
    }
    scene.input.gamepad?.on('connected', this.onConnect, this);
    scene.input.on('pointermove', this.onMouseOrKey, this);
    scene.input.keyboard?.on('keydown', this.onMouseOrKey, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Registra un elemento navigabile, in qualunque ordine (la navigazione è spaziale, non per indice). */
  add(go: Focusable, opts: ItemOpts = {}): this {
    const b = go.getBounds();
    this.items.push({ go, cx: b.centerX, cy: b.centerY, onLeft: opts.onLeft, onRight: opts.onRight, onActivate: opts.onActivate });
    return this;
  }
  /** Svuota gli elementi registrati. Per le scene che RI-DISEGNANO i bottoni a ogni selezione
   *  (es. NewRunScene): chiama `clearItems()` e poi ri-`add()` i nuovi bottoni dentro ogni render.
   *  Listener/cursore (creati una volta) restano; il focus corrente resta valido se numero e ordine
   *  degli elementi non cambiano fra un render e l'altro. */
  clearItems(): this { this.items = []; return this; }
  /** Azione del tasto B (indietro/annulla). Senza, B non fa nulla. */
  setBack(fn: () => void): this { this.backFn = fn; return this; }
  /** Azione del tasto Start (default = attiva l'elemento focalizzato, come "Enter"). */
  setStart(fn: () => void): this { this.startFn = fn; return this; }

  private activePad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const p = this.scene.input.gamepad?.getPad(0);
    return p?.connected ? p : undefined;
  }
  private onConnect() { this.usingPad = true; this.ensureFocus(); }
  private onMouseOrKey() { this.usingPad = false; } // last input wins → torna a mouse/tastiera

  private ensureFocus() {
    if (this.focus >= 0 || !this.items.length) return;
    const saved = MenuPad.lastFocus[this.scene.scene.key];
    this.setFocus(saved !== undefined && saved < this.items.length ? saved : 0);
  }

  private update() {
    const pad = this.activePad();
    if (!pad) { this.cursor.setVisible(false); return; }
    if (this.usingPad) this.ensureFocus();

    // Direzione: croce + stick sinistro, un asse alla volta (più prevedibile in un menu).
    const ls = pad.leftStick;
    let dx = 0, dy = 0;
    if (pad.left || ls.x < -DEADZONE) dx = -1; else if (pad.right || ls.x > DEADZONE) dx = 1;
    if (pad.up   || ls.y < -DEADZONE) dy = -1; else if (pad.down  || ls.y > DEADZONE) dy = 1;
    if (dx !== 0 && dy !== 0) { if (Math.abs(ls.x) >= Math.abs(ls.y)) dy = 0; else dx = 0; }

    const dir = dx + ',' + dy;
    const now = this.scene.time.now;
    if (dx !== 0 || dy !== 0) {
      this.usingPad = true;
      this.ensureFocus();
      if (dir !== this.prevDir || now - this.navAt > REPEAT_MS) {
        const it = this.items[this.focus];
        if (dx !== 0 && it && (it.onLeft || it.onRight)) { if (dx < 0) it.onLeft?.(); else it.onRight?.(); }
        else this.move(dx, dy);
        this.navAt = now;
      }
      this.prevDir = dir;
    } else {
      this.prevDir = '';
    }

    // Bottoni (edge-triggered): A/Start = attiva · B = indietro. Solo se il pad è la sorgente attiva.
    const a = !!pad.A, b = !!pad.B, st = !!pad.buttons[PAD.START]?.pressed;
    if (this.usingPad) {
      if (a && !this.prevA) this.activate();
      if (st && !this.prevStart) (this.startFn ?? (() => this.activate()))();
      if (b && !this.prevB && this.backFn) this.backFn();
    }
    this.prevA = a; this.prevB = b; this.prevStart = st;

    this.cursor.setVisible(this.usingPad && this.focus >= 0);
  }

  /** Sposta il focus all'elemento più vicino nella direzione premuta (penalità sull'asse trasversale). */
  private move(dx: number, dy: number) {
    if (this.focus < 0) { this.setFocus(0); return; }
    const cur = this.items[this.focus]!;
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < this.items.length; i++) {
      if (i === this.focus) continue;
      const it = this.items[i]!;
      const ox = it.cx - cur.cx, oy = it.cy - cur.cy;
      const along = dx !== 0 ? ox * dx : oy * dy;
      if (along <= 0) continue;                         // dev'essere nella direzione premuta (proiezione positiva)
      const cross = dx !== 0 ? Math.abs(oy) : Math.abs(ox);
      const score = along + cross * 2.5;                // preferisci allineati e vicini
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) this.setFocus(best);
  }

  private setFocus(i: number) {
    if (!this.items[i]) return;
    if (i !== this.focus) {
      const old = this.items[this.focus];
      if (old) { try { old.go.emit('pointerout'); } catch { /* hover opzionale */ } }
      this.focus = i;
      MenuPad.lastFocus[this.scene.scene.key] = i;
      try { this.items[i].go.emit('pointerover'); } catch { /* hover opzionale */ }
    }
    this.drawCursor(i);
  }

  private drawCursor(i: number) {
    const b = this.items[i]!.go.getBounds();
    this.cursor.clear()
      .lineStyle(2, 0x88ccff, 1)
      .strokeRoundedRect(b.x - 3, b.y - 3, b.width + 6, b.height + 6, 7);
    this.cursor.setVisible(this.usingPad);
  }

  private activate() {
    const it = this.items[this.focus];
    if (!it) return;
    if (it.onActivate) it.onActivate();
    else { try { it.go.emit('pointerdown', this.scene.input.activePointer); } catch { /* niente handler */ } }
  }

  private destroy() {
    this.scene.input.gamepad?.off('connected', this.onConnect, this);
    this.scene.input.off('pointermove', this.onMouseOrKey, this);
    this.scene.input.keyboard?.off('keydown', this.onMouseOrKey, this);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.cursor.destroy();
    this.items = [];
  }
}
