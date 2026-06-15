import Phaser from 'phaser';
import Juice from './Juice';
import Settings from './Settings';

/**
 * Chrome condiviso dell'interfaccia — fonte di verità unica per font, palette
 * funzionale e helper UI. Chiude i 3 gap di rifinitura dell'Art Bible Interfacce:
 *   1. FONT esplicito (niente più default implicito di Phaser).
 *   2. Palette canonica anti-drift (un solo posto per ogni tono di chrome).
 *   3. Helper riusabili (text/panel/button/enter) → niente stili inline ripetuti.
 *
 * Vedi docs/ART_BIBLE_INTERFACCE.md §3 (palette/tipografia) e §8 (gap chiusi).
 * Regola: gli accenti vivi restano i 3 colori firma del titolo
 * (malato-verde · arancio-fuoco · rosso-sangue); il BLU è esclusivo del chrome UI.
 */

/** La voce tipografica del titolo: monospace "consolle", esplicita e con fallback. */
export const FONT = '"Courier New", Courier, monospace';

/**
 * Palette funzionale canonica. Ogni famiglia ha pochi toni (base · chiaro · spento);
 * gli `0x…` sono per fill/stroke (rectangle/graphics), gli `#…` per il testo.
 */
export const UI = {
  font: FONT,

  // ── Superfici (fill numerici) ─────────────────────────────────────────────
  bg:          0x080810, // sfondo scena-menu
  bgDeep:      0x0a0a12, // sfondo debug
  panel:       0x0e0e1a, // pannello / card base
  panelAlt:    0x0e0e22, // header / barra titolo
  panelBought: 0x0e1e0e, // card "comprato/attivo"
  panelWarm:   0x131310, // card sopravvissuti
  black:       0x000000, // velo modale / pannello HUD (con alpha)

  // ── Bordi / divisori ──────────────────────────────────────────────────────
  stroke:      0x222244, // bordo / divisore principale
  strokeSoft:  0x33344a, // bordo tenue (celle)
  strokeDim:   0x333333, // divisore HUD

  // ── Testo neutro ────────────────────────────────────────────────────────────
  white:    '#ffffff', // valore primario / enfasi
  text:     '#dddddd', // corpo
  muted:    '#888899', // secondario
  faint:    '#556677', // hint / inattivo
  ghost:    '#454a5c', // hint quasi invisibile
  disabled: '#333333', // bloccato / non disponibile (🔒, BLOCCATO)

  // ── Oro / valuta · energia (firma arancio-fuoco) ─────────────────────────────
  gold:      '#ffee44', // valuta / prezzo comprabile
  goldDim:   '#ffcc44', // header oro / stato attivo (arma)
  amber:     '#ffaa00', // azione "COMPRA" / soglia media
  amberSoft: '#ffaa66', // carburante (testo)
  fuelBar:   0xff8800,  // riempimento barra carburante

  // ── Verde / conferma · vita (firma malato-verde) ────────────────────────────
  green:     '#88ff44', // azione positiva / equipaggiato
  greenSoft: '#88ff88', // titolo / ok
  greenDim:  '#446644', // spento (posseduto / comprato / ✓)
  greenOk:   '#44cc44', // conferma forte / GRATIS / salute alta
  greenSig:  0x6cff3a,  // FIRMA emissiva (glow / bordo)
  greenCell: 0x3acb3a,  // celle volume accese
  hpHigh:    0x44cc44,  // barra salute ≥60%
  hpMid:     0xffaa00,  // barra salute 30–60%
  hpLow:     0xff2222,  // barra salute <30%
  hpFill:    0xff4444,  // barra salute (riempimento iniziale)

  // ── Blu / info · navigazione (chrome UI, mai nel mondo di gioco) ─────────────
  blue:      '#9ab6ff', // navigazione (base)
  blueBright:'#88aaff', // header / azione
  blueUse:   '#4488ff', // "Usa" (secondario)
  blueInfo:  '#aaaaff', // valore informativo (distanza)
  cyan:      '#88ddff', // label effetti schermo
  cyanDebug: '#66ddff', // titolo debug
  blueLine:  0x88aaff,  // bordo pulsante (versione numerica di blueBright)
  distBar:   0x4466cc,  // riempimento barra percorso

  // ── Rosso / pericolo · blocco (firma rosso-sangue) ──────────────────────────
  red:     '#ff6666', // avviso / pericolo (base)
  redSoft: '#ffaaaa', // testo secondario di pericolo
  redText: '#ff8888', // label salute
  redCrit: 0xcc0000,  // barra del boss

  // ── Sfondi tenui delle barre HUD ────────────────────────────────────────────
  barRed:   0x331111, // dietro barra salute
  barAmber: 0x331800, // dietro barra carburante
  barBlue:  0x111122, // dietro barra percorso
  barGrey:  0x1a1a1a, // dietro barre componenti
} as const;

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

interface PanelOpts {
  fill?: number; fillAlpha?: number;
  stroke?: number; strokeWidth?: number; strokeAlpha?: number;
}

interface ButtonOpts {
  fill?: number; hover?: number;
  border?: number; borderAlpha?: number;
  color?: string; fontSize?: string; fontStyle?: string;
  scaleOnHover?: number;
  onClick?: () => void;
}

export default class Ui {
  /** Testo con la voce tipografica condivisa già applicata (chiude il gap font). */
  static text(
    scene: Phaser.Scene, x: number, y: number,
    content: string | string[], style: TextStyle = {},
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, content, { fontFamily: FONT, ...style });
  }

  /** Pannello/card: riempimento scuro + bordo opzionale (mai un pannello senza bordo). */
  static panel(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number,
    opts: PanelOpts = {},
  ): Phaser.GameObjects.Rectangle {
    const r = scene.add.rectangle(x, y, w, h, opts.fill ?? UI.panel, opts.fillAlpha ?? 1);
    if (opts.stroke !== undefined) r.setStrokeStyle(opts.strokeWidth ?? 1, opts.stroke, opts.strokeAlpha ?? 1);
    return r;
  }

  /**
   * Pulsante con stato di hover gestito (fill + bordo + scala opzionale) e hand cursor.
   * Copre sia i pulsanti con bordo+scala (menu) sia quelli a solo riempimento (negozio).
   */
  static button(
    scene: Phaser.Scene, x: number, y: number, w: number, h: number,
    label: string, opts: ButtonOpts = {},
  ): { bg: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text } {
    const fill = opts.fill ?? UI.panel;
    const hover = opts.hover ?? fill;
    const borderAlpha = opts.borderAlpha ?? 0.5;

    const bg = scene.add.rectangle(x, y, w, h, fill).setInteractive({ useHandCursor: true });
    if (opts.border !== undefined) bg.setStrokeStyle(2, opts.border, borderAlpha);

    const txt = Ui.text(scene, x, y, label, {
      fontSize: opts.fontSize ?? '20px',
      fontStyle: opts.fontStyle ?? 'bold',
      color: opts.color ?? UI.text,
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(hover);
      if (opts.border !== undefined) bg.setStrokeStyle(2, opts.border, 1);
      if (opts.scaleOnHover) txt.setScale(opts.scaleOnHover);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(fill);
      if (opts.border !== undefined) bg.setStrokeStyle(2, opts.border, borderAlpha);
      if (opts.scaleOnHover) txt.setScale(1);
    });
    if (opts.onClick) bg.on('pointerdown', opts.onClick);

    return { bg, txt };
  }

  /**
   * Ingresso schermata standard: dissolvenza + overlay filmico (se attivo nelle
   * impostazioni). Restituisce la grana per il jitter per-frame (`Juice.jitterGrain`).
   * Centralizza il pattern di Menu/Shop/Settings → niente cut secco (chiude il gap ShopScene).
   */
  static enter(scene: Phaser.Scene, fadeMs = 300): Phaser.GameObjects.TileSprite | null {
    Juice.fadeIn(scene, fadeMs);
    return Settings.screenFx ? Juice.addOverlay(scene) : null;
  }
}
