#!/usr/bin/env node
/**
 * Anti-deriva: verifica che i numeri nel CODICE coincidano con quelli scritti
 * nella ART BIBLE (docs/ART_BIBLE_ZOMBIES.md).
 *
 * Confronta, per ogni nemico:
 *   - dimensioni del frame  (AF('zombie_<t>', fw, fh, 3)  ↔  "FW×FH" nella scheda §6)
 *   - scala                 (ZOMBIE_STATS[t].scale        ↔  "scale S" nella scheda §6)
 *   - parametri di movimento(ZOMBIE_MOTION[t]              ↔  riga della tabella §5)
 *
 * Esce con codice 1 (build fallita) se trova anche un solo disallineamento.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root  = join(dirname(fileURLToPath(import.meta.url)), '..');
const code  = readFileSync(join(root, 'src/scenes/GameScene.ts'), 'utf8');
const bible = readFileSync(join(root, 'docs/ART_BIBLE_ZOMBIES.md'), 'utf8');

const TYPES = ['common', 'runner', 'armored', 'jumper', 'toxic', 'giant'];
// Nome italiano (MAIUSCOLO) usato nei titoli §6  →  chiave inglese.
// Aggiungi qui le coppie quando introduci un nuovo nemico.
const IT2KEY = {
  COMUNE: 'common', CORRIDORE: 'runner', CORAZZATO: 'armored',
  SALTATORE: 'jumper', TOSSICO: 'toxic', GIGANTE: 'giant',
};
const MOTION_FIELDS = ['amp', 'spd', 'lean', 'pow', 'stomp', 'wob', 'home', 'turn', 'fxEvery'];

const errors = [];
const EPS = 1e-6;
const near = (a, b) => Math.abs(a - b) < EPS;

// ─── 1. Estrazione dal CODICE ──────────────────────────────────────────────
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

function fieldNum(block, type, field) {
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
  codeMotion[t] = Object.fromEntries(MOTION_FIELDS.map(f => [f, fieldNum(motionSrc, t, f)]));
  codeStats[t]  = { scale: fieldNum(statsSrc, t, 'scale') };
  const af = new RegExp(`AF\\('zombie_${t}',\\s*(\\d+),\\s*(\\d+),\\s*3\\)`).exec(code);
  if (!af) throw new Error(`AF('zombie_${t}', ...) non trovato nel codice`);
  codeDims[t] = { fw: +af[1], fh: +af[2] };
}

// ─── 2. Estrazione dalla ART BIBLE ─────────────────────────────────────────
// §5 — tabella movimento. Riga: | common | 0.09 | 4.0 | ... | turn | fx | ogni |
const bibleMotion = {};
for (const t of TYPES) {
  const line = new RegExp(`\\|\\s*${t}\\s*\\|([^\\n]*)\\|`).exec(bible);
  if (!line) { errors.push(`Art Bible §5: riga "${t}" non trovata.`); continue; }
  const cells = line[1].split('|').map(c => c.replace(/\*/g, '').trim());
  const val = s => (s === '—' || s === '' ? 0 : parseFloat(s));
  // cells: [amp, spd, lean, pow, stomp, wob, home, turn, fx-desc, ogni]
  bibleMotion[t] = {
    amp: val(cells[0]), spd: val(cells[1]), lean: val(cells[2]), pow: val(cells[3]),
    stomp: val(cells[4]), wob: val(cells[5]), home: val(cells[6]), turn: val(cells[7]),
    fxEvery: val(cells[9]),
  };
}

// §6 — titoli schede: ### 6.N COMUNE — *"..."* · 30×44 · `scale 1.0`
const bibleDims = {}, bibleStats = {};
for (const [it, key] of Object.entries(IT2KEY)) {
  const m = new RegExp(`###[^\\n]*\\b${it}\\b[^\\n]*?(\\d+)×(\\d+)[^\\n]*?scale\\s+([\\d.]+)`).exec(bible);
  if (!m) { errors.push(`Art Bible §6: scheda "${it}" (${key}) non trovata o malformata.`); continue; }
  bibleDims[key]  = { fw: +m[1], fh: +m[2] };
  bibleStats[key] = { scale: parseFloat(m[3]) };
}

// ─── 3. Confronto ──────────────────────────────────────────────────────────
for (const t of TYPES) {
  // dimensioni frame
  if (bibleDims[t]) {
    if (codeDims[t].fw !== bibleDims[t].fw || codeDims[t].fh !== bibleDims[t].fh)
      errors.push(`[${t}] frame: codice ${codeDims[t].fw}×${codeDims[t].fh} ≠ bible ${bibleDims[t].fw}×${bibleDims[t].fh}`);
  }
  // scala
  if (bibleStats[t] && !near(codeStats[t].scale, bibleStats[t].scale))
    errors.push(`[${t}] scale: codice ${codeStats[t].scale} ≠ bible ${bibleStats[t].scale}`);
  // movimento
  if (bibleMotion[t]) {
    for (const f of MOTION_FIELDS) {
      if (!near(codeMotion[t][f], bibleMotion[t][f]))
        errors.push(`[${t}] motion.${f}: codice ${codeMotion[t][f]} ≠ bible ${bibleMotion[t][f]}`);
    }
  }
}

// ─── 4. Esito ──────────────────────────────────────────────────────────────
if (errors.length) {
  console.error('\n❌ ART BIBLE DISALLINEATA dal codice:\n');
  for (const e of errors) console.error('   • ' + e);
  console.error(`\n${errors.length} disallineamento/i. Aggiorna docs/ART_BIBLE_ZOMBIES.md o il codice.\n`);
  process.exit(1);
}
console.log(`✅ Art Bible allineata: ${TYPES.length} nemici · dimensioni, scala e ${MOTION_FIELDS.length} parametri di movimento verificati.`);
