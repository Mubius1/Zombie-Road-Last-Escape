import Phaser from 'phaser';
import Settings from './Settings';

/**
 * Punto di verità unico per la risoluzione e lo scaling.
 *
 * Il gioco è simulato in uno "spazio di design" alto DESIGN_H (600) e largo a
 * piacere (DESIGN_W=800 in 4:3, più largo in 16:9 → si vede più strada). La camera
 * di ogni scena viene poi messa in zoom S = altezzaCanvas / DESIGN_H e centrata,
 * così lo spazio di design riempie l'intera risoluzione nativa scelta dal giocatore.
 *
 * Conseguenze utili:
 *   · tutte le coordinate/dimensioni/velocità restano in spazio design → gameplay
 *     e bilanciamento identici a ogni risoluzione (niente costanti da riscalare);
 *   · l'unica grandezza che cambia col formato è la LARGHEZZA di design (`designW`):
 *     in 16:9 è maggiore → più mondo visibile a destra (widescreen vero).
 *
 * Vedi docs/ART_BIBLE_AMBIENTE.md §0 e CLAUDE.md (Regola n.2).
 */

/** Spazio di design: altezza fissa, larghezza di riferimento (4:3). */
export const DESIGN_W = 800;
export const DESIGN_H = 600;

/**
 * Fattore di sovracampionamento delle texture procedurali. Le texture vengono generate
 * a OVERSAMPLE× la dimensione di design (il `Graphics` viene scalato prima di
 * `generateTexture`), così restano NITIDE quando la camera le ingrandisce per riempire la
 * risoluzione nativa. Gli sprite vanno poi riportati alla scala di design dividendo per
 * OVERSAMPLE (vedi `osSprite`). 2 copre tutti i preset fino a 1600×1200 (zoom S≤2).
 */
export const OVERSAMPLE = 2;

export interface Resolution {
  w: number;
  h: number;
  label: string;
  aspect: '4:3' | '16:9';
}

/** Preset selezionabili dal menu Impostazioni. L'indice 0 (800×600) è la baseline. */
export const RESOLUTIONS: readonly Resolution[] = [
  { w: 800,  h: 600,  label: '800 × 600',   aspect: '4:3'  },
  { w: 1024, h: 768,  label: '1024 × 768',  aspect: '4:3'  },
  { w: 1280, h: 960,  label: '1280 × 960',  aspect: '4:3'  },
  { w: 1600, h: 1200, label: '1600 × 1200', aspect: '4:3'  },
  { w: 1280, h: 720,  label: '1280 × 720',  aspect: '16:9' },
  { w: 1366, h: 768,  label: '1366 × 768',  aspect: '16:9' },
  { w: 1600, h: 900,  label: '1600 × 900',  aspect: '16:9' },
  { w: 1920, h: 1080, label: '1920 × 1080', aspect: '16:9' },
] as const;

export const DEFAULT_RESOLUTION_INDEX = 0;

/** Preset attualmente scelto (con fallback alla baseline se l'indice è fuori range). */
export function currentResolution(): Resolution {
  return RESOLUTIONS[Settings.resolution] ?? RESOLUTIONS[DEFAULT_RESOLUTION_INDEX];
}

/** Larghezza dello spazio di design per la dimensione attuale del canvas. */
export function designWidth(scene: Phaser.Scene): number {
  const S = scene.scale.height / DESIGN_H;
  return scene.scale.width / S;
}

/**
 * Mette la camera della scena in zoom così che lo spazio di design (alto DESIGN_H,
 * largo `designW`) riempia esattamente il canvas nativo. Da chiamare a inizio create().
 * Ritorna la larghezza di design effettiva e il fattore di scala S.
 */
export function setupCamera(scene: Phaser.Scene): { designW: number; designH: number; S: number } {
  const S = scene.scale.height / DESIGN_H;
  const designW = scene.scale.width / S;
  const cam = scene.cameras.main;
  cam.setZoom(S);
  cam.centerOn(designW / 2, DESIGN_H / 2);
  return { designW, designH: DESIGN_H, S };
}
