#!/usr/bin/env node
/**
 * Anti-deriva (i18n): verifica che i dizionari di lingua in src/locales/ siano COMPLETI e COERENTI
 * rispetto alla locale canonica it.ts. Senza questo controllo, una chiave non tradotta scivolava via
 * silenziosamente (t() fa fallback su italiano → l'utente vede testo misto senza che nessuno se ne accorga).
 *
 * Controlla, per ogni lingua ≠ it:
 *   · chiavi MANCANTI (presenti in it.ts ma non nella lingua) → resterebbero in italiano;
 *   · chiavi IN PIÙ (presenti nella lingua ma non in it.ts) → chiave morta / refuso;
 *   · SEGNAPOSTO incoerenti ({nome}): l'insieme dei placeholder di un valore deve combaciare con it
 *     (un {n} perso = interpolazione rotta, un {x} di troppo = testo letterale "{x}" a schermo);
 * e, per ogni file, chiavi DUPLICATE (la seconda vince in silenzio).
 *
 * Esce con codice 1 (build fallita) se trova anche un solo disallineamento.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root       = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(root, 'src/locales');
const CANONICAL  = 'it';

const errors = [];

// Riga "  'chiave': 'valore'," — chiave SEMPRE tra apici singoli; valore tra ' o " (gli apostrofi
// italiani impongono il doppio apice in alcune voci). Cattura: 1=chiave, 2=apice, 3=valore.
const ROW = /^\s*'([^']+)'\s*:\s*(['"])((?:\\.|(?!\2).)*)\2\s*,?\s*$/gm;
const PLACEHOLDER = /\{(\w+)\}/g;

/** Estrae { chiave → valore } da un file locale, registrando i duplicati come errori. */
function parseLocale(lang, src) {
  const map = new Map();
  for (const m of src.matchAll(ROW)) {
    const [, key, , value] = m;
    if (map.has(key)) errors.push(`[i18n:${lang}] chiave duplicata: "${key}" (la seconda definizione vince in silenzio)`);
    map.set(key, value);
  }
  return map;
}

/** Insieme ordinato dei segnaposto {nome} in un valore. */
function placeholders(value) {
  return [...value.matchAll(PLACEHOLDER)].map(m => m[1]).sort();
}

// ─── Caricamento ──────────────────────────────────────────────────────────────
const langs = readdirSync(localesDir)
  .filter(f => f.endsWith('.ts'))
  .map(f => f.replace(/\.ts$/, ''));

if (!langs.includes(CANONICAL)) throw new Error(`Locale canonica ${CANONICAL}.ts mancante in src/locales/`);

const dicts = new Map(langs.map(l => [l, parseLocale(l, readFileSync(join(localesDir, `${l}.ts`), 'utf8'))]));
const base    = dicts.get(CANONICAL);
const baseKeys = [...base.keys()];

// ─── Confronto ogni lingua ↔ canonica ──────────────────────────────────────────
for (const lang of langs) {
  if (lang === CANONICAL) continue;
  const d = dicts.get(lang);

  const missing = baseKeys.filter(k => !d.has(k));
  const extra   = [...d.keys()].filter(k => !base.has(k));
  if (missing.length) errors.push(`[i18n:${lang}] ${missing.length} chiave/i mancante/i (resterebbero in italiano): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}`);
  if (extra.length)   errors.push(`[i18n:${lang}] ${extra.length} chiave/i in più (assenti in ${CANONICAL}.ts): ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? ' …' : ''}`);

  for (const k of baseKeys) {
    if (!d.has(k)) continue;
    const a = placeholders(base.get(k)).join(',');
    const b = placeholders(d.get(k)).join(',');
    if (a !== b) errors.push(`[i18n:${lang}] segnaposto incoerenti in "${k}": it={${a}} ≠ ${lang}={${b}}`);
  }
}

// ─── Esito ───────────────────────────────────────────────────────────────────
const summary = `✅ i18n allineato: ${langs.length} lingue (${langs.join('·')}) · ${baseKeys.length} chiavi · segnaposto coerenti.`;
export { errors, summary };

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (errors.length) {
    console.error('\n❌ Dizionari i18n DISALLINEATI dalla locale canonica (it.ts):\n');
    for (const e of errors) console.error('   • ' + e);
    console.error(`\n${errors.length} problema/i. Allinea i file in src/locales/ (vedi docs/I18N.md).\n`);
    process.exit(1);
  }
  console.log(summary);
}
