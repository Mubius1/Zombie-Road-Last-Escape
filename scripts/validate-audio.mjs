#!/usr/bin/env node
/**
 * Anti-deriva (audio): verifica che i NUMERI-FIRMA dell'audio nel CODICE
 * (src/SoundManager.ts) coincidano con la tabella 🔒 di docs/ART_BIBLE_AUDIO.md §4.1.
 *
 * Copre l'identità sonora portante (master · motore · frequenze-firma dei filtri),
 * cioè i valori a literal singolo e non ambiguo. Inviluppi/durate di dettaglio
 * restano descritti nelle schede §5 ma NON sono validati a numero (parsing fragile).
 *
 * Esce con codice 1 (build fallita) se trova anche un solo disallineamento.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root  = join(dirname(fileURLToPath(import.meta.url)), '..');
const audio = readFileSync(join(root, 'src/SoundManager.ts'), 'utf8');
const bible = readFileSync(join(root, 'docs/ART_BIBLE_AUDIO.md'), 'utf8');

const errors = [];
const EPS = 1e-6;
const near = (a, b) => Math.abs(a - b) < EPS;

// ─── Helper ──────────────────────────────────────────────────────────────────
// Corpo `{ … }` bilanciato del metodo il cui header contiene `sig` (es. 'playShot(').
function sliceMethod(src, sig) {
  const start = src.indexOf(sig);
  if (start === -1) throw new Error(`Metodo non trovato: ${sig}`);
  const open = src.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(open, i + 1);
}
// Primo numero catturato da `re` in `text` (gruppo 1), o eccezione.
function grab(text, re, what) {
  const m = re.exec(text);
  if (!m) throw new Error(`pattern "${what}" non trovato`);
  return parseFloat(m[1]);
}
// Cella markdown → numero (gestisce **grassetto**, backtick, "—"/vuoto → null).
function num(cell) {
  const s = String(cell).replace(/[`*]/g, '').trim();
  if (s === '' || s === '—') return null;
  const m = s.replace(/[‒–—−]/g, '-').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
// Cella (col. "Valore") della riga la cui prima cella è `key` (in backtick).
function bibleValue(key) {
  const m = new RegExp(`\\|\\s*\`${key}\`\\s*\\|([^|]*)\\|`).exec(bible);
  return m ? m[1].trim() : null;
}

// ─── Estrazione dal CODICE ───────────────────────────────────────────────────
// Slice dei metodi usati (motore + suoni a rumore con un solo filtro).
const startEngine   = () => sliceMethod(audio, 'startEngine()');
const setEngineLoad = () => sliceMethod(audio, 'setEngineLoad(');
const stopEngine    = () => sliceMethod(audio, 'stopEngine()');

// chiave doc → funzione che estrae il valore dal codice.
const CODE = {
  base_volume:        () => grab(audio, /BASE_VOLUME\s*=\s*([\d.]+)/, 'BASE_VOLUME'),
  engine_osc_hz:      () => grab(startEngine(),   /engineOsc\.frequency\.value\s*=\s*([\d.]+)/, 'engineOsc.frequency'),
  engine_lfo_hz:      () => grab(startEngine(),   /engineLfo\.frequency\.value\s*=\s*([\d.]+)/, 'engineLfo.frequency'),
  engine_lfo_gain:    () => grab(startEngine(),   /lfoGain\.gain\.value\s*=\s*([\d.]+)/, 'lfoGain.gain'),
  engine_gain:        () => grab(startEngine(),   /engineGain\.gain\.value\s*=\s*([\d.]+)/, 'engineGain.gain'),
  engine_load_base:   () => grab(setEngineLoad(), /=\s*([\d.]+)\s*\+\s*factor\s*\*\s*[\d.]+/, 'load base'),
  engine_load_span:   () => grab(setEngineLoad(), /=\s*[\d.]+\s*\+\s*factor\s*\*\s*([\d.]+)/, 'load span'),
  engine_fade_s:      () => grab(stopEngine(),    /setTargetAtTime\(\s*0\.001\s*,[^,]*,\s*([\d.]+)\s*\)/, 'engine fade'),
  shot_filter_hz:     () => grab(sliceMethod(audio, 'playShot('),         /frequency\.value\s*=\s*([\d.]+)/, 'shot filter'),
  impact_filter_hz:   () => grab(sliceMethod(audio, 'playImpact()'),      /frequency\.value\s*=\s*([\d.]+)/, 'impact filter'),
  explosion_filter_hz:() => grab(sliceMethod(audio, 'playExplosion()'),   /frequency\.value\s*=\s*([\d.]+)/, 'explosion filter'),
  explosion_peak:     () => grab(sliceMethod(audio, 'playExplosion()'),   /gain\.setValueAtTime\(\s*([\d.]+)/, 'explosion peak'),
  toxic_filter_hz:    () => grab(sliceMethod(audio, 'playToxicSizzle()'), /frequency\.value\s*=\s*([\d.]+)/, 'toxic filter'),
};

// ─── Confronto codice ↔ bible ────────────────────────────────────────────────
for (const [key, extract] of Object.entries(CODE)) {
  let codeVal;
  try { codeVal = extract(); }
  catch (e) { errors.push(`[audio:${key}] codice: ${e.message}`); continue; }

  const cell = bibleValue(key);
  if (cell === null) { errors.push(`ART_BIBLE_AUDIO §4.1: riga \`${key}\` non trovata.`); continue; }
  const b = num(cell);
  if (b === null) { errors.push(`[audio:${key}] cella bible non numerica ("${cell}")`); continue; }
  if (!near(codeVal, b)) errors.push(`[audio:${key}] codice ${codeVal} ≠ bible ${b}`);
}

// Copertura: ogni riga 🔒 in §4.1 deve avere una chiave nota (no righe orfane nel doc).
const docKeys = [...bible.matchAll(/\|\s*`([a-z_]+)`\s*\|\s*[\d.]/g)].map(m => m[1]);
for (const k of new Set(docKeys)) {
  if (!(k in CODE)) errors.push(`[audio:${k}] riga 🔒 nel doc ma chiave sconosciuta al validatore — allinea §4.1 e validate-audio.mjs`);
}

// ─── Esito ───────────────────────────────────────────────────────────────────
const summary = `✅ Audio allineato: ${Object.keys(CODE).length} valori-firma verificati (master · motore · filtri).`;
export { errors, summary };

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (errors.length) {
    console.error('\n❌ ART_BIBLE_AUDIO.md DISALLINEATA dal codice:\n');
    for (const e of errors) console.error('   • ' + e);
    console.error(`\n${errors.length} disallineamento/i. Aggiorna docs/ART_BIBLE_AUDIO.md §4.1 (🔒) o il codice.\n`);
    process.exit(1);
  }
  console.log(summary);
}
