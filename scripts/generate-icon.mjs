// Generatore dell'ICONA dell'app desktop — 100% PROCEDURALE, in puro Node (zero dipendenze).
//
// Coerente con la filosofia del titolo ("grafica procedurale, niente asset esterni"): l'icona NON è
// un PNG disegnato a mano ma GEOMETRIA calcolata da codice. Qui non c'è Phaser (siamo fuori dal
// browser), quindi il file porta con sé un mini-rasterizzatore software (Canvas RGBA), un encoder PNG
// (via lo zlib integrato di Node) e un packer .ico multi-size. La regola "niente PNG" del progetto
// riguarda la GRAFICA DI GIOCO; il packaging desktop (build/icon.ico) è la deroga prevista in
// electron-builder.yml.
//
// CONCEPT — "Blood-Moon Gun-Truck": badge survival-horror, luna di sangue (desaturata, sotto-valore),
// veicolo blindato oliva (linea armored_van) in 3/4, ACCENTO EROE = muzzle-flash arancio-fuoco dalla
// torretta sul tetto (firma del combat-reboot mira-col-mouse), fari bianco-caldi secondari, zombi
// caduto con occhio rosso. La ricetta a 34 step nasce da un panel di design e applica i fix di
// leggibilità: piano-luce del veicolo spinto a ~48% luma + contorno quasi-nero per staccare la
// silhouette dal disco e dal badge in scala di grigi. Vedi docs/ART_BIBLE_ICONE.md / _OGGETTI.md /
// _ZOMBIES.md. Luce alto-sinistra coerente col resto del titolo.
//
// Pipeline: per ogni dimensione bersaglio si disegna un master a 4× (sovracampionamento) con il livello
// di dettaglio adatto (gating per dimensione: layer invisibili sotto i 32/64 px non vengono disegnati),
// poi si riduce con un filtro area-weighted → bordi anti-aliasati e nitidi anche a 16/32 px.

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ───────────────────────────── Mini-rasterizzatore RGBA ─────────────────────────────
// Coordinate in PIXEL del master (float). Bordi "duri": l'anti-alias arriva dalla riduzione area.
// Alpha "dritta" (non premoltiplicata); blending src-over. Clip opzionale (predicato per-pixel).

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Float64Array(w * h * 4); this._clip = null; }

  setClip(fn) { const prev = this._clip; this._clip = fn; return prev; }

  _blend(x, y, r, g, b, a) {
    if (a <= 0) return;
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (this._clip && !this._clip(x, y)) return;
    const i = (y * this.w + x) * 4, d = this.d;
    const sa = a, da = d[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; return; }
    d[i]     = (r * sa + d[i]     * da * (1 - sa)) / outA;
    d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / outA;
    d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / outA;
    d[i + 3] = outA * 255;
  }

  fillRect(x, y, w, h, col, a = 1) {
    const [r, g, b] = rgb(col);
    const x0 = Math.round(x), y0 = Math.round(y), x1 = Math.round(x + w), y1 = Math.round(y + h);
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) this._blend(px, py, r, g, b, a);
  }

  fillCircle(cx, cy, rad, col, a = 1) { this.fillEllipse(cx, cy, rad, rad, col, a); }

  fillEllipse(cx, cy, rx, ry, col, a = 1) {
    const [r, g, b] = rgb(col);
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const dx = (px + 0.5 - cx) / rx, dy = (py + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this._blend(px, py, r, g, b, a);
    }
  }

  fillPoly(pts, col, a = 1) {
    const [r, g, b] = rgb(col);
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
    const y0 = Math.floor(minY), y1 = Math.ceil(maxY);
    for (let py = y0; py <= y1; py++) {
      const yc = py + 0.5, xs = [];
      for (let i = 0, n = pts.length; i < n; i++) {
        const a1 = pts[i], a2 = pts[(i + 1) % n];
        const y1p = a1[1], y2p = a2[1];
        if ((y1p <= yc && y2p > yc) || (y2p <= yc && y1p > yc)) {
          const t = (yc - y1p) / (y2p - y1p);
          xs.push(a1[0] + t * (a2[0] - a1[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]);
        for (let px = xa; px < xb; px++) this._blend(px, py, r, g, b, a);
      }
    }
  }

  fillTriangle(ax, ay, bx, by, cx, cy, col, a = 1) { this.fillPoly([[ax, ay], [bx, by], [cx, cy]], col, a); }

  // Gradiente radiale a due fermate (interpola colore E alpha). r0..r1, fuori da r1 = trasparente.
  radial(cx, cy, r0, r1, colIn, aIn, colOut, aOut) {
    const [ir, ig, ib] = rgb(colIn), [or_, og, ob] = rgb(colOut);
    const x0 = Math.floor(cx - r1), x1 = Math.ceil(cx + r1);
    const y0 = Math.floor(cy - r1), y1 = Math.ceil(cy + r1);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - cx, dy = py + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r1) continue;
      const t = r1 === r0 ? 1 : Math.min(1, Math.max(0, (d - r0) / (r1 - r0)));
      this._blend(px, py, ir + (or_ - ir) * t, ig + (og - ig) * t, ib + (ob - ib) * t, aIn + (aOut - aIn) * t);
    }
  }

  // Gradiente verticale dentro un rettangolo.
  linearV(x, y, w, h, colTop, colBot, a = 1) {
    const [tr, tg, tb] = rgb(colTop), [br, bg, bb] = rgb(colBot);
    const x0 = Math.round(x), x1 = Math.round(x + w), y0 = Math.round(y), y1 = Math.round(y + h);
    for (let py = y0; py < y1; py++) {
      const t = (py - y0) / Math.max(1, y1 - y0 - 1);
      const r = tr + (br - tr) * t, g = tg + (bg - tg) * t, b = tb + (bb - tb) * t;
      for (let px = x0; px < x1; px++) this._blend(px, py, r, g, b, a);
    }
  }

  // Distanza con segno da un rettangolo arrotondato (centro-based). <=0 = dentro.
  static rrDist(px, py, x, y, w, h, rad) {
    const cx = x + w / 2, cy = y + h / 2;
    const qx = Math.abs(px - cx) - (w / 2 - rad);
    const qy = Math.abs(py - cy) - (h / 2 - rad);
    const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
    return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - rad;
  }

  fillRoundedRect(x, y, w, h, rad, col, a = 1) {
    const [r, g, b] = rgb(col);
    const x0 = Math.floor(x), x1 = Math.ceil(x + w), y0 = Math.floor(y), y1 = Math.ceil(y + h);
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++)
      if (Canvas.rrDist(px + 0.5, py + 0.5, x, y, w, h, rad) <= 0) this._blend(px, py, r, g, b, a);
  }

  // Contorno di un rettangolo arrotondato (banda centrata sul profilo). `quad`: opzionale predicato
  // (px,py)->bool per limitare a un quadrante (es. specular alto-sinistra).
  strokeRoundedRect(x, y, w, h, rad, width, col, a = 1, quad = null) {
    const [r, g, b] = rgb(col);
    const x0 = Math.floor(x - width), x1 = Math.ceil(x + w + width);
    const y0 = Math.floor(y - width), y1 = Math.ceil(y + h + width);
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      if (Math.abs(Canvas.rrDist(px + 0.5, py + 0.5, x, y, w, h, rad)) <= width / 2)
        if (!quad || quad(px + 0.5, py + 0.5)) this._blend(px, py, r, g, b, a);
    }
  }

  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      this._blend(dx + x, dy + y, src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3] / 255);
    }
  }
}

function rgb(col) { return [(col >> 16) & 0xff, (col >> 8) & 0xff, col & 0xff]; }
function hex(s) { return typeof s === 'number' ? s : parseInt(s.replace('#', ''), 16); }

// Poligono a stella (per il muzzle-flash). spikes punte; rOut/rIn raggi esterno/interno.
function star(cx, cy, rOut, rIn, spikes, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? rIn : rOut, a = rot + i * Math.PI / spikes;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Contorno di un poligono chiuso (un quad per lato) — usato per il bordo di stacco del veicolo.
function strokePoly(cv, pts, width, col, a = 1) {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * width / 2, ny = dx / len * width / 2;
    cv.fillPoly([[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]], col, a);
  }
}

// Riduzione AREA-WEIGHTED (box filter a copertura frazionaria), alpha-weighted (niente frange scure).
function downscaleArea(src, dw, dh) {
  const out = new Canvas(dw, dh);
  const sw = src.w, sh = src.h, sx = sw / dw, sy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const fy0 = y * sy, fy1 = fy0 + sy, iy0 = Math.floor(fy0), iy1 = Math.ceil(fy1);
    for (let x = 0; x < dw; x++) {
      const fx0 = x * sx, fx1 = fx0 + sx, ix0 = Math.floor(fx0), ix1 = Math.ceil(fx1);
      let aR = 0, aG = 0, aB = 0, aA = 0, area = 0;
      for (let yy = iy0; yy < iy1; yy++) {
        const wy = Math.min(fy1, yy + 1) - Math.max(fy0, yy); if (wy <= 0) continue;
        for (let xx = ix0; xx < ix1; xx++) {
          const wx = Math.min(fx1, xx + 1) - Math.max(fx0, xx); if (wx <= 0) continue;
          const w = wx * wy, i = (yy * sw + xx) * 4, a = src.d[i + 3] / 255;
          aR += src.d[i] * a * w; aG += src.d[i + 1] * a * w; aB += src.d[i + 2] * a * w; aA += a * w; area += w;
        }
      }
      const oi = (y * dw + x) * 4;
      if (aA > 0) { out.d[oi] = aR / aA; out.d[oi + 1] = aG / aA; out.d[oi + 2] = aB / aA; }
      out.d[oi + 3] = (area > 0 ? aA / area : 0) * 255;
    }
  }
  return out;
}

// ───────────────────────────── Encoder PNG (RGBA, 8-bit) ─────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(cv) {
  const { w, h, d } = cv;
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filtro None
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4, di = y * (1 + w * 4) + 1 + x * 4;
      raw[di]     = Math.max(0, Math.min(255, Math.round(d[si])));
      raw[di + 1] = Math.max(0, Math.min(255, Math.round(d[si + 1])));
      raw[di + 2] = Math.max(0, Math.min(255, Math.round(d[si + 2])));
      raw[di + 3] = Math.max(0, Math.min(255, Math.round(d[si + 3])));
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit, RGBA
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ───────────────────────────── Packer .ico (entry PNG, Win Vista+) ─────────────────────────────
function encodeICO(entries) {
  const count = entries.length;
  const dir = Buffer.alloc(6 + count * 16);
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(count, 4); // reserved, type=icon, count
  let offset = 6 + count * 16;
  const payloads = [];
  entries.forEach((e, idx) => {
    const o = 6 + idx * 16;
    dir[o] = e.size >= 256 ? 0 : e.size;       // width  (0 = 256)
    dir[o + 1] = e.size >= 256 ? 0 : e.size;   // height (0 = 256)
    dir[o + 2] = 0; dir[o + 3] = 0;            // colorCount, reserved
    dir.writeUInt16LE(1, o + 4);               // planes
    dir.writeUInt16LE(32, o + 6);              // bitCount
    dir.writeUInt32LE(e.png.length, o + 8);    // bytesInRes
    dir.writeUInt32LE(offset, o + 12);         // imageOffset
    offset += e.png.length;
    payloads.push(e.png);
  });
  return Buffer.concat([dir, ...payloads]);
}

// ───────────────────────────── L'ARTE: "Blood-Moon Gun-Truck" (34 step) ─────────────────────────────
// Palette firma (allineata alle art bible + verdetto del panel di design).
const P = {
  badgeBase: hex('#10101a'), skyTop: hex('#0b0b14'), skyBot: hex('#15131c'), vignette: hex('#050507'),
  moonGlow: hex('#3a1411'), moon: hex('#5e2018'), moonHi: hex('#7c2c20'), moonTerm: hex('#3a0f0b'),
  asphalt: hex('#1c1c22'), track: hex('#26262c'), contactSh: hex('#060608'),
  zombie: hex('#22242a'), zombieEye: hex('#ff2a10'),
  body: hex('#4a5230'), bodyLit: hex('#6f7a52'), bodySh: hex('#2b3018'), contour: hex('#0a0c08'),
  roofRim: hex('#97a36e'), glass: hex('#16222b'), glassRfl: hex('#34556e'),
  steel: hex('#4a4a52'), steelHi: hex('#70707a'), steelSh: hex('#26262c'),
  flash: hex('#ff6600'), flashCore: hex('#ffb347'), flashHot: hex('#fff1c0'),
  headLens: hex('#fff4bc'), headGlow: hex('#ffd9a0'),
  rim: hex('#3c3c46'), rimSpec: hex('#6c6c78'),
};

// `cv` quadrato (lato S px del master). `sz` = dimensione LOGICA bersaglio → gating fedele alla ricetta.
function drawEmblem(cv, sz) {
  const S = cv.w, u = t => t * S;
  const d64 = sz >= 64, d128 = sz >= 128; // layer ≥64 / ≥128 (sotto, non si disegnano)

  // Geometria badge + luna (per i clip).
  const bx = u(0.04), bw = u(0.92), brad = u(0.20);
  const mx = u(0.65), my = u(0.30), mr = u(0.150);
  const inBadge = (x, y) => Canvas.rrDist(x + 0.5, y + 0.5, bx, bx, bw, bw, brad) <= 0;
  const inDisc = (x, y) => { const dx = x + 0.5 - mx, dy = y + 0.5 - my; return dx * dx + dy * dy <= mr * mr; };

  cv.setClip(inBadge); // tutto resta dentro il badge → angoli arrotondati "gratis"

  // 1-2) Badge + gradiente cielo verticale.
  cv.fillRect(0, 0, S, S, P.badgeBase);
  cv.linearV(0, 0, S, S, P.skyTop, P.skyBot);

  // 3-4) Luna di sangue: alone desaturato + disco maroon spento (sotto-valore agli accenti).
  cv.radial(u(0.64), u(0.32), 0, u(0.36), P.moonGlow, 0.5, P.moonGlow, 0);
  cv.fillCircle(mx, my, mr, P.moon);
  // 5-6) Modellato luna (solo grande): highlight alto-sx + terminatore basso-dx, clippati al disco.
  if (d128) {
    cv.setClip(inDisc);
    cv.fillCircle(u(0.62), u(0.26), u(0.110), P.moonHi, 0.9);
    cv.fillEllipse(u(0.70), u(0.37), u(0.115), u(0.095), P.moonTerm, 1);
    cv.setClip(inBadge);
  }

  // 7) Banda asfalto (palco strada notturna).
  cv.fillRect(u(0.10), u(0.745), u(0.80), u(0.12), P.asphalt);
  // 8) Tracce di pneumatico coniche (solo grande).
  if (d128) {
    cv.fillPoly([[u(0.30), u(0.865)], [u(0.36), u(0.865)], [u(0.41), u(0.79)], [u(0.39), u(0.79)]], P.track);
    cv.fillPoly([[u(0.55), u(0.865)], [u(0.61), u(0.865)], [u(0.64), u(0.79)], [u(0.625), u(0.79)]], P.track);
  }
  // 9) Ombra di contatto.
  cv.fillEllipse(u(0.50), u(0.795), u(0.34), u(0.075), P.contactSh, 0.6);

  // 10-11) Zombi caduto + occhio rosso (≥64): gobba grigia + braccio proteso.
  if (d64) {
    cv.fillPoly([[u(0.29), u(0.795)], [u(0.34), u(0.755)], [u(0.40), u(0.755)], [u(0.47), u(0.79)], [u(0.505), u(0.73)], [u(0.47), u(0.78)], [u(0.47), u(0.84)], [u(0.29), u(0.84)]], P.zombie);
    cv.fillCircle(u(0.345), u(0.785), u(0.014), P.zombieEye);
  }

  // 12) Corpo veicolo — cuneo oliva 3/4 (silhouette dominante).
  const bodyPts = [[u(0.30), u(0.40)], [u(0.66), u(0.40)], [u(0.74), u(0.78)], [u(0.26), u(0.78)]];
  cv.fillPoly(bodyPts, P.body);
  // 13) Piano d'ombra basso-destra (≥64).
  if (d64) cv.fillPoly([[u(0.52), u(0.42)], [u(0.66), u(0.40)], [u(0.74), u(0.78)], [u(0.52), u(0.78)]], P.bodySh);
  // 14) Piano illuminato alto-sinistra (~48% luma → stacca dal disco a scala di grigi).
  cv.fillPoly([[u(0.30), u(0.40)], [u(0.52), u(0.42)], [u(0.50), u(0.60)], [u(0.30), u(0.57)]], P.bodyLit);
  // 15-16) Parabrezza + sheen (≥64 / ≥128).
  if (d64) cv.fillPoly([[u(0.36), u(0.43)], [u(0.60), u(0.43)], [u(0.58), u(0.55)], [u(0.38), u(0.55)]], P.glass);
  if (d128) cv.fillPoly([[u(0.37), u(0.45)], [u(0.46), u(0.45)], [u(0.44), u(0.50)], [u(0.37), u(0.49)]], P.glassRfl, 0.5);
  // 17) Contorno di stacco quasi-nero (lega la silhouette anche senza accenti).
  strokePoly(cv, bodyPts, u(0.014), P.contour);

  // 18-20) Bull-bar / griglia frontale in acciaio (≥64) + bordo luce e cucitura d'ombra (≥128).
  if (d64) cv.fillRoundedRect(u(0.31), u(0.66), u(0.38), u(0.085), u(0.02), P.steel);
  if (d128) { cv.fillRect(u(0.32), u(0.665), u(0.36), u(0.02), P.steelHi); cv.fillRect(u(0.31), u(0.73), u(0.38), u(0.015), P.steelSh); }
  // 21) Rim light caldo sul tetto (≥64).
  if (d64) cv.fillPoly([[u(0.31), u(0.395)], [u(0.55), u(0.395)], [u(0.55), u(0.41)], [u(0.31), u(0.41)]], P.roofRim, 0.85);

  // 22-23) TORRETTA sul tetto (canna corta inclinata su-dx) + ombra acciaio (≥128).
  cv.fillRect(u(0.46), u(0.36), u(0.08), u(0.04), P.steel); // mozzo
  cv.fillPoly([[u(0.52), u(0.37)], [u(0.58), u(0.37)], [u(0.66), u(0.25)], [u(0.62), u(0.24)]], P.steel); // canna
  if (d128) cv.fillPoly([[u(0.58), u(0.37)], [u(0.66), u(0.25)], [u(0.64), u(0.245)], [u(0.555), u(0.37)]], P.steelSh);

  // 24-26) MUZZLE-FLASH — accento eroe, la regione PIÙ luminosa: alone + stella + centro rovente.
  cv.radial(u(0.66), u(0.235), 0, u(0.13), P.flash, 0.85, P.flash, 0);
  cv.fillPoly(star(u(0.665), u(0.232), u(0.05), u(0.019), 8), P.flashCore);
  cv.fillCircle(u(0.665), u(0.232), u(0.022), P.flashHot);

  // 27-30) Fari bianco-caldi SECONDARI (gap ampio 0.385/0.615 → due punti risolvibili a 16px).
  const head = (cx) => {
    cv.radial(u(cx), u(0.70), 0, u(0.07), P.headGlow, 0.55, P.headGlow, 0);
    cv.fillCircle(u(cx), u(0.70), u(0.030), P.headLens);
  };
  head(0.385); head(0.615);
  // 31) Coni di luce dei fari verso il terreno (≥128, molto tenui).
  if (d128) {
    cv.fillPoly([[u(0.385), u(0.70)], [u(0.30), u(0.88)], [u(0.42), u(0.88)]], P.headGlow, 0.14);
    cv.fillPoly([[u(0.615), u(0.70)], [u(0.58), u(0.88)], [u(0.70), u(0.88)]], P.headGlow, 0.14);
  }

  // 34) Vignetta angoli (spinge il focus al centro).
  cv.radial(u(0.5), u(0.5), u(0.42), u(0.72), P.vignette, 0, P.vignette, 0.5);

  // 32-33) Cornice acciaio del badge + specular alto-sinistra (≥64 / ≥128). Dopo la vignetta, sul bordo.
  if (d64) cv.strokeRoundedRect(u(0.055), u(0.055), u(0.89), u(0.89), u(0.18), u(0.012), P.rim);
  if (d128) cv.strokeRoundedRect(u(0.055), u(0.055), u(0.89), u(0.89), u(0.18), u(0.012), P.rimSpec, 0.8,
    (x, y) => x < u(0.5) && y < u(0.5));

  cv.setClip(null);
}

// ───────────────────────────── Render & output ─────────────────────────────
function renderMaster(M, sz) { const cv = new Canvas(M, M); drawEmblem(cv, sz); return cv; }
function renderSize(sz) { return downscaleArea(renderMaster(sz * 4, sz), sz, sz); } // 4× sovracampionamento

const SIZES = [256, 128, 64, 48, 32, 16];
const rendered = SIZES.map(sz => ({ size: sz, cv: renderSize(sz) }));

mkdirSync(resolve(ROOT, 'build'), { recursive: true });

// .ico multi-size (entry PNG).
const ico = encodeICO(rendered.map(r => ({ size: r.size, png: encodePNG(r.cv) })));
writeFileSync(resolve(ROOT, 'build', 'icon.ico'), ico);

// icon.png sorgente (512, dettaglio pieno) — usata da electron-builder come riferimento e fallback Linux.
writeFileSync(resolve(ROOT, 'build', 'icon.png'), encodePNG(downscaleArea(renderMaster(1024, 512), 512, 512)));

// Foglio di anteprima (scratchpad) per ispezione visiva: 256 + piccoli su fondo scuro e chiaro.
const SCRATCH = 'C:\\Users\\manda\\AppData\\Local\\Temp\\claude\\c--Users-manda-Documents-progetto-della-domenica\\33175b92-da40-4030-8871-2f6edd2e54c1\\scratchpad';
(() => {
  const sheet = new Canvas(256 + 32 + 160, 256 + 32);
  sheet.fillRect(0, 0, sheet.w, sheet.h, 0x14161a);
  sheet.fillRect(256 + 24 + 76, 0, 84, sheet.h, 0xb7bcc3); // striscia chiara per testare i bordi
  sheet.blit(rendered.find(r => r.size === 256).cv, 16, 16);
  let yy = 16;
  for (const sz of [64, 48, 32, 16]) {
    const c = rendered.find(r => r.size === sz).cv;
    sheet.blit(c, 256 + 40, yy);        // su scuro
    sheet.blit(c, 256 + 40 + 80, yy);   // su chiaro
    yy += sz + 14;
  }
  try { mkdirSync(SCRATCH, { recursive: true }); writeFileSync(resolve(SCRATCH, 'icon-preview.png'), encodePNG(sheet)); } catch { /* anteprima opzionale */ }
})();

console.log('[icon] build/icon.ico (' + SIZES.join(',') + ') + build/icon.png (512) generati.');
