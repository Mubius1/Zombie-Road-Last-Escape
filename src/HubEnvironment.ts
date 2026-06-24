import Phaser from 'phaser';
import { OVERSAMPLE } from './Config';
import { StopLocation } from './Locations';
import { VEHICLES } from './GameData';
import Environment from './Environment';
import Shadows from './Shadows';

/**
 * Soste diegetiche (docs/SOSTE_DIEGETICHE.md) — rendering procedurale dell'HUB di una sosta.
 *
 * Principi (dopo i playtest a schermo): (1) **scena CHIUSA** da un muro/edificio di fondo che riempie il
 * frame → niente cielo vuoto / "senso di vuoto"; (2) **luce integrata**: pozza a terra additiva SOTTO gli
 * oggetti + bloom stretto alla sorgente — niente dischi giganti che galleggiano, niente banding; (3) terreno
 * DENSO (crepe, gomma, detriti, pozze); (4) shading a 3 toni (`drawLitProp`/`shadeCyl`) su ogni volume.
 * Riusa il DNA provato del gioco (`Environment.mix`, `drawFarBox`/`rimTL`/`crate`/`barrel`/`sandbags`,
 * `Shadows.fx_shadow`, `Juice.fx_light`). 100% procedurale.
 */

/** Linea del terreno / base del muro di fondo. Alta (poco cielo) per chiudere la scena. Verità di walk → invariata. */
export const HUB_HORIZON = 210;
const WALL_TOP = 60;               // sommità del muro di fondo
const FAR_SHEAR = 0.18;            // lean dei volumi distanti

/** Area calpestabile dal personaggio (spazio di design; `maxX` lo fissa la scena = designW − minX). */
export const HUB_WALK = { minX: 44, maxY: 556, minY: 352 };

export interface HubLight { x: number; y: number; color: number; warmth: number; reach: number; }
export interface Collider { x: number; y: number; r: number }
export interface HubLayout {
  service: { x: number; y: number };
  pump: { x: number; y: number } | null;
  light: HubLight;
  colliders: Collider[];
  glow: Phaser.GameObjects.Image;          // bloom-sorgente (animato dal flicker)
  glowScale: number; glowAlpha: number; warm: boolean;
}

type G = Phaser.GameObjects.Graphics;
const mix = (color: number, target: number, t: number): number => Environment.mix(color, target, t);

function makeRng(seedStr: string): (n: number) => number {
  let h = 0; for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0;
  return (n: number) => { const s = Math.sin(n * 12.9898 + h * 0.0173) * 43758.5453; return s - Math.floor(s); };
}
function lightDir(L: HubLight, px: number, py: number) {
  const dx = px - L.x, dy = py - L.y, d = Math.hypot(dx, dy) || 1;
  return { nx: dx / d, ny: dy / d, dist: d };
}
function falloff(L: HubLight, px: number, py: number): number {
  return Phaser.Math.Clamp(1 - lightDir(L, px, py).dist / L.reach, 0, 1) ** 1.6;
}

const osGraphics = (scene: Phaser.Scene): G & { generateTexture(k: string, w: number, h: number): void } => {
  const g = scene.make.graphics({ add: false } as any) as G & { generateTexture(k: string, w: number, h: number): void };
  g.setScale(OVERSAMPLE);
  const orig = g.generateTexture.bind(g);
  (g as any).generateTexture = (k: string, w: number, h: number) => orig(k, w * OVERSAMPLE, h * OVERSAMPLE);
  return g;
};

// ─── Shading materiale ─────────────────────────────────────────────────────────
function rimTL(g: G, x: number, y: number, w: number, h: number, color: number, amt = 0.3) {
  g.fillStyle(mix(color, 0xffffff, amt), 0.6); g.fillRect(x, y, w, 1.5); g.fillRect(x, y, 1.5, h);
}
function drawLitProp(g: G, L: HubLight, x: number, y: number, w: number, h: number, base: number) {
  const fo = falloff(L, x, y), { nx } = lightDir(L, x, y);
  g.fillStyle(mix(base, 0x000000, 0.12 - fo * 0.10)); g.fillRoundedRect(x - w / 2, y - h, w, h, 2);
  g.fillStyle(mix(base, L.color, 0.18 * fo + 0.06), 0.9); g.fillRect(nx < 0 ? x : x - w / 2, y - h, w / 2, h * 0.6);
  g.fillStyle(mix(base, 0x000000, 0.42), 0.5); g.fillRect(nx < 0 ? x - w / 2 : x, y - h, w / 2, h);
  const edgeX = nx < 0 ? x + w / 2 - 1.5 : x - w / 2;
  g.fillStyle(mix(base, L.color, 0.35 + 0.4 * fo), 0.5 + 0.4 * fo); g.fillRect(edgeX, y - h, 1.5, h); g.fillRect(x - w / 2, y - h, w, 1.5);
  g.fillStyle(0xffffff, 0.07 + 0.09 * fo); g.fillRect(x - w / 2 + 2, y - h + 2, w - 4, 2);
  g.fillStyle(mix(base, 0x000000, 0.5), 0.8); g.fillCircle(x - w / 2 + 3, y - 3, 1); g.fillCircle(x + w / 2 - 3, y - 3, 1);
}
function shadeCyl(g: G, x: number, y: number, w: number, h: number, base: number) {
  g.fillStyle(mix(base, 0x000000, 0.40)); g.fillRoundedRect(x, y, w, h, 3);
  g.fillStyle(base); g.fillRect(x + w * 0.18, y, w * 0.5, h);
  g.fillStyle(mix(base, 0xffffff, 0.34), 0.8); g.fillRect(x + w * 0.26, y, w * 0.18, h);
  g.fillStyle(mix(base, 0x000000, 0.62), 0.6); g.fillRect(x + w * 0.78, y, w * 0.22, h);
  g.lineStyle(1.5, mix(base, 0xffffff, 0.5), 0.7); g.beginPath(); g.arc(x + w / 2, y + 3, w / 2 - 1, Math.PI * 0.85, Math.PI * 1.55); g.strokePath();
}
function crate(g: G, x: number, y: number, color: number) {
  g.fillStyle(0x000000, 0.25); g.fillRect(x + 1, y + 2, 16, 13);
  g.fillStyle(color); g.fillRect(x, y, 16, 13);
  g.lineStyle(1, mix(color, 0x000000, 0.45), 0.85); g.strokeRect(x, y, 16, 13); g.lineBetween(x, y, x + 16, y + 13); g.lineBetween(x + 16, y, x, y + 13);
  rimTL(g, x, y, 16, 13, color, 0.3);
}
function barrel(g: G, x: number, y: number, color: number) {
  g.fillStyle(0x000000, 0.3); g.fillEllipse(x + 1, y + 2, 13, 12);
  g.fillStyle(color); g.fillCircle(x, y, 6);
  g.lineStyle(1, mix(color, 0x000000, 0.4), 0.85); g.strokeCircle(x, y, 6);
  g.fillStyle(mix(color, 0xffffff, 0.25), 0.6); g.fillEllipse(x - 1.5, y - 1.5, 4, 4);
  g.lineStyle(1.5, mix(color, 0xffffff, 0.34), 0.7); g.beginPath(); g.arc(x, y, 6, Math.PI * 0.85, Math.PI * 1.55); g.strokePath();
}
function sandbags(g: G, x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) { const c = i % 2 ? 0x6a6244 : 0x7a7050; g.fillStyle(0x000000, 0.25); g.fillEllipse(x + i * 11 + 1, y + 6, 14, 8); g.fillStyle(c); g.fillRoundedRect(x + i * 11, y, 13, 9, 3); rimTL(g, x + i * 11, y, 13, 9, c, 0.22); }
}
function drawFarBox(g: G, x: number, baseY: number, w: number, h: number, color: number) {
  const shx = (xx: number, yy: number) => xx + FAR_SHEAR * (baseY - yy);
  const topY = baseY - h;
  g.fillStyle(color); g.fillPoints([{ x: shx(x, baseY), y: baseY }, { x: shx(x + w, baseY), y: baseY }, { x: shx(x + w, topY), y: topY }, { x: shx(x, topY), y: topY }], true);
  g.fillStyle(mix(color, 0x000000, 0.3), 0.5); g.fillPoints([{ x: shx(x + w * 0.78, baseY), y: baseY }, { x: shx(x + w, baseY), y: baseY }, { x: shx(x + w, topY), y: topY }, { x: shx(x + w * 0.78, topY), y: topY }], true);
  g.fillStyle(mix(color, 0xffffff, 0.16)); g.fillRect(shx(x, topY), topY, w, 2);
}
export function dropShadow(scene: Phaser.Scene, L: HubLight, x: number, y: number, w: number, depth: number) {
  const { nx, ny, dist } = lightDir(L, x, y);
  const long = Phaser.Math.Clamp(dist / L.reach, 0.4, 1.6), ang = Math.atan2(ny, nx);
  scene.add.image(x + nx * w * 0.2, y + ny * w * 0.1, 'fx_shadow')
    .setRotation(ang).setScale((w * 0.92) / 64 * (1 + long * 0.8), (w * 0.92) / 64 * 0.7)
    .setAlpha(0.34).setDepth(depth - 0.1);
  scene.add.ellipse(x, y, w * 0.5, 5, 0x000000, 0.32).setDepth(depth - 0.05);
}

// ─── Texture (personaggio + NPC) ────────────────────────────────────────────────
export function buildHubTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('hub_driver')) buildFigure(scene, 'hub_driver', 0x2f3d2c, 0xc99a6a, 0x1e1e24);
}

/** Frame fisso dell'auto-hub (così l'origine a terra è la stessa per ogni veicolo). */
export const CAR_FW = 116, CAR_FH = 72, CAR_GY = 60;
interface CarShape { len: number; bodyH: number; cabX: number; cabW: number; cabH: number; wheel: number; bed?: boolean }
const CAR_SHAPES: Record<string, CarShape> = {
  civilian_car:   { len: 66, bodyH: 16, cabX: 22, cabW: 30, cabH: 12, wheel: 7 },
  pickup:         { len: 74, bodyH: 17, cabX: 12, cabW: 26, cabH: 14, wheel: 8, bed: true },
  armored_van:    { len: 76, bodyH: 26, cabX: 12, cabW: 58, cabH: 20, wheel: 8 },
  military_suv:   { len: 72, bodyH: 20, cabX: 16, cabW: 44, cabH: 16, wheel: 9 },
  armored_truck:  { len: 92, bodyH: 22, cabX: 8,  cabW: 26, cabH: 20, wheel: 9, bed: true },
  heavy_military: { len: 100, bodyH: 26, cabX: 8, cabW: 30, cabH: 24, wheel: 11, bed: true },
  experimental:   { len: 78, bodyH: 15, cabX: 26, cabW: 38, cabH: 11, wheel: 7 },
};

/** Auto parcheggiata in VISTA LATERALE, PER-VEICOLO (colore di `VEHICLES` + silhouette). Cache `hub_car_<key>`. */
export function buildHubCar(scene: Phaser.Scene, key: string): string {
  const tkey = `hub_car_${key}`;
  if (scene.textures.exists(tkey)) return tkey;
  const s = CAR_SHAPES[key] ?? CAR_SHAPES['civilian_car']!;
  const color = VEHICLES[key]?.color ?? 0x35506e;
  const dark = mix(color, 0x000000, 0.38), light = mix(color, 0xffffff, 0.22);
  const g = osGraphics(scene);
  const bx = Math.round((CAR_FW - s.len) / 2), bodyY = CAR_GY - s.wheel - s.bodyH;
  const ws: number[] = [bx + s.len * 0.2, bx + s.len * 0.82]; if (s.bed) ws.splice(1, 0, bx + s.len * 0.6);
  g.fillStyle(0x0a0a0a); ws.forEach(wx => g.fillCircle(wx, CAR_GY, s.wheel));                       // ruote
  g.fillStyle(0x2a2a30); ws.forEach(wx => g.fillCircle(wx, CAR_GY, s.wheel * 0.45));
  g.fillStyle(dark); g.fillRoundedRect(bx, bodyY + 4, s.len, s.bodyH, 5);                           // carrozzeria
  g.fillStyle(color); g.fillRoundedRect(bx, bodyY, s.len, s.bodyH, 6);
  g.fillStyle(light); g.fillRoundedRect(bx + 2, bodyY, s.len - 4, 4, 4);
  rimTL(g, bx, bodyY, s.len, s.bodyH, color, 0.2);
  g.fillStyle(mix(color, 0x000000, 0.5)); g.fillRect(bx, bodyY + s.bodyH - 4, s.len, 2);
  const cx0 = bx + s.cabX, cabY = bodyY - s.cabH + 4;                                               // cabina
  g.fillStyle(mix(color, 0x000000, 0.16)); g.fillRoundedRect(cx0, cabY, s.cabW, s.cabH, 4);
  g.fillStyle(light, 0.6); g.fillRoundedRect(cx0 + 1, cabY, s.cabW - 2, 3, 3);
  const winW = (s.cabW - 9) / 2;
  g.fillStyle(0x0a0e16); g.fillRoundedRect(cx0 + 3, cabY + 3, winW, s.cabH - 7, 2); g.fillRoundedRect(cx0 + 5 + winW, cabY + 3, winW, s.cabH - 7, 2);
  g.fillStyle(0x6a7a8a, 0.4); g.fillRect(cx0 + 4, cabY + 4, winW - 2, 2);
  if (s.bed) {                                                                                       // cassone (pickup) / cargo (camion)
    const bedX = cx0 + s.cabW + 2, bedW = bx + s.len - bedX;
    if (key === 'pickup') { g.fillStyle(mix(color, 0x000000, 0.3)); g.fillRect(bedX, bodyY - 7, bedW, 9); g.fillStyle(mix(color, 0x000000, 0.5)); g.fillRect(bedX, bodyY - 7, bedW, 2); }
    else { g.fillStyle(mix(color, 0x000000, 0.42)); g.fillRect(bedX, cabY, bedW, s.cabH + Math.round(s.bodyH * 0.4)); rimTL(g, bedX, cabY, bedW, s.cabH, color, 0.15); g.fillStyle(mix(color, 0x000000, 0.6), 0.5); for (let r = 1; r < 4; r++) g.fillRect(bedX + (bedW / 4) * r, cabY, 1.5, s.cabH); }
  }
  // dettagli silhouette: portiera, maniglia, specchietto, paraurti
  g.fillStyle(mix(color, 0x000000, 0.5)); g.fillRect(bx + s.len * 0.5, bodyY + 3, 1.5, s.bodyH - 5);
  g.fillStyle(mix(color, 0xffffff, 0.3)); g.fillRect(bx + s.len * 0.4, bodyY + s.bodyH * 0.42, 4, 1.5);
  g.fillStyle(mix(color, 0x000000, 0.35)); g.fillRect(cx0 - 3, cabY + 3, 3, 2);
  g.fillStyle(mix(color, 0x000000, 0.5)); g.fillRect(bx + s.len - 1, bodyY + s.bodyH - 5, 3, 5); g.fillRect(bx - 2, bodyY + s.bodyH - 5, 3, 5);
  // accenti per-veicolo (silhouette riconoscibile)
  switch (key) {
    case 'military_suv': g.fillStyle(mix(color, 0x000000, 0.4)); g.fillRect(cx0 + 2, cabY - 3, s.cabW - 4, 2); for (let r = 0; r < 3; r++) g.fillRect(cx0 + 5 + r * (s.cabW / 3), cabY - 3, 1.5, 3); break; // roof rack
    case 'armored_truck': case 'heavy_military': g.fillStyle(mix(color, 0x000000, 0.55)); g.fillRect(bx + s.len - 1, bodyY - 3, 3, s.bodyH + 6); g.fillStyle(mix(0x6a6a64, color, 0.3)); for (let r = 0; r < 4; r++) g.fillRect(cx0 + s.cabW + 4 + r * 7, bodyY - 6, 1.5, 9); break; // bull bar + cinghie
    case 'experimental': g.fillStyle(color); g.fillTriangle(bx + 3, bodyY, bx + 3, bodyY - 9, bx + 15, bodyY); g.fillStyle(0x6fd0ff, 0.55); g.fillRect(bx + 2, bodyY + s.bodyH - 2, s.len - 4, 2); break; // pinna + glow
    case 'armored_van': g.fillStyle(mix(color, 0x000000, 0.45)); g.fillRect(bx + s.len * 0.62, bodyY + 2, 1.5, s.bodyH - 4); g.fillRect(bx + s.len - 3, bodyY + 2, 1.5, s.bodyH - 4); break; // porte post.
  }
  g.fillStyle(0xfff0b0, 0.95); g.fillCircle(bx + s.len, bodyY + s.bodyH * 0.4, 2.4);                 // faro
  g.fillStyle(0xcc3322, 0.9); g.fillRect(bx, bodyY + s.bodyH * 0.3, 2, 5);                           // fanale post.
  g.generateTexture(tkey, CAR_FW, CAR_FH); g.destroy();
  return tkey;
}
function buildFigure(scene: Phaser.Scene, key: string, jacket: number, skin: number, cap: number) {
  if (scene.textures.exists(key)) return;
  const g = osGraphics(scene); const W = 24, H = 38;
  const trouser = mix(jacket, 0x000000, 0.5);
  g.fillStyle(trouser); g.fillRoundedRect(7, 25, 4, 10, 2); g.fillRoundedRect(13, 25, 4, 10, 2);       // gambe
  g.fillStyle(mix(trouser, 0xffffff, 0.12)); g.fillRect(7, 25, 1.5, 9); g.fillRect(13, 25, 1.5, 9);    // luce gambe
  g.fillStyle(0x14140f); g.fillRoundedRect(6, 33, 6, 4, 2); g.fillRoundedRect(12, 33, 6, 4, 2);        // stivali
  g.fillStyle(0x2a2a22); g.fillRect(6, 33, 6, 1.2); g.fillRect(12, 33, 6, 1.2);                        // luce stivali
  g.fillStyle(mix(jacket, 0x000000, 0.34)); g.fillRoundedRect(3, 14, 4, 11, 2); g.fillRoundedRect(17, 14, 4, 11, 2); // braccia
  g.fillStyle(mix(skin, 0x000000, 0.1)); g.fillCircle(5, 25, 1.9); g.fillCircle(19, 25, 1.9);          // mani
  g.fillStyle(mix(jacket, 0x000000, 0.15)); g.fillRoundedRect(5, 13, 14, 14, 5);                       // torso (ombra)
  g.fillStyle(jacket); g.fillRoundedRect(5, 13, 12, 14, 5);                                            // torso (mezzotono)
  g.fillStyle(mix(jacket, 0xffffff, 0.18)); g.fillRoundedRect(6, 13, 9, 5, 4);                         // luce alto-sx
  g.fillStyle(mix(jacket, 0x000000, 0.4), 0.6); g.fillRect(15, 14, 4, 12);                             // fianco dx ombra
  g.fillStyle(mix(jacket, 0x000000, 0.5)); g.fillRect(11, 14, 1.5, 12);                                // zip
  g.fillStyle(cap, 0.9); g.fillTriangle(8, 13, 16, 13, 12, 17);                                        // colletto a V (accento ruolo)
  g.fillStyle(mix(jacket, 0x000000, 0.4)); g.fillRect(7, 18, 4, 4);                                    // taschino
  g.fillStyle(0x2a2a22); g.fillRect(5, 23, 14, 2.4); g.fillStyle(0x6a5c40); g.fillRect(10, 23, 3, 2.4); // cintura + fibbia
  g.fillStyle(mix(jacket, 0x000000, 0.5)); g.fillRoundedRect(16, 15, 4, 9, 2);                         // zaino
  g.fillStyle(mix(skin, 0x000000, 0.28)); g.fillRect(10, 10, 4, 4);                                    // collo
  g.fillStyle(mix(skin, 0x000000, 0.18)); g.fillCircle(13, 8, 6);                                      // testa (ombra)
  g.fillStyle(skin); g.fillCircle(11, 7, 5.4);                                                         // testa (luce)
  g.fillStyle(mix(skin, 0xffffff, 0.22)); g.fillCircle(9, 5, 2.2);                                     // highlight fronte
  g.fillStyle(0x17110a); g.fillCircle(9.6, 7.4, 0.9); g.fillCircle(12.4, 7.4, 0.9);                    // occhi
  g.fillStyle(mix(cap, 0x000000, 0.35)); g.fillRoundedRect(6, 4.5, 12, 3, 2);                          // capelli
  g.fillStyle(cap); g.fillRoundedRect(6, 2, 11, 5, 3); g.fillStyle(mix(cap, 0x000000, 0.4)); g.fillRect(6, 6, 12, 1.6); // berretto + visiera
  g.fillStyle(mix(cap, 0xffffff, 0.2)); g.fillRect(7, 2.6, 7, 1.4);                                    // luce berretto
  g.generateTexture(key, W, H); g.destroy();
}
const NPC_PALETTE: Record<string, [number, number, number]> = {
  mechanic: [0x2f3d2c, 0xc99a6a, 0x2b2b33], medic: [0x3a4a52, 0xd8b48c, 0xeae8e0],
  soldier: [0x35402a, 0xc09a72, 0x454b34], explorer: [0x4a3a28, 0xd0a87c, 0x6e5e34], looter: [0x2a2438, 0xc89a78, 0x35322c],
};
function npcTexture(scene: Phaser.Scene, role: string): string {
  const key = `hub_npc_${role}`;
  const [jacket = 0x2f3d2c, skin = 0xc99a6a, cap = 0x1e1e24] = NPC_PALETTE[role] ?? [];
  buildFigure(scene, key, jacket, skin, cap);
  return key;
}

/** Terreno del lotto (bake denso, per-luogo): base + blotch + crepe + gomma + grana + detriti + pozze + edge-dark. */
function groundTexture(scene: Phaser.Scene, location: StopLocation, designW: number): string {
  const key = `hub_grnd_${location.key}`;
  if (scene.textures.exists(key)) return key;
  const W = Math.ceil(designW), H = 600 - HUB_HORIZON, base = location.hubGround, rng = makeRng(location.key + 'g');
  const lite = (t: number) => mix(base, 0xffffff, t), dark = (t: number) => mix(base, 0x000000, t);
  const g = scene.make.graphics({ add: false } as any) as G & { generateTexture(k: string, w: number, h: number): void };
  g.fillStyle(base); g.fillRect(0, 0, W, H);
  for (let n = 0; n < 50; n++) { const r = 14 + rng(n + 99) * 32; g.fillStyle(rng(n + 7) < 0.5 ? lite(0.05) : dark(0.15), 0.2); g.fillEllipse(rng(n) * W, rng(n + 50) * H, r * 2, r * 1.2); } // tonale subdola (no dischi)
  g.lineStyle(1, dark(0.45), 0.55);
  for (let n = 0; n < 24; n++) { let x = rng(n + 20) * W, y = rng(n + 40) * H; for (let s = 0; s < 4; s++) { const nx = x + (rng(n * 4 + s) - 0.5) * 60, ny = y + (rng(n * 4 + s + 99) - 0.5) * 44; g.lineBetween(x, y, nx, ny); x = nx; y = ny; } }
  g.lineStyle(4, dark(0.4), 0.3);
  for (let n = 0; n < 6; n++) { const x = rng(n + 70) * W, y = rng(n + 80) * H; g.lineBetween(x, y, x + 30 + rng(n) * 50, y + (rng(n + 5) - 0.5) * 18); g.lineBetween(x + 6, y, x + 36 + rng(n) * 50, y + (rng(n + 5) - 0.5) * 18 + 6); }
  for (let n = 0; n < 360; n++) { g.fillStyle(rng(n + 600) < 0.5 ? lite(0.12) : dark(0.32), 0.45); g.fillRect(rng(n + 200) * W, rng(n + 400) * H, 2, 2); }
  for (let n = 0; n < 80; n++) { g.fillStyle(rng(n + 900) < 0.5 ? dark(0.5) : lite(0.05), 0.7); const s = 2 + rng(n + 950) * 4; g.fillRect(rng(n + 700) * W, rng(n + 800) * H, s + 2, s); }
  for (let n = 0; n < 7; n++) { const px = rng(n + 11) * W, py = H * 0.3 + rng(n + 33) * H * 0.65; g.fillStyle(0x000000, 0.42); g.fillEllipse(px, py, 30 + rng(n) * 26, 13 + rng(n) * 8); g.fillStyle(0x3a4655, 0.16); g.fillEllipse(px - 3, py - 2, 16, 6); }
  // 7. segnaletica sbiadita: linee di sosta verticali + strisce di pericolo + canale di scolo
  g.fillStyle(lite(0.16), 0.16); for (let n = 0; n < 5; n++) g.fillRect((n + 0.5) / 5 * W + (rng(n + 11) - 0.5) * 26, H * 0.32, 3, H * 0.5);
  g.fillStyle(0x8a7a30, 0.12); for (let n = 0; n < 16; n++) g.fillRect(W * 0.32 + n * 13, H * 0.1, 8, 5);
  g.fillStyle(dark(0.5), 0.5); g.fillRect(0, Math.round(H * 0.6), W, 3); g.fillStyle(lite(0.06), 0.3); g.fillRect(0, Math.round(H * 0.6) - 1, W, 1);
  // 8. tombini / griglie
  for (let n = 0; n < 3; n++) { const mx = rng(n + 500) * W, my = H * 0.42 + rng(n + 510) * H * 0.5; g.fillStyle(dark(0.42)); g.fillCircle(mx, my, 8); g.lineStyle(1, dark(0.6), 0.7); for (let r = -6; r <= 6; r += 3) g.lineBetween(mx - 7, my + r, mx + 7, my + r); g.lineStyle(1, lite(0.1), 0.4); g.strokeCircle(mx, my, 8); }
  // 9. litter chiaro (carte/lattine)
  for (let n = 0; n < 34; n++) { g.fillStyle(lite(0.2), 0.32); g.fillRect(rng(n + 300) * W, rng(n + 320) * H, 2 + rng(n) * 3, 1.5); }
  const e = dark(0.62), ex = Math.round(W * 0.17), ey = Math.round(H * 0.24);
  g.fillGradientStyle(e, e, e, e, 0, 0, 0.6, 0.6); g.fillRect(0, H - ey, W, ey);
  g.fillGradientStyle(e, e, e, e, 0.5, 0.5, 0, 0); g.fillRect(0, 0, W, ey);
  g.fillGradientStyle(e, e, e, e, 0.55, 0, 0.55, 0); g.fillRect(0, 0, ex, H);
  g.fillGradientStyle(e, e, e, e, 0, 0.55, 0, 0.55); g.fillRect(W - ex, 0, ex, H);
  g.generateTexture(key, W, H); g.destroy();
  return key;
}

// ─── Sfondo: cielo ridotto + MURO/EDIFICIO di fondo (chiude la scena) ────────────
function drawBackground(scene: Phaser.Scene, location: StopLocation, L: HubLight, designW: number, rng: (n: number) => number) {
  const sky = scene.add.graphics().setDepth(0);
  const zenith = mix(location.hubSky, 0x000000, 0.5), horizon = mix(location.hubSky, L.color, 0.16);
  sky.fillGradientStyle(zenith, zenith, horizon, horizon, 1, 1, 1, 1); sky.fillRect(0, 0, designW, HUB_HORIZON + 4);
  sky.fillStyle(L.color, 0.05); sky.fillEllipse(L.x, WALL_TOP, 460, 200);                 // alone/inquinamento sopra la sosta
  if (L.warmth < 0.5) { sky.fillStyle(0xaab4c8, 0.5); for (let n = 0; n < 28; n++) sky.fillRect(rng(n) * designW, rng(n + 40) * WALL_TOP, 1, 1); }

  // skyline lontana che spunta SOPRA il muro (prospettiva aerea: più chiara = più lontana)
  const sil = scene.add.graphics().setDepth(1);
  const far = mix(location.hubSky, 0x424a5a, 0.55);
  for (let x = -10; x < designW + 20; x += 96) drawFarBox(sil, x + rng(x + 9) * 30, WALL_TOP + 8, 36 + rng(x) * 40, 18 + rng(x + 5) * 40, far);

  // ── MURO/EDIFICIO di fondo a tutta larghezza (chiude la scena, riempie il frame) ──
  const wall = scene.add.graphics().setDepth(1.2);
  const wc = mix(location.hubGround, 0x000000, 0.2);
  wall.fillStyle(wc); wall.fillRect(0, WALL_TOP + 6, designW, HUB_HORIZON - WALL_TOP - 6);
  wall.fillStyle(mix(wc, 0xffffff, 0.07)); wall.fillRect(0, WALL_TOP + 6, designW, 4);          // cornicione (luce)
  wall.fillStyle(mix(wc, 0x000000, 0.45)); wall.fillRect(0, HUB_HORIZON - 7, designW, 7);       // ombra alla base
  wall.fillStyle(mix(wc, 0x000000, 0.28), 0.5); for (let x = 0; x < designW; x += 11) wall.fillRect(x, WALL_TOP + 12, 2, HUB_HORIZON - WALL_TOP - 22); // corrugazione (ombra)
  wall.fillStyle(mix(wc, 0xffffff, 0.05), 0.4); for (let x = 6; x < designW; x += 11) wall.fillRect(x, WALL_TOP + 12, 1, HUB_HORIZON - WALL_TOP - 22);  // corrugazione (luce)
  wall.fillStyle(mix(wc, 0x000000, 0.5), 0.6); for (let y = WALL_TOP + 26; y < HUB_HORIZON - 12; y += 34) wall.fillRect(0, y, designW, 2);             // travi orizzontali

  // finestre opache (scure) sparse + alcune ILLUMINATE (additive, sopra la penombra)
  const winLit = scene.add.graphics().setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
  for (let n = 0; n < 16; n++) { const wx = 18 + rng(n + 210) * (designW - 50), wy = WALL_TOP + 20 + rng(n + 220) * (HUB_HORIZON - WALL_TOP - 54);
    wall.fillStyle(0x05060a); wall.fillRect(wx, wy, 12, 9); rimTL(wall, wx, wy, 12, 9, wc, 0.18);
    if (rng(n + 280) < 0.25) { wall.fillStyle(mix(wc, 0x000000, 0.5)); for (let b = 1; b < 4; b++) wall.fillRect(wx, wy + b * 2.2, 12, 1); } // finestra murata/assi
    else if (rng(n + 260) < 0.4) { winLit.fillStyle(mix(L.color, 0xffffff, 0.4), 0.45); winLit.fillRect(wx + 1, wy + 1, 10, 7); } } // illuminata

  // tubi verticali + conduit orizzontale + colature di ruggine + scaletta (dettaglio industriale)
  for (const px of [designW * 0.12, designW * 0.4, designW * 0.86]) { wall.fillStyle(mix(wc, 0xffffff, 0.08)); wall.fillRect(px, WALL_TOP + 8, 4, HUB_HORIZON - WALL_TOP - 14); wall.fillStyle(mix(wc, 0x000000, 0.35)); wall.fillRect(px + 3, WALL_TOP + 8, 2, HUB_HORIZON - WALL_TOP - 14); }
  wall.fillStyle(mix(wc, 0x000000, 0.4)); wall.fillRect(0, WALL_TOP + 38, designW, 3); wall.fillStyle(mix(wc, 0xffffff, 0.06)); wall.fillRect(0, WALL_TOP + 38, designW, 1); // conduit
  wall.fillStyle(mix(0x4a2a16, wc, 0.35), 0.35); for (let n = 0; n < 9; n++) { const rx = rng(n + 400) * designW; wall.fillRect(rx, WALL_TOP + 14, 5, (HUB_HORIZON - WALL_TOP) * (0.3 + rng(n + 401) * 0.5)); } // ruggine
  const ladX = Math.round(designW * 0.2); wall.fillStyle(mix(wc, 0xffffff, 0.12)); wall.fillRect(ladX, WALL_TOP + 10, 2, HUB_HORIZON - WALL_TOP - 16); wall.fillRect(ladX + 11, WALL_TOP + 10, 2, HUB_HORIZON - WALL_TOP - 16); for (let y = WALL_TOP + 16; y < HUB_HORIZON - 8; y += 9) wall.fillRect(ladX, y, 13, 2); // scaletta

  drawBackdropFeature(scene, location, L, designW, rng, wc);
}

/** Elemento-firma sul muro di fondo per ciascun luogo (porta/serbatoi/container/torre/tende). */
function drawBackdropFeature(scene: Phaser.Scene, location: StopLocation, L: HubLight, designW: number, rng: (n: number) => number, wc: number) {
  const g = scene.add.graphics().setDepth(1.4);
  const cx = Math.round(designW * 0.66), B = HUB_HORIZON;
  switch (location.key) {
    case 'garage': // serranda + insegna OFFICINA
      g.fillStyle(mix(wc, 0x000000, 0.35)); g.fillRect(cx - 46, B - 92, 92, 86);
      g.fillStyle(mix(wc, 0xffffff, 0.06)); for (let y = B - 88; y < B - 6; y += 7) g.fillRect(cx - 44, y, 88, 3); // doghe serranda
      g.fillStyle(mix(wc, 0x000000, 0.5)); g.fillRect(cx - 48, B - 94, 96, 4);
      g.lineStyle(2, L.color, 0.8); g.strokeRoundedRect(cx + 60, B - 80, 10, 40, 3); // tubo al neon verticale
      break;
    case 'depot': // serbatoi cilindrici + tubi
      for (const dx of [-150, 130]) { g.fillStyle(mix(wc, 0x000000, 0.3)); g.fillRoundedRect(cx + dx, B - 110, 70, 104, 10);
        g.fillStyle(mix(wc, 0xffffff, 0.08)); g.fillRect(cx + dx + 8, B - 110, 14, 104); g.fillStyle(mix(wc, 0x000000, 0.4)); g.fillRect(cx + dx + 56, B - 110, 12, 104);
        g.lineStyle(2, mix(wc, 0x000000, 0.5), 0.6); g.strokeRect(cx + dx, B - 78, 70, 2); }
      g.fillStyle(mix(wc, 0x000000, 0.4)); g.fillRect(cx - 80, B - 40, 160, 5); // tubo orizzontale
      break;
    case 'camp': // tende + barricata di lamiere
      for (const dx of [-120, -70, 90, 150]) { g.fillStyle(mix(wc, 0x000000, 0.3)); g.fillTriangle(cx + dx - 26, B - 6, cx + dx, B - 54, cx + dx + 26, B - 6);
        g.fillStyle(mix(wc, 0x000000, 0.5)); g.fillTriangle(cx + dx, B - 54, cx + dx + 26, B - 6, cx + dx + 8, B - 6); g.fillStyle(mix(L.color, 0x000000, 0.2), 0.3); g.fillRect(cx + dx - 2, B - 30, 4, 24); }
      break;
    case 'checkpoint': // torretta di guardia + muro blast
      g.fillStyle(mix(wc, 0x000000, 0.3)); g.fillRect(cx - 26, B - 120, 52, 114);
      g.fillStyle(mix(wc, 0xffffff, 0.06)); g.fillRect(cx - 26, B - 120, 52, 4);
      g.fillStyle(0x05060a); g.fillRect(cx - 18, B - 110, 36, 16); g.fillStyle(mix(L.color, 0xffffff, 0.3), 0.5); g.fillRect(cx - 16, B - 108, 32, 4); // vetri illuminati cabina
      g.fillStyle(mix(wc, 0x000000, 0.45)); g.fillRect(cx - 30, B - 6, 60, 6);
      break;
    case 'market': // muro di container impilati
      for (let i = 0; i < 7; i++) { const bx = -20 + i * (designW / 6), bw = designW / 6 - 6, c = [0x3a2a2a, 0x2a3a3a, 0x3a3a2a][i % 3]!;
        const h = 40 + rng(i + 5) * 30; g.fillStyle(mix(c, 0x000000, 0.45)); g.fillRect(bx, B - h - 6, bw, h);
        g.fillStyle(mix(c, 0x000000, 0.6)); for (let r = 1; r < 5; r++) g.fillRect(bx + (bw / 5) * r, B - h - 6, 1.5, h); g.fillStyle(mix(c, 0xffffff, 0.06)); g.fillRect(bx, B - h - 6, bw, 3); }
      break;
  }
}

/** Stazione-eroe del luogo (3+ toni, kit metallo, accento emissivo). I bloom di luce stanno in renderHub. */
function drawStation(scene: Phaser.Scene, location: StopLocation, L: HubLight, sx: number, sy: number) {
  dropShadow(scene, L, sx, sy, 110, sy);
  const g = scene.add.graphics().setDepth(sy);
  const M = 0x4a4a52, MD = 0x26262c, ML = 0x70707a, a = location.accent;
  const sign = (x: number, y: number, w: number) => { g.fillStyle(0x101014); g.fillRoundedRect(x - w / 2, y, w, 14, 3); g.fillStyle(a, 0.95); g.fillRoundedRect(x - w / 2 + 4, y + 3, w - 8, 7, 2); g.fillStyle(0xffffff, 0.9); g.fillRect(x - w / 2 + 6, y + 4, w - 12, 1.5); };
  switch (location.key) {
    case 'garage': {
      g.fillStyle(MD); g.fillRect(sx - 50, sy - 30, 100, 30); g.fillStyle(M); g.fillRect(sx - 50, sy - 30, 100, 22); g.fillStyle(ML); g.fillRect(sx - 50, sy - 30, 100, 7);
      rimTL(g, sx - 50, sy - 30, 100, 30, M, 0.45);
      g.fillStyle(mix(M, 0xffffff, 0.18)); g.fillRect(sx - 50, sy - 33, 100, 4); g.fillStyle(MD, 0.7); for (let i = 0; i < 6; i++) g.fillRect(sx - 42 + i * 14, sy - 32, 7, 1);
      g.fillStyle(MD); for (let i = 0; i < 4; i++) g.fillRect(sx - 44 + i * 24, sy - 24, 20, 22); g.fillStyle(M, 0.5); for (let i = 0; i < 4; i++) g.fillRect(sx - 44 + i * 24, sy - 24, 20, 2);
      shadeCyl(g, sx - 48, sy - 38, 11, 10, M); sign(sx, sy - 54, 66); break;
    }
    case 'depot': {
      for (const dx of [-58, -34]) { shadeCyl(g, sx + dx, sy - 44, 18, 44, M);
        g.fillStyle(0x101014); g.fillRect(sx + dx + 3, sy - 38, 12, 9); g.fillStyle(a, 0.9); g.fillRect(sx + dx + 4, sy - 37, 10, 6);
        g.fillStyle(0x000000, 0.3); for (let i = 0; i < 5; i++) g.fillRect(sx + dx + 4, sy - 37 + i * 1.4, 10, 0.6); g.fillStyle(MD); g.fillRect(sx + dx + 7, sy - 13, 4, 13); }
      g.fillStyle(MD); g.fillRect(sx - 66, sy - 62, 54, 5); g.fillStyle(M); g.fillRect(sx - 66, sy - 62, 54, 2);
      g.fillStyle(MD); g.fillRect(sx + 32, sy - 36, 40, 36); g.fillStyle(M); g.fillRect(sx + 32, sy - 36, 40, 26); g.fillStyle(ML); g.fillRect(sx + 32, sy - 36, 40, 7); rimTL(g, sx + 32, sy - 36, 40, 36, M, 0.4);
      g.fillStyle(0x101014); g.fillRect(sx + 38, sy - 30, 28, 15); g.fillStyle(a, 0.5); g.fillRect(sx + 38, sy - 30, 28, 2); sign(sx + 52, sy - 52, 38); break;
    }
    case 'camp': {
      g.fillStyle(0x2a241e); for (let i = 0; i < 9; i++) { const ang = i / 9 * Math.PI; g.fillEllipse(sx + Math.cos(ang) * 22, sy + 3, 7, 4); }
      shadeCyl(g, sx - 16, sy - 7, 32, 8, 0x3a2818); g.fillStyle(0xff5a20, 0.9); for (let i = 0; i < 6; i++) g.fillCircle(sx - 12 + i * 5, sy - 2, 1.8);
      g.fillStyle(0x6a4424); g.fillRect(sx - 18, sy - 7, 36, 4); g.fillRect(sx - 5, sy - 16, 4, 13);
      g.fillStyle(0xff7a22, 0.95); g.fillTriangle(sx - 11, sy - 5, sx, sy - 34, sx + 11, sy - 5);
      g.fillStyle(0xffd24a, 0.95); g.fillTriangle(sx - 6, sy - 5, sx + 1, sy - 23, sx + 6, sy - 5); break;
    }
    case 'checkpoint': {
      sandbags(g, sx - 38, sy - 12, 7); sandbags(g, sx - 26, sy - 23, 5);
      g.fillStyle(0x6a6a64); g.fillRect(sx - 6, sy - 50, 4, 50); g.fillStyle(MD); g.fillRect(sx - 34, sy - 38, 68, 4);
      g.fillStyle(0xcc4422); for (let i = 0; i < 7; i++) g.fillRect(sx - 34 + i * 10, sy - 38, 5, 4);
      g.fillStyle(MD); g.fillTriangle(sx + 32, sy, sx + 42, sy, sx + 37, sy - 30); g.fillStyle(0xfff4d0, 0.95); g.fillCircle(sx + 37, sy - 32, 4); break;
    }
    case 'market': {
      g.fillStyle(0x14141a); g.fillRect(sx - 42, sy - 9, 84, 9);
      g.fillStyle(MD); g.fillRect(sx - 40, sy - 34, 3, 34); g.fillRect(sx + 37, sy - 34, 3, 34);
      g.fillStyle(0x241826); g.fillRect(sx - 44, sy - 36, 88, 7); g.fillStyle(a, 0.6); for (let i = 0; i < 9; i++) g.fillTriangle(sx - 42 + i * 9.6, sy - 29, sx - 37 + i * 9.6, sy - 29, sx - 39.5 + i * 9.6, sy - 24);
      for (let i = 0; i < 6; i++) drawLitProp(g, L, sx - 30 + i * 13, sy - 13, 9, 8, mix(0x4a3a2a, a, 0.15)); sign(sx, sy - 54, 60); break;
    }
  }
}

/** Pneumatico abbandonato (vista a terra). */
function tire(g: G, x: number, y: number) {
  g.fillStyle(0x000000, 0.3); g.fillEllipse(x + 1, y + 2, 18, 9);
  g.fillStyle(0x16161c); g.fillEllipse(x, y, 16, 8);
  g.fillStyle(0x05050a); g.fillEllipse(x, y, 8, 4);
  g.fillStyle(0x2a2a30, 0.6); g.fillEllipse(x - 1, y - 1.5, 11, 4);
}
/** Bancale di legno. */
function pallet(g: G, x: number, y: number) {
  g.fillStyle(0x000000, 0.25); g.fillRect(x - 13, y - 2, 28, 6);
  g.fillStyle(0x4a3a24); g.fillRect(x - 14, y - 6, 28, 6);
  g.fillStyle(0x3a2c18); for (let i = 0; i < 4; i++) g.fillRect(x - 14 + i * 8, y - 6, 2, 6);
  g.fillStyle(0x5a4830, 0.6); g.fillRect(x - 14, y - 6, 28, 1.5);
}
/** Cono stradale. */
function cone(g: G, x: number, y: number) {
  g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y + 1, 12, 5);
  g.fillStyle(0xcc5a1a); g.fillTriangle(x - 6, y, x + 6, y, x, y - 15);
  g.fillStyle(0xe8e0d0); g.fillTriangle(x - 3.5, y - 6, x + 3.5, y - 6, x, y - 11);
  g.fillStyle(0xcc5a1a); g.fillTriangle(x - 2, y - 9, x + 2, y - 9, x, y - 11);
  g.fillStyle(0x9a4010); g.fillRect(x - 7, y - 1, 14, 2);
}
/** Tanica di carburante. */
function jerrycan(g: G, x: number, y: number, color: number) {
  g.fillStyle(0x000000, 0.25); g.fillEllipse(x, y + 1, 12, 5);
  g.fillStyle(mix(color, 0x000000, 0.3)); g.fillRoundedRect(x - 6, y - 13, 12, 13, 2);
  g.fillStyle(color); g.fillRoundedRect(x - 6, y - 13, 9, 13, 2);
  g.fillStyle(mix(color, 0xffffff, 0.2)); g.fillRect(x - 5, y - 12, 3, 11);
  g.fillStyle(mix(color, 0x000000, 0.5)); g.fillRect(x - 2, y - 15, 5, 3);
  rimTL(g, x - 6, y - 13, 12, 13, color, 0.2);
}
/** Relitto d'auto (clutter eroe, vista laterale rovinata). */
function drawWreck(scene: Phaser.Scene, L: HubLight, x: number, y: number, colliders: Collider[]) {
  const depth = y, g = scene.add.graphics().setDepth(depth);
  dropShadow(scene, L, x, y, 74, depth);
  const body = mix(0x4a3a2a, 0x000000, 0.28);
  g.fillStyle(mix(body, 0x000000, 0.3)); g.fillRoundedRect(x - 36, y - 14, 70, 30, 6);
  g.fillStyle(body); g.fillRoundedRect(x - 36, y - 18, 66, 30, 7);
  rimTL(g, x - 36, y - 18, 66, 30, body, 0.16);
  g.fillStyle(mix(body, 0x000000, 0.45)); g.fillRoundedRect(x - 16, y - 13, 38, 16, 5);   // cabina sfondata
  g.fillStyle(0x050505); g.fillRect(x - 12, y - 10, 32, 6); g.fillRect(x - 12, y + 1, 32, 4); // vetri rotti
  g.fillStyle(0x5a3a1a, 0.45); for (let i = 0; i < 7; i++) g.fillEllipse(x - 30 + i * 10, y - 10 + (i % 2) * 18, 5, 3); // ruggine
  g.fillStyle(0x0a0a0a); g.fillCircle(x - 24, y + 14, 6); g.fillStyle(0x2a2a2a); g.fillCircle(x + 26, y + 14, 3); // una ruota + mozzo nudo
  colliders.push({ x, y: y - 2, r: 30 });
}
function drawProps(scene: Phaser.Scene, location: StopLocation, L: HubLight, designW: number, sx: number, sy: number, rng: (n: number) => number, colliders: Collider[]) {
  const blocked = (px: number, py: number) => Math.hypot(px - 150, py - 432) < 78 || Math.hypot(px - sx, py - sy) < 94 || Math.hypot(px - 260, py - 476) < 46;
  const place = (px: number, py: number, i: number) => {
    if (blocked(px, py)) return;
    const depth = py, gg = scene.add.graphics().setDepth(depth);
    dropShadow(scene, L, px, py, 24, depth);
    const r = rng(i + 40), can = [0xcc3322, 0x4a7a3a, 0xc89a30][i % 3]!;
    if (r > 0.84) { barrel(gg, px, py - 6, mix(0x3a342c, L.color, 0.08)); barrel(gg, px + 11, py - 3, 0x35322a); if (rng(i + 88) > 0.5) barrel(gg, px + 5, py - 14, 0x3a342c); colliders.push({ x: px + 5, y: py - 5, r: 14 }); }
    else if (r > 0.66) { crate(gg, px - 8, py - 13, mix(location.hubGround, 0x3a3a2a, 0.45)); if (rng(i + 99) > 0.45) crate(gg, px - 7, py - 25, 0x33302a); if (rng(i + 70) > 0.6) crate(gg, px + 9, py - 13, 0x35322c); colliders.push({ x: px, y: py - 8, r: 13 }); }
    else if (r > 0.54) { tire(gg, px, py); if (rng(i + 60) > 0.5) tire(gg, px + 6, py - 2); colliders.push({ x: px, y: py - 3, r: 10 }); }
    else if (r > 0.42) { pallet(gg, px, py); if (rng(i + 61) > 0.5) crate(gg, px - 7, py - 19, 0x35322c); colliders.push({ x: px, y: py - 6, r: 13 }); }
    else if (r > 0.3) { cone(gg, px, py); if (rng(i + 62) > 0.4) jerrycan(gg, px + 9, py - 1, can); colliders.push({ x: px, y: py - 4, r: 8 }); }
    else if (r > 0.18) { jerrycan(gg, px, py, can); jerrycan(gg, px + 9, py - 2, 0x556644); colliders.push({ x: px + 4, y: py - 6, r: 10 }); }
    else { drawLitProp(gg, L, px, py, 17, 19, 0x33302a); colliders.push({ x: px, y: py - 9, r: 11 }); }
  };
  // griglia jitterata su TUTTO il pavimento (cortile di fondo + zona calpestabile)
  const cols = 8, rows = 4; let i = 0;
  for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
    i++; if (rng(c * 11 + rr + 1) < 0.2) continue;
    const px = 56 + (c + 0.5) / cols * (designW - 112) + (rng(c * 13 + rr) - 0.5) * 64;
    const py = HUB_HORIZON + 14 + (rr + 0.5) / rows * (560 - HUB_HORIZON) + (rng(c + rr * 9) - 0.5) * 40;
    place(px, py, i);
  }
  // relitti d'auto (clutter eroe, narrativa)
  drawWreck(scene, L, 250 + rng(900) * 90, HUB_HORIZON + 42 + rng(901) * 46, colliders);
  if (rng(902) > 0.45) drawWreck(scene, L, designW - 170 + rng(903) * 70, 478 + rng(904) * 46, colliders);
}

function drawForeground(scene: Phaser.Scene, location: StopLocation, designW: number) {
  const dark = mix(location.hubGround, 0x000000, 0.74);
  const g = scene.add.graphics().setDepth(560);
  g.fillStyle(dark); g.fillRect(10, 350, 12, 250); g.fillStyle(mix(dark, 0x000000, 0.4)); g.fillRect(10, 350, 4, 250); // palo sx (fuori dall'area calpestabile)
  g.fillStyle(dark); g.fillRect(designW - 24, 388, 12, 212); g.fillStyle(mix(dark, 0xffffff, 0.05)); g.fillRect(designW - 24, 388, 2, 212); // montante dx
  // cavi sospesi che incorniciano dall'alto (sag tipo catenaria) + lampadina spenta
  const cable = mix(location.hubGround, 0x000000, 0.82);
  g.lineStyle(2.4, cable, 0.9);
  for (const c of [[118, 30], [148, 22]] as Array<[number, number]>) { g.beginPath(); g.moveTo(0, c[0]); for (let x = 0; x <= designW; x += 26) g.lineTo(x, c[0] + Math.sin(Math.PI * x / designW) * c[1]); g.strokePath(); }
  g.lineStyle(1.4, cable, 0.8); g.lineBetween(designW * 0.55, 148, designW * 0.55, 178);
  g.fillStyle(0x2a2a26); g.fillCircle(designW * 0.55, 182, 4); g.fillStyle(0x44443a, 0.5); g.fillCircle(designW * 0.55 - 1, 181, 1.5);
}

function drawParticles(scene: Phaser.Scene, L: HubLight, sx: number, sy: number, warm: boolean, designW: number) {
  if (warm) {
    scene.add.particles(sx, sy - 18, 'particle', {
      speedX: { min: -12, max: 12 }, speedY: { min: -42, max: -14 }, scale: { start: 0.55 / OVERSAMPLE, end: 0 },
      alpha: { start: 0.85, end: 0 }, lifespan: 2000, frequency: 45, quantity: 2, tint: [0xffd24a, 0xff7a22, 0xff5520], blendMode: 'ADD',
    }).setDepth(800);
    scene.add.particles(sx, sy - 18, 'particle', {
      speedX: { min: -8, max: 8 }, speedY: { min: -72, max: -32 }, scale: { start: 0.4 / OVERSAMPLE, end: 0 },
      alpha: { start: 1, end: 0 }, lifespan: 1300, frequency: 360, quantity: 1, tint: 0xffe080, blendMode: 'ADD',
    }).setDepth(801);
  } else {
    scene.add.particles(L.x, L.y + 24, 'particle', {
      speedX: { min: -5, max: 5 }, speedY: { min: -14, max: -2 }, scale: { start: 0.4 / OVERSAMPLE, end: 0 },
      alpha: { start: 0.22, end: 0 }, lifespan: 3600, frequency: 300, quantity: 1, tint: 0x99a4b8,
    }).setDepth(800);
  }
  // pulviscolo d'ambiente diffuso su tutta la scena (atmosfera, profondità)
  scene.add.particles(0, 0, 'particle', {
    x: { min: 40, max: designW - 40 }, y: { min: 230, max: 545 },
    speedX: { min: -4, max: 4 }, speedY: { min: -6, max: 3 }, scale: { start: 0.32 / OVERSAMPLE, end: 0 },
    alpha: { start: 0.12, end: 0 }, lifespan: 4200, frequency: 110, quantity: 1, tint: 0x9aa0aa,
  }).setDepth(700);
}

/** Rende l'intero hub e restituisce stazioni, collider e il bloom-sorgente (per il flicker). */
export function renderHub(scene: Phaser.Scene, location: StopLocation, designW: number): HubLayout {
  Shadows.buildTexture(scene);
  const rng = makeRng(location.key);
  const warm = location.key === 'camp' || location.key === 'market';
  const sx = Math.round(designW * 0.66), sy = 372;
  const hl = location.hubLight;
  const L: HubLight = { x: sx + hl.offX, y: sy + hl.offY, color: location.accent, warmth: hl.warmth, reach: hl.reach };
  const colliders: Collider[] = [];

  drawBackground(scene, location, L, designW, rng);
  scene.add.image(0, HUB_HORIZON, groundTexture(scene, location, designW)).setOrigin(0, 0).setDepth(2);
  scene.add.rectangle(designW / 2, 300, designW, 600, 0x000000, 0.18).setDepth(2.9); // penombra globale (più leggera)

  // LUCE: pozza a terra additiva (flattened) SOTTO gli oggetti — niente disco gigante che galleggia.
  scene.add.image(sx, sy + 12, 'fx_light').setTint(L.color).setBlendMode(Phaser.BlendModes.ADD)
    .setScale(warm ? 4.4 : 3.8, warm ? 2.6 : 2.2).setAlpha(warm ? 0.4 : 0.3).setDepth(3);

  drawStation(scene, location, L, sx, sy);
  drawProps(scene, location, L, designW, sx, sy, rng, colliders);
  location.hubNpcs.forEach((role, i) => {
    const nx = sx + (i === 0 ? -66 : 60) + (i > 1 ? (i - 1) * 30 : 0), ny = sy + 42 + i * 5;
    dropShadow(scene, L, nx, ny, 22, ny);
    scene.add.image(nx, ny, npcTexture(scene, role)).setOrigin(0.5, 1).setScale(1 / OVERSAMPLE).setDepth(ny);
    colliders.push({ x: nx, y: ny - 8, r: 11 });
  });
  // figure ambientali sparse nel cortile (popolano il vuoto centrale; dialoghi = Tier C, in arrivo)
  const AMB = ['soldier', 'looter', 'explorer', 'medic', 'mechanic'];
  for (let k = 0, n = warm ? 3 : 2; k < n; k++) {
    const ax = 300 + rng(k + 300) * 210, ay = 410 + rng(k + 310) * 116;
    const role = AMB[(k + location.key.length) % AMB.length]!;
    dropShadow(scene, L, ax, ay, 22, ay);
    scene.add.image(ax, ay, npcTexture(scene, role)).setOrigin(0.5, 1).setScale(1 / OVERSAMPLE).setDepth(ay).setFlipX(rng(k + 320) > 0.5);
    colliders.push({ x: ax, y: ay - 8, r: 11 });
  }
  drawForeground(scene, location, designW);
  drawParticles(scene, L, sx, sy, warm, designW);

  // Bloom STRETTO alla sorgente (insegna/fuoco): il punto luminoso che "accende", non un disco scenico.
  const glowScale = warm ? 1.9 : 1.5, glowAlpha = warm ? 0.85 : 0.6;
  const glow = scene.add.image(L.x, L.y, 'fx_light').setTint(mix(L.color, 0xffffff, 0.4)).setBlendMode(Phaser.BlendModes.ADD)
    .setScale(glowScale).setAlpha(glowAlpha).setDepth(sy + 1);
  if (location.key === 'depot') scene.add.image(sx + 52, sy - 34, 'fx_light').setTint(mix(L.color, 0xffffff, 0.4)).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3).setAlpha(0.6).setDepth(sy + 1);

  let service: { x: number; y: number };
  let pump: { x: number; y: number } | null = null;
  if (location.key === 'depot') {
    pump = { x: sx - 46, y: sy + 6 }; service = { x: sx + 52, y: sy + 6 };
    colliders.push({ x: sx - 46, y: sy - 22, r: 34 }, { x: sx + 52, y: sy - 16, r: 24 });
  } else {
    service = { x: sx, y: sy + 6 };
    colliders.push({ x: sx, y: sy - 16, r: 42 });
  }
  return { service, pump, light: L, colliders, glow, glowScale, glowAlpha, warm };
}
