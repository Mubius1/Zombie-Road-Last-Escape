#!/usr/bin/env node
/**
 * Anti-deriva: verifica che i numeri nel CODICE coincidano con quelli scritti
 * nelle ART BIBLE.
 *
 * NEMICI (docs/ART_BIBLE_ZOMBIES.md ↔ src/scenes/GameScene.ts):
 *   - dimensioni del frame  (AF('zombie_<t>', fw, fh, 3)  ↔  "FW×FH" nella scheda §6)
 *   - scala                 (ZOMBIE_STATS[t].scale        ↔  "scale S" nella scheda §6)
 *   - parametri di movimento(ZOMBIE_MOTION[t]              ↔  riga della tabella §5)
 *
 * OGGETTI (docs/ART_BIBLE_OGGETTI.md ↔ src/GameData.ts + src/scenes/GameScene.ts):
 *   - veicoli  (VEHICLES   ↔  tabella §4.1)  → nome · prezzo · colore
 *   - armi     (WEAPONS    ↔  tabella §4.3)  → nome · prezzo · cooldown · danno · velocità · colore · range
 *   - texture  (generateTexture(...) ↔ "NN×NN" nelle schede §4.1 / §4.4–§4.8)
 *
 * INTERFACCE (docs/ART_BIBLE_INTERFACCE.md ↔ src/Ui.ts):
 *   - token UI (oggetto `UI`  ↔  tabella §3.6)  → nome → colore (bidirezionale: valore + presenza)
 *
 * Esce con codice 1 (build fallita) se trova anche un solo disallineamento.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root     = join(dirname(fileURLToPath(import.meta.url)), '..');
const code     = readFileSync(join(root, 'src/scenes/GameScene.ts'), 'utf8');
const gameData = readFileSync(join(root, 'src/GameData.ts'), 'utf8');
const uiSrc    = readFileSync(join(root, 'src/Ui.ts'), 'utf8');
// Authoring texture estratto da GameScene (decomposizione): le dimensioni-firma di nemici/boss/
// oggetti (AF/generateTexture) vivono qui; quelle del veicolo in VehicleTextures.ts. I DATI
// (ZOMBIE_STATS/ZOMBIE_MOTION/BOSS_CONFIG) restano in GameScene.ts → continuano a leggersi da `code`.
const entityTex  = readFileSync(join(root, 'src/EntityTextures.ts'), 'utf8');
const vehicleTex = readFileSync(join(root, 'src/VehicleTextures.ts'), 'utf8');
const bibleZ   = readFileSync(join(root, 'docs/ART_BIBLE_ZOMBIES.md'), 'utf8');
const bibleO   = readFileSync(join(root, 'docs/ART_BIBLE_OGGETTI.md'), 'utf8');
const bibleI   = readFileSync(join(root, 'docs/ART_BIBLE_INTERFACCE.md'), 'utf8');

const errors = [];
const EPS = 1e-6;
const near = (a, b) => Math.abs(a - b) < EPS;

// ─── Helper condivisi ──────────────────────────────────────────────────────
// Estrae il blocco `{ ... }` bilanciato che segue l'header indicato.
function sliceObject(src, header) {
  const start = src.indexOf(header);
  if (start === -1) throw new Error(`Blocco non trovato nel codice: ${header}`);
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(open, i + 1);
}

// Riga "key: { ... }" dentro un blocco oggetto.
function entryBody(block, key) {
  const m = new RegExp(`\\b${key}\\s*:\\s*\\{([^}]*)\\}`).exec(block);
  if (!m) throw new Error(`Riga "${key}" non trovata nel blocco codice`);
  return m[1];
}
const strField = (body, key, field) => {
  const m = new RegExp(`\\b${field}\\s*:\\s*'([^']*)'`).exec(body);
  if (!m) throw new Error(`Campo stringa "${field}" non trovato per "${key}"`);
  return m[1];
};
const intField = (body, key, field) => {
  const m = new RegExp(`\\b${field}\\s*:\\s*(-?\\d+)`).exec(body);
  if (!m) throw new Error(`Campo numerico "${field}" non trovato per "${key}"`);
  return parseInt(m[1], 10);
};
const hexField = (body, key, field) => {
  const m = new RegExp(`\\b${field}\\s*:\\s*0x([0-9a-fA-F]+)`).exec(body);
  if (!m) throw new Error(`Campo colore "${field}" non trovato per "${key}"`);
  return parseInt(m[1], 16);
};

// Cella → numero per le tabelle markdown (gestisce "—", vuoto, asterischi).
const cellNum = s => (s === '—' || s === '' ? 0 : parseFloat(s.replace(/\*/g, '')));
// Estrae l'esadecimale da una cella tipo "`#4a6fa5` (blu)".
const cellHex = s => {
  const m = /#([0-9a-fA-F]{6})/.exec(s);
  return m ? parseInt(m[1], 16) : NaN;
};
// Righe di una tabella markdown la cui PRIMA cella è `key` (in backtick).
function bibleRow(bible, key) {
  const m = new RegExp(`\\|\\s*\`${key}\`\\s*\\|([^\\n]*)`).exec(bible);
  if (!m) return null;
  return m[1].split('|').map(c => c.trim());
}

// ════════════════════════════════════════════════════════════════════════════
// 1. NEMICI (ART_BIBLE_ZOMBIES.md)
// ════════════════════════════════════════════════════════════════════════════
const TYPES = ['common', 'runner', 'armored', 'jumper', 'toxic', 'giant'];
// Nome italiano (MAIUSCOLO) usato nei titoli §6  →  chiave inglese.
const IT2KEY = {
  COMUNE: 'common', CORRIDORE: 'runner', CORAZZATO: 'armored',
  SALTATORE: 'jumper', TOSSICO: 'toxic', GIGANTE: 'giant',
};
const MOTION_FIELDS = ['amp', 'spd', 'lean', 'pow', 'stomp', 'wob', 'home', 'turn', 'fxEvery'];

function motionField(block, type, field) {
  const row = new RegExp(`\\b${type}\\s*:\\s*\\{([^}]*)\\}`).exec(block);
  if (!row) throw new Error(`Riga "${type}" non trovata nel blocco codice`);
  const m = new RegExp(`\\b${field}\\s*:\\s*(-?[\\d.]+)`).exec(row[1]);
  if (m) return parseFloat(m[1]);
  const b = new RegExp(`\\b${field}\\s*:\\s*(true|false)`).exec(row[1]);
  if (b) return b[1] === 'true' ? 1 : 0;
  throw new Error(`Campo "${field}" non trovato per "${type}" nel codice`);
}

const motionSrc = sliceObject(code, 'const ZOMBIE_MOTION');
const statsSrc  = sliceObject(code, 'const ZOMBIE_STATS');

const codeMotion = {}, codeStats = {}, codeDims = {};
for (const t of TYPES) {
  codeMotion[t] = Object.fromEntries(MOTION_FIELDS.map(f => [f, motionField(motionSrc, t, f)]));
  codeStats[t]  = { scale: motionField(statsSrc, t, 'scale') };
  const af = new RegExp(`AF\\('zombie_${t}',\\s*(\\d+),\\s*(\\d+),\\s*3\\)`).exec(entityTex);
  if (!af) throw new Error(`AF('zombie_${t}', ...) non trovato in EntityTextures.ts`);
  codeDims[t] = { fw: +af[1], fh: +af[2] };
}

// §5 — tabella movimento. Riga: | common | 0.09 | 4.0 | ... | turn | fx | ogni |
const bibleMotion = {};
for (const t of TYPES) {
  const line = new RegExp(`\\|\\s*${t}\\s*\\|([^\\n]*)\\|`).exec(bibleZ);
  if (!line) { errors.push(`Art Bible §5: riga "${t}" non trovata.`); continue; }
  const cells = line[1].split('|').map(c => c.replace(/\*/g, '').trim());
  // cells: [amp, spd, lean, pow, stomp, wob, home, turn, fx-desc, ogni]
  bibleMotion[t] = {
    amp: cellNum(cells[0]), spd: cellNum(cells[1]), lean: cellNum(cells[2]), pow: cellNum(cells[3]),
    stomp: cellNum(cells[4]), wob: cellNum(cells[5]), home: cellNum(cells[6]), turn: cellNum(cells[7]),
    fxEvery: cellNum(cells[9]),
  };
}

// §6 — titoli schede: ### 6.N COMUNE — *"..."* · 30×44 · `scale 1.0`
const bibleDims = {}, bibleStats = {};
for (const [it, key] of Object.entries(IT2KEY)) {
  const m = new RegExp(`###[^\\n]*\\b${it}\\b[^\\n]*?(\\d+)×(\\d+)[^\\n]*?scale\\s+([\\d.]+)`).exec(bibleZ);
  if (!m) { errors.push(`Art Bible §6: scheda "${it}" (${key}) non trovata o malformata.`); continue; }
  bibleDims[key]  = { fw: +m[1], fh: +m[2] };
  bibleStats[key] = { scale: parseFloat(m[3]) };
}

for (const t of TYPES) {
  if (bibleDims[t] && (codeDims[t].fw !== bibleDims[t].fw || codeDims[t].fh !== bibleDims[t].fh))
    errors.push(`[zombie:${t}] frame: codice ${codeDims[t].fw}×${codeDims[t].fh} ≠ bible ${bibleDims[t].fw}×${bibleDims[t].fh}`);
  if (bibleStats[t] && !near(codeStats[t].scale, bibleStats[t].scale))
    errors.push(`[zombie:${t}] scale: codice ${codeStats[t].scale} ≠ bible ${bibleStats[t].scale}`);
  if (bibleMotion[t]) for (const f of MOTION_FIELDS) {
    if (!near(codeMotion[t][f], bibleMotion[t][f]))
      errors.push(`[zombie:${t}] motion.${f}: codice ${codeMotion[t][f]} ≠ bible ${bibleMotion[t][f]}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 1b. BOSS (ART_BIBLE_ZOMBIES.md §6.7.5 ↔ BOSS_CONFIG + generateTexture/AF)
//   - dimensioni frame   (AF('boss_<t>', fw, fh, 3) ↔ "FW×FH" in tabella §6.7.5)
//   - scaleX / scaleY    (BOSS_CONFIG[t]            ↔ colonne scaleX/scaleY)
//   - bodyW / bodyH      (BOSS_CONFIG[t]            ↔ colonne bodyW/bodyH → hitbox)
// ════════════════════════════════════════════════════════════════════════════
const BOSS_TYPES = ['mega_mutant', 'giant_worm', 'armored_colossus', 'radioactive_beast'];
const floatField = (body, key, field) => {
  const m = new RegExp(`\\b${field}\\s*:\\s*(-?[\\d.]+)`).exec(body);
  if (!m) throw new Error(`Campo numerico "${field}" non trovato per "${key}"`);
  return parseFloat(m[1]);
};
const bossSrc = sliceObject(code, 'const BOSS_CONFIG');

for (const t of BOSS_TYPES) {
  const key = `boss_${t}`;

  // Codice: BOSS_CONFIG[t] → scaleX/scaleY/bodyW/bodyH
  let c;
  try {
    const body = entryBody(bossSrc, t);
    c = {
      scaleX: floatField(body, t, 'scaleX'), scaleY: floatField(body, t, 'scaleY'),
      bodyW:  floatField(body, t, 'bodyW'),  bodyH:  floatField(body, t, 'bodyH'),
    };
  } catch (e) { errors.push(`[boss:${t}] BOSS_CONFIG: ${e.message}`); continue; }

  // Codice: AF('boss_t', fw, fh, 3) + generateTexture('boss_t', W, H)
  const af = new RegExp(`AF\\('${key}',\\s*(\\d+),\\s*(\\d+),\\s*3\\)`).exec(entityTex);
  const gt = new RegExp(`generateTexture\\('${key}',\\s*(\\d+),\\s*(\\d+)\\)`).exec(entityTex);
  if (!af) { errors.push(`[boss:${t}] AF('${key}', ...) non trovato in EntityTextures.ts`); continue; }
  if (!gt) { errors.push(`[boss:${t}] generateTexture('${key}', ...) non trovato in EntityTextures.ts`); continue; }
  const codeFw = +af[1], codeFh = +af[2], codeW = +gt[1], codeH = +gt[2];

  // Coerenza interna al codice: lo spritesheet è fw*3 × fh
  if (codeW !== codeFw * 3 || codeH !== codeFh)
    errors.push(`[boss:${t}] codice incoerente: generateTexture ${codeW}×${codeH} ≠ ${codeFw * 3}×${codeFh} (fw*3 × fh da AF)`);

  // Bible §6.7.5: riga "| `boss_t` | FW×FH | sX | sY | bW | bH |"
  const cells = bibleRow(bibleZ, key);
  if (!cells || cells.length < 5) { errors.push(`Art Bible §6.7.5: riga boss "${key}" non trovata o malformata.`); continue; }
  const fm = /(\d+)×(\d+)/.exec(cells[0]);
  if (!fm) { errors.push(`Art Bible §6.7.5: dimensione frame "NN×NN" mancante per "${key}".`); continue; }
  const b = { fw: +fm[1], fh: +fm[2], scaleX: parseFloat(cells[1]), scaleY: parseFloat(cells[2]), bodyW: parseFloat(cells[3]), bodyH: parseFloat(cells[4]) };

  if (codeFw !== b.fw || codeFh !== b.fh) errors.push(`[boss:${t}] frame: codice ${codeFw}×${codeFh} ≠ bible ${b.fw}×${b.fh}`);
  if (!near(c.scaleX, b.scaleX)) errors.push(`[boss:${t}] scaleX: codice ${c.scaleX} ≠ bible ${b.scaleX}`);
  if (!near(c.scaleY, b.scaleY)) errors.push(`[boss:${t}] scaleY: codice ${c.scaleY} ≠ bible ${b.scaleY}`);
  if (!near(c.bodyW, b.bodyW))   errors.push(`[boss:${t}] bodyW: codice ${c.bodyW} ≠ bible ${b.bodyW}`);
  if (!near(c.bodyH, b.bodyH))   errors.push(`[boss:${t}] bodyH: codice ${c.bodyH} ≠ bible ${b.bodyH}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 2. VEICOLI (ART_BIBLE_OGGETTI.md §4.1 ↔ GameData.ts VEHICLES)
// ════════════════════════════════════════════════════════════════════════════
const VEHICLE_KEYS = [
  'civilian_car', 'pickup', 'armored_van', 'military_suv',
  'armored_truck', 'heavy_military', 'experimental',
];
const vehSrc = sliceObject(gameData, 'export const VEHICLES');

for (const key of VEHICLE_KEYS) {
  let codeName, codePrice, codeColor;
  try {
    const body = entryBody(vehSrc, key);
    codeName  = strField(body, key, 'name');
    codePrice = intField(body, key, 'price');
    codeColor = hexField(body, key, 'color');
  } catch (e) { errors.push(`[veicolo:${key}] codice: ${e.message}`); continue; }

  // bible §4.1: | `key` | Nome | Prezzo | `#hex` (desc) | gancio |
  const cells = bibleRow(bibleO, key);
  if (!cells || cells.length < 4) { errors.push(`Art Bible §4.1: riga veicolo "${key}" non trovata o malformata.`); continue; }
  const [bName, bPrice, bColorCell] = cells;
  const bColor = cellHex(bColorCell);

  if (bName !== codeName)            errors.push(`[veicolo:${key}] nome: codice "${codeName}" ≠ bible "${bName}"`);
  if (cellNum(bPrice) !== codePrice) errors.push(`[veicolo:${key}] prezzo: codice ${codePrice} ≠ bible ${bPrice}`);
  if (bColor !== codeColor)          errors.push(`[veicolo:${key}] colore: codice #${codeColor.toString(16).padStart(6,'0')} ≠ bible ${bColorCell}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 3. ARMI (ART_BIBLE_OGGETTI.md §4.3 ↔ GameData.ts WEAPONS)
// ════════════════════════════════════════════════════════════════════════════
const WEAPON_KEYS = ['mg', 'double_mg', 'rifle', 'rockets', 'flamethrower'];
const wpnSrc = sliceObject(gameData, 'export const WEAPONS');

for (const key of WEAPON_KEYS) {
  let c;
  try {
    const body = entryBody(wpnSrc, key);
    c = {
      name:     strField(body, key, 'name'),
      price:    intField(body, key, 'price'),
      cooldown: intField(body, key, 'cooldown'),
      damage:   intField(body, key, 'damage'),
      speed:    intField(body, key, 'speed'),
      color:    hexField(body, key, 'color'),
      range:    intField(body, key, 'range'),
    };
  } catch (e) { errors.push(`[arma:${key}] codice: ${e.message}`); continue; }

  // bible §4.3: | `key` | Nome | Prezzo | Cooldown | Danno | Velocità | `#hex` | Range |
  const cells = bibleRow(bibleO, key);
  if (!cells || cells.length < 7) { errors.push(`Art Bible §4.3: riga arma "${key}" non trovata o malformata.`); continue; }
  const [bName, bPrice, bCd, bDmg, bSpd, bColorCell, bRange] = cells;

  if (bName !== c.name)                errors.push(`[arma:${key}] nome: codice "${c.name}" ≠ bible "${bName}"`);
  if (cellNum(bPrice) !== c.price)     errors.push(`[arma:${key}] prezzo: codice ${c.price} ≠ bible ${bPrice}`);
  if (cellNum(bCd) !== c.cooldown)     errors.push(`[arma:${key}] cooldown: codice ${c.cooldown} ≠ bible ${bCd}`);
  if (cellNum(bDmg) !== c.damage)      errors.push(`[arma:${key}] danno: codice ${c.damage} ≠ bible ${bDmg}`);
  if (cellNum(bSpd) !== c.speed)       errors.push(`[arma:${key}] velocità: codice ${c.speed} ≠ bible ${bSpd}`);
  if (cellHex(bColorCell) !== c.color) errors.push(`[arma:${key}] colore: codice #${c.color.toString(16).padStart(6,'0')} ≠ bible ${bColorCell}`);
  if (cellNum(bRange) !== c.range)     errors.push(`[arma:${key}] range: codice ${c.range} ≠ bible ${bRange}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 4. DIMENSIONI TEXTURE OGGETTI (GameScene.ts generateTexture ↔ schede §4)
// ════════════════════════════════════════════════════════════════════════════
// Header scheda: cerca la riga "###" che contiene `<token>` e un "NN×NN".
function bibleHeaderDim(bible, token) {
  const m = new RegExp(`###[^\\n]*${token}[^\\n]*?(\\d+)×(\\d+)`).exec(bible);
  return m ? { w: +m[1], h: +m[2] } : null;
}
// Dimensioni nel codice: generateTexture(<call>, W, H) nel sorgente `src` indicato.
function codeTexDim(call, src) {
  const m = new RegExp(`generateTexture\\(${call},\\s*(\\d+),\\s*(\\d+)\\)`).exec(src);
  return m ? { w: +m[1], h: +m[2] } : null;
}

// { call: argomento di generateTexture · src: file in cui cercarlo · token: header bible }
const OBJECT_TEX = [
  { label: 'veicolo',     call: 'key',            token: 'IL VEICOLO',    src: vehicleTex },
  { label: 'bullet',      call: "'bullet'",       token: '`bullet`',      src: entityTex },
  { label: 'rocket',      call: "'rocket'",       token: '`rocket`',      src: entityTex },
  { label: 'particle',    call: "'particle'",     token: '`particle`',    src: entityTex },
  { label: 'toxic_cloud', call: "'toxic_cloud'",  token: '`toxic_cloud`', src: entityTex },
  { label: 'fuel_can',    call: "'fuel_can'",     token: '`fuel_can`',    src: entityTex },
];

for (const { label, call, token, src } of OBJECT_TEX) {
  const cd = codeTexDim(call, src);
  if (!cd) { errors.push(`[texture:${label}] generateTexture(${call}, ...) non trovato nel codice`); continue; }
  const bd = bibleHeaderDim(bibleO, token);
  if (!bd) { errors.push(`Art Bible §4: dimensione "NN×NN" per "${label}" (header ${token}) non trovata.`); continue; }
  if (cd.w !== bd.w || cd.h !== bd.h)
    errors.push(`[texture:${label}] dimensione: codice ${cd.w}×${cd.h} ≠ bible ${bd.w}×${bd.h}`);
}

// ════════════════════════════════════════════════════════════════════════════
// 5. INTERFACCE — token UI (ART_BIBLE_INTERFACCE.md §3.6 ↔ src/Ui.ts `UI`)
// ════════════════════════════════════════════════════════════════════════════
// Porzione di markdown da un header (`### …`) fino al successivo header.
function sliceSection(md, header) {
  const start = md.indexOf(header);
  if (start === -1) return '';
  const rest = md.slice(start + header.length);
  const next = rest.search(/\n#{1,4}\s/);
  return next === -1 ? rest : rest.slice(0, next);
}
// Normalizza un colore (`#rrggbb` o `0xrrggbb`) in intero.
const toInt = h => parseInt(h, 16);

// Token nel codice: name → intero, dal blocco `export const UI = { … }`.
// (Salta `font: FONT` e i commenti: matcha solo `name: '#hex'` o `name: 0xhex`.)
const uiBlock = sliceObject(uiSrc, 'export const UI');
const codeTokens = {};
{
  const re = /(\w+)\s*:\s*(?:'#([0-9a-fA-F]{6})'|0x([0-9a-fA-F]{6})(?![0-9a-fA-F]))/g;
  let m;
  while ((m = re.exec(uiBlock))) codeTokens[m[1]] = toInt(m[2] ?? m[3]);
}

// Token nella bible: righe `| `name` | `#hex`/`0xhex` | … |` nella sezione §3.6.
const bibleTokens = {};
{
  const sec = sliceSection(bibleI, '### 3.6');
  if (!sec) errors.push('Art Bible Interfacce §3.6: tabella dei token non trovata.');
  const re = /\|\s*`(\w+)`\s*\|\s*`?(?:#|0x)([0-9a-fA-F]{6})`?\s*\|/g;
  let m;
  while ((m = re.exec(sec))) bibleTokens[m[1]] = toInt(m[2]);
}

const hx = n => '#' + n.toString(16).padStart(6, '0');
for (const [name, val] of Object.entries(codeTokens)) {
  if (!(name in bibleTokens)) {
    errors.push(`[ui:${name}] token nel codice (src/Ui.ts) ma assente dalla tabella §3.6`);
  } else if (bibleTokens[name] !== val) {
    errors.push(`[ui:${name}] colore: codice ${hx(val)} ≠ bible ${hx(bibleTokens[name])}`);
  }
}
for (const name of Object.keys(bibleTokens)) {
  if (!(name in codeTokens))
    errors.push(`[ui:${name}] token nella tabella §3.6 ma assente dal codice (src/Ui.ts)`);
}
const uiCount = Object.keys(codeTokens).length;

// ════════════════════════════════════════════════════════════════════════════
// 6. Esito
// ════════════════════════════════════════════════════════════════════════════
if (errors.length) {
  console.error('\n❌ ART BIBLE DISALLINEATA dal codice:\n');
  for (const e of errors) console.error('   • ' + e);
  console.error(`\n${errors.length} disallineamento/i. Aggiorna le ART BIBLE o il codice.\n`);
  process.exit(1);
}
console.log(
  `✅ Art Bible allineata: ${TYPES.length} nemici · ${BOSS_TYPES.length} boss · ${VEHICLE_KEYS.length} veicoli · ` +
  `${WEAPON_KEYS.length} armi · ${OBJECT_TEX.length} texture (dimensioni) · ${uiCount} token UI verificati.`
);
