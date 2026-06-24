import Phaser from 'phaser';
import { OVERSAMPLE } from './Config';

/**
 * ICONE procedurali (100% Graphics → generateTexture, niente PNG). Glifi piccoli e ad alta leggibilità
 * (box 16×16 di design, sovracampionati a OVERSAMPLE× come zombie/veicoli) per l'HUD di gioco: sostituiscono
 * le etichette di testo ("SALUTE", "TORR."…) con simboli letti in periferia, language-neutral, daltonico-safe
 * (la forma porta l'informazione, non solo il colore). Fonte di verità estetica: docs/ART_BIBLE_ICONE.md.
 *
 * Regola: silhouette prima del dettaglio; metallo neutro per i COMPONENTI meccanici, accento semantico per le
 * RISORSE; luce alto-sinistra coerente col resto del titolo. Una sola generazione (guard `textures.exists`).
 */

// Palette icone: metallo neutro (componenti) + accenti semantici (risorse) — coerenti coi colori firma.
const STEEL = 0x9aa4b0, STEEL_SH = 0x59616d, STEEL_HI = 0xc8d0da, DARK = 0x2a2f37;
const RED = 0xff5a5a, RED_HI = 0xffa6a6, AMBER = 0xffb24a, AMBER_HI = 0xffd79a;
const BRASS = 0xc99a2a, BRASS_HI = 0xeac669;

export function buildIcons(scene: Phaser.Scene) {
  if (scene.textures.exists('icon_health')) return;
  const OS_G = () => {
    const g = scene.make.graphics({ add: false } as object) as Phaser.GameObjects.Graphics & { generateTexture(k: string, w: number, h: number): void };
    g.setScale(OVERSAMPLE);
    const orig = g.generateTexture.bind(g);
    (g as { generateTexture(k: string, w: number, h: number): void }).generateTexture =
      (k: string, w: number, h: number) => orig(k, w * OVERSAMPLE, h * OVERSAMPLE);
    return g;
  };
  const S = 16; // box icona 16×16 (design)
  const mk = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    const g = OS_G(); draw(g); g.generateTexture(key, S, S); g.destroy();
  };

  // ── SALUTE — croce medica (rosso firma + luce alto-sx) ──
  mk('icon_health', g => {
    g.fillStyle(0x7a1414); g.fillRect(6, 2, 5, 12); g.fillRect(2, 6, 12, 5); // ombra croce
    g.fillStyle(RED);      g.fillRect(6, 2, 4, 11); g.fillRect(2, 6, 11, 4); // croce
    g.fillStyle(RED_HI);   g.fillRect(6, 2, 2, 4);  g.fillRect(2, 6, 4, 2);  // highlight alto-sx
  });

  // ── CARBURANTE — pompa di benzina (distributore, ambra) ──
  mk('icon_fuel', g => {
    g.fillStyle(0x7a4a10);                                       // ombra (basso-dx)
    g.fillRoundedRect(3, 3, 7, 11, 1.5);                         // corpo pompa
    g.fillRect(11, 7, 3, 6);                                     // impugnatura erogatore
    g.fillStyle(AMBER);                                          // silhouette piena
    g.fillRoundedRect(2, 2, 7, 11, 1.5);                         // corpo pompa
    g.fillRect(8, 3, 3, 1.5);                                    // tubo: tratto orizzontale in alto
    g.fillRect(10.5, 3, 1.5, 4);                                 // tubo: discesa verso l'erogatore
    g.fillRect(11, 6, 2.5, 6);                                   // impugnatura erogatore (verticale)
    g.fillTriangle(11, 12, 13.5, 12, 13.5, 15);                 // ugello (punta in basso-dx)
    g.fillStyle(DARK);     g.fillRect(3.5, 4, 4, 2.5);          // display scuro
    g.fillStyle(AMBER_HI); g.fillRect(2, 2, 5, 1.2); g.fillRect(2, 2, 1.5, 5); // luce alto-sx
  });

  // ── MOTORE — ingranaggio (metallo) ──
  mk('icon_engine', g => {
    for (let a = 0; a < 8; a++) { const an = a * Math.PI / 4; g.fillStyle(STEEL_SH); g.fillRect(8 + Math.cos(an) * 6.4 - 1.5, 8 + Math.sin(an) * 6.4 - 1.5, 3, 3); }
    g.fillStyle(STEEL_SH); g.fillCircle(8, 8, 6);
    g.fillStyle(STEEL);    g.fillCircle(8, 8, 5);
    g.fillStyle(STEEL_HI); g.fillCircle(6.3, 6.3, 1.6);
    g.fillStyle(DARK);     g.fillCircle(8, 8, 2.1); // mozzo
  });

  // ── RUOTE — pneumatico (gomma scura + cerchione) ──
  mk('icon_wheels', g => {
    g.fillStyle(0x14161a); g.fillCircle(8, 8, 7);   // gomma
    g.fillStyle(0x2c3038); g.fillCircle(8, 8, 6.6);
    g.fillStyle(STEEL_SH); g.fillCircle(8, 8, 4.2); // cerchione
    g.fillStyle(STEEL);    g.fillCircle(8, 8, 3.6);
    g.fillStyle(STEEL_HI); g.fillCircle(6.6, 6.6, 1.1);
    g.fillStyle(DARK);     g.fillCircle(8, 8, 1.4); // mozzo
  });

  // ── SERBATOIO — fusto/tanica con bande + goccia ──
  mk('icon_tank', g => {
    g.fillStyle(STEEL_SH); g.fillRoundedRect(3, 3, 11, 11, 2);
    g.fillStyle(STEEL);    g.fillRoundedRect(3, 3, 10, 10, 2);
    g.fillStyle(STEEL_HI); g.fillRect(4, 4, 3, 1);            // luce bordo alto
    g.fillStyle(STEEL_SH); g.fillRect(3, 7, 10, 1); g.fillRect(3, 11, 10, 1); // bande
    g.fillStyle(AMBER);    g.fillTriangle(8, 5, 6, 8, 10, 8); g.fillCircle(8, 9, 1.8); // goccia (contenuto)
  });

  // ── TORRETTA — cannone (base + canna) ──
  mk('icon_turret', g => {
    g.fillStyle(STEEL_SH); g.fillRect(2, 9, 13, 4);          // canna (ombra)
    g.fillStyle(STEEL);    g.fillRect(2, 9, 12, 3);          // canna
    g.fillStyle(STEEL_HI); g.fillRect(3, 9, 7, 1);           // luce sulla canna
    g.fillStyle(STEEL_SH); g.fillCircle(4, 11, 3.4);         // base (ombra)
    g.fillStyle(STEEL);    g.fillCircle(4, 11, 2.8);
    g.fillStyle(STEEL_HI); g.fillCircle(3, 10, 1);
    g.fillStyle(DARK);     g.fillRect(13, 9.5, 2, 2);        // bocca della canna
  });

  // ── PERCORSO — bandiera a scacchi su asta ──
  mk('icon_route', g => {
    g.fillStyle(STEEL_SH); g.fillRect(3, 2, 1.6, 12);        // asta
    g.fillStyle(STEEL_HI); g.fillRect(3, 2, 0.8, 12);
    // bandiera 8×6 a scacchi 2×2 (bianco/scuro)
    for (let cx = 0; cx < 4; cx++) for (let cy = 0; cy < 3; cy++) {
      g.fillStyle(((cx + cy) % 2 === 0) ? 0xe6e9ef : 0x303641);
      g.fillRect(5 + cx * 2, 3 + cy * 2, 2, 2);
    }
  });

  // ── MUNIZIONI — cartuccia (ottone + punta) ──
  mk('icon_ammo', g => {
    g.fillStyle(0x6a4f12); g.fillRoundedRect(5, 3, 6, 11, 1);   // ombra bossolo
    g.fillStyle(BRASS);    g.fillRoundedRect(5, 4, 5, 10, 1);   // bossolo
    g.fillStyle(BRASS_HI); g.fillRect(6, 5, 1.4, 8);            // riflesso
    g.fillStyle(0x8a6a1a); g.fillRect(5, 11, 5, 1);            // collo
    g.fillStyle(0xb0742a); g.fillTriangle(5, 4, 10, 4, 7.5, 1); // ogiva (punta)
    g.fillStyle(0xd29a52); g.fillTriangle(6, 3.5, 7.5, 3.5, 7, 1.6);
  });
}
