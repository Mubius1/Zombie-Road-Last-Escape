#!/usr/bin/env node
/**
 * Anti-deriva (bilanciamento): verifica che i numeri di GAMEPLAY nel CODICE
 * coincidano con quelli scritti nelle tabelle 🔒 di docs/BALANCE.md.
 *
 * Complementare a validate-art-bible.mjs (che copre l'identità VISIVA). Qui si
 * controllano i valori-sorgente del bilanciamento:
 *
 *   §1 Costanti  (GameScene.ts top-level         ↔ tabella §1)  → valore di ogni costante
 *   §3 Veicoli   (GameData.VEHICLES              ↔ tabella §3)  → healthBonus·armorBonus·speedMult·fireMult
 *   §5 Nemici    (GameScene.ZOMBIE_STATS+POOL    ↔ tabella §5)  → speed·hp·damage·score·peso pool
 *   §6 Boss      (GameScene.BOSS_CONFIG          ↔ tabella §6)  → hp·speed·reward·bodyW·bodyH
 *   §7 Armi      (GameData.WEAPONS               ↔ tabella §7)  → price·cooldown·damage·DPS(derivato)
 *   §8 Negozio   (ShopScene.SHOP_ITEMS           ↔ tabella §8)  → costo di ogni voce
 *
 * Esce con codice 1 (build fallita) se trova anche un solo disallineamento.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root      = join(dirname(fileURLToPath(import.meta.url)), '..');
const code      = readFileSync(join(root, 'src/scenes/GameScene.ts'), 'utf8');
const world     = readFileSync(join(root, 'src/World.ts'), 'utf8'); // BOSS_CONFIG vive qui (A4: modulo dati neutro)
const gameData  = readFileSync(join(root, 'src/GameData.ts'), 'utf8');
const shopSrc   = readFileSync(join(root, 'src/scenes/ShopScene.ts'), 'utf8');
const bible     = readFileSync(join(root, 'docs/BALANCE.md'), 'utf8');

const errors = [];
const EPS = 1e-6;
const near = (a, b) => Math.abs(a - b) < EPS;
const round1 = x => Math.round(x * 10) / 10;

// ─── Helper: lato CODICE ─────────────────────────────────────────────────────
// Blocco `{ ... }` bilanciato che segue l'header indicato.
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
// Corpo "key: { ... }" dentro un blocco oggetto (entry a riga singola, senza graffe annidate).
function entryBody(block, key) {
  const m = new RegExp(`\\b${key}\\s*:\\s*\\{([^}]*)\\}`).exec(block);
  if (!m) throw new Error(`Riga "${key}" non trovata nel blocco codice`);
  return m[1];
}
const intField = (body, field) => {
  const m = new RegExp(`\\b${field}\\s*:\\s*(-?\\d+)`).exec(body);
  if (!m) throw new Error(`Campo numerico "${field}" non trovato`);
  return parseInt(m[1], 10);
};
const floatField = (body, field) => {
  const m = new RegExp(`\\b${field}\\s*:\\s*(-?[\\d.]+)`).exec(body);
  if (!m) throw new Error(`Campo numerico "${field}" non trovato`);
  return parseFloat(m[1]);
};
// Valore di una costante top-level: `const NAME = 123(.45);`
function codeConst(name) {
  const m = new RegExp(`\\bconst\\s+${name}\\s*=\\s*(-?[\\d.]+)`).exec(code);
  if (!m) throw new Error(`Costante "${name}" non trovata in GameScene.ts`);
  return parseFloat(m[1]);
}

// ─── Helper: lato BIBLE (markdown) ───────────────────────────────────────────
// Celle (trim) che seguono una riga di tabella la cui PRIMA cella è `key`.
function bibleRow(key) {
  const m = new RegExp(`\\|\\s*\`${key}\`\\s*\\|([^\\n]*)`).exec(bible);
  return m ? m[1].split('|').map(c => c.trim()) : null;
}
// Cella → numero. Gestisce separatori delle migliaia (spazi), prefissi ×/+, "—"/vuoto → null.
function num(cell) {
  const s = String(cell).replace(/`/g, '').trim();
  if (s === '' || s === '—') return null;
  const cleaned = s.replace(/(\d)[   ,](\d)/g, '$1$2'); // 18 000 → 18000
  // Normalizza i trattini/minus unicode (en/em-dash, U+2212) in '-' ASCII prima di estrarre.
  const m = cleaned.replace(/[‒–—−]/g, '-').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
// Confronto numerico bible↔codice con report uniforme.
function check(tag, field, codeVal, cell, opts = {}) {
  const b = num(cell);
  if (b === null) { errors.push(`[${tag}] ${field}: cella bible vuota/non numerica ("${cell}")`); return; }
  const ok = opts.round ? near(round1(codeVal), round1(b)) : near(codeVal, b);
  if (!ok) errors.push(`[${tag}] ${field}: codice ${opts.round ? round1(codeVal) : codeVal} ≠ bible ${b}`);
}

// Chiavi di primo livello di un blocco-oggetto Record (`nome: { ... }`).
function recordKeys(block) {
  const keys = []; const re = /(\w+)\s*:\s*\{/g; let m;
  while ((m = re.exec(block))) keys.push(m[1]);
  return keys;
}
// Cross-check di COPERTURA: ogni entità nel codice deve essere validata, e ogni
// chiave attesa dal validatore deve esistere nel codice. Pizzica le entità
// NUOVE o RIMOSSE (veicolo/arma/boss/nemico/voce-negozio) dimenticate nel documento.
function checkCoverage(tag, codeKeys, expected) {
  const cs = new Set(codeKeys), es = new Set(expected);
  for (const k of cs) if (!es.has(k))
    errors.push(`[${tag}] chiave "${k}" nel codice ma NON validata — aggiungila al validatore e alla tabella 🔒 di BALANCE.md`);
  for (const k of es) if (!cs.has(k))
    errors.push(`[${tag}] chiave "${k}" attesa dal validatore ma ASSENTE dal codice — rimuovila dal validatore e dalla tabella`);
}

// ════════════════════════════════════════════════════════════════════════════
// §1 — COSTANTI DI MISSIONE
// ════════════════════════════════════════════════════════════════════════════
const CONSTS = [
  'SCROLL_SPEED', 'MISSION_DIST', 'BOSS_TRIGGER', 'BASE_FUEL_DRAIN', 'MAX_FUEL',
  'GIANT_SPAWN_INTERVAL', 'COMBO_WINDOW', 'DASH_COOLDOWN', 'DASH_GRACE',
  'ATTACH_DAMAGE_AMOUNT', 'ATTACH_DAMAGE_INTERVAL',
  // Sovraccarico (Overdrive, A3)
  'OVERDRIVE_MAX', 'OVERDRIVE_DURATION', 'OVERDRIVE_FIRE_MULT', 'OVERDRIVE_SHOCK_DMG',
  'OVERDRIVE_CHARGE_BASE', 'OVERDRIVE_CHARGE_COMBO',
  // Rework componenti: motore onesto (M1) + corazza passiva (M2)
  'ENGINE_SCROLL_MIN', 'ARMOR_MULT_FLOOR',
];
for (const name of CONSTS) {
  let codeVal;
  try { codeVal = codeConst(name); } catch (e) { errors.push(`[const:${name}] ${e.message}`); continue; }
  const cells = bibleRow(name);
  if (!cells) { errors.push(`BALANCE §1: riga costante \`${name}\` non trovata.`); continue; }
  check(`const:${name}`, 'valore', codeVal, cells[0]);
}

// ════════════════════════════════════════════════════════════════════════════
// §3 — VEICOLI (bonus di potere)
// ════════════════════════════════════════════════════════════════════════════
const VEHICLE_KEYS = [
  'civilian_car', 'pickup', 'armored_van', 'military_suv',
  'armored_truck', 'heavy_military', 'experimental',
];
const vehSrc = sliceObject(gameData, 'export const VEHICLES');
checkCoverage('veicoli', recordKeys(vehSrc), VEHICLE_KEYS);
for (const key of VEHICLE_KEYS) {
  let c;
  try {
    const body = entryBody(vehSrc, key);
    c = {
      healthBonus: intField(body, 'healthBonus'),
      armorBonus:  intField(body, 'armorBonus'),
      speedMult:   floatField(body, 'speedMult'),
      fireMult:    floatField(body, 'fireMult'),
    };
  } catch (e) { errors.push(`[veicolo:${key}] codice: ${e.message}`); continue; }

  const cells = bibleRow(key); // [Nome, +Salute, +Armatura, ×Velocità, ×Cadenza, …]
  if (!cells || cells.length < 5) { errors.push(`BALANCE §3: riga veicolo \`${key}\` non trovata o malformata.`); continue; }
  check(`veicolo:${key}`, '+Salute',   c.healthBonus, cells[1]);
  check(`veicolo:${key}`, '+Armatura', c.armorBonus,  cells[2]);
  check(`veicolo:${key}`, '×Velocità', c.speedMult,   cells[3]);
  check(`veicolo:${key}`, '×Cadenza',  c.fireMult,    cells[4]);
}

// ════════════════════════════════════════════════════════════════════════════
// §5 — NEMICI (statistiche + peso pool)
// ════════════════════════════════════════════════════════════════════════════
const ZOMBIE_KEYS = ['common', 'runner', 'armored', 'jumper', 'toxic', 'giant', 'charger', 'spitter'];
const statsSrc = sliceObject(code, 'const ZOMBIE_STATS');
checkCoverage('nemici', recordKeys(statsSrc), ZOMBIE_KEYS);
// SPAWN_POOL: salta l'annotazione di tipo (`ZombieType[]`) cercando l'array dopo '='.
const poolMatch = /const SPAWN_POOL[^=]*=\s*\[([^\]]*)\]/.exec(code);
const poolBody = poolMatch ? poolMatch[1] : '';
if (!poolMatch) errors.push('[pool] SPAWN_POOL non trovato in GameScene.ts');
const poolCount = key => (poolBody.match(new RegExp(`'${key}'`, 'g')) || []).length;

for (const key of ZOMBIE_KEYS) {
  let c;
  try {
    const body = entryBody(statsSrc, key);
    c = {
      speed:  intField(body, 'speed'),
      hp:     intField(body, 'hp'),
      damage: intField(body, 'damage'),
      score:  intField(body, 'score'),
    };
  } catch (e) { errors.push(`[zombie:${key}] codice: ${e.message}`); continue; }

  const cells = bibleRow(key); // [Tipo, Velocità, HP, Danno, Punteggio, Peso pool, …]
  if (!cells || cells.length < 6) { errors.push(`BALANCE §5: riga nemico \`${key}\` non trovata o malformata.`); continue; }
  check(`zombie:${key}`, 'velocità',  c.speed,  cells[1]);
  check(`zombie:${key}`, 'hp',        c.hp,     cells[2]);
  check(`zombie:${key}`, 'danno',     c.damage, cells[3]);
  check(`zombie:${key}`, 'punteggio', c.score,  cells[4]);
  // Peso pool: cella "—" (Gigante) → non validato; altrimenti = occorrenze in SPAWN_POOL.
  if (num(cells[5]) !== null) check(`zombie:${key}`, 'peso pool', poolCount(key), cells[5]);
}

// ════════════════════════════════════════════════════════════════════════════
// §6 — BOSS (leve di bilanciamento: hp · velocità · reward)
// La hitbox (bodyW/bodyH) NON è validata qui: è accoppiata alla texture
// (scaleX/scaleY, vedi commento in BOSS_CONFIG e art bible §6.7) e tarata per
// tenere invariata la hitbox effettiva nel mondo → resta di competenza dell'arte.
// ════════════════════════════════════════════════════════════════════════════
const BOSS_KEYS = ['mega_mutant', 'giant_worm', 'armored_colossus', 'radioactive_beast'];
const bossSrc = sliceObject(world, 'const BOSS_CONFIG'); // A4: BOSS_CONFIG spostato in src/World.ts
checkCoverage('boss', recordKeys(bossSrc), BOSS_KEYS);
for (const key of BOSS_KEYS) {
  let c;
  try {
    const body = entryBody(bossSrc, key);
    c = {
      hp:     intField(body, 'hp'),
      speed:  intField(body, 'speed'),
      reward: intField(body, 'reward'),
    };
  } catch (e) { errors.push(`[boss:${key}] codice: ${e.message}`); continue; }

  const cells = bibleRow(key); // [Boss, HP, Velocità, Ricompensa, …]
  if (!cells || cells.length < 4) { errors.push(`BALANCE §6: riga boss \`${key}\` non trovata o malformata.`); continue; }
  check(`boss:${key}`, 'hp',       c.hp,     cells[1]);
  check(`boss:${key}`, 'velocità', c.speed,  cells[2]);
  check(`boss:${key}`, 'reward',   c.reward, cells[3]);
}

// ════════════════════════════════════════════════════════════════════════════
// §7 — ARMI (valori-sorgente + DPS derivato)
// ════════════════════════════════════════════════════════════════════════════
const WEAPON_KEYS = ['mg', 'double_mg', 'rifle', 'rockets', 'flamethrower'];
const wpnSrc = sliceObject(gameData, 'export const WEAPONS');
checkCoverage('armi', recordKeys(wpnSrc), WEAPON_KEYS);
for (const key of WEAPON_KEYS) {
  let c;
  try {
    const body = entryBody(wpnSrc, key);
    c = {
      price:    intField(body, 'price'),
      cooldown: intField(body, 'cooldown'),
      damage:   intField(body, 'damage'),
    };
  } catch (e) { errors.push(`[arma:${key}] codice: ${e.message}`); continue; }

  const cells = bibleRow(key); // [Arma, Prezzo, Cooldown, Danno, DPS, Range, Profilo, …]
  if (!cells || cells.length < 5) { errors.push(`BALANCE §7: riga arma \`${key}\` non trovata o malformata.`); continue; }
  check(`arma:${key}`, 'prezzo',   c.price,    cells[1]);
  check(`arma:${key}`, 'cooldown', c.cooldown, cells[2]);
  check(`arma:${key}`, 'danno',    c.damage,   cells[3]);
  // DPS per linea = danno / (cooldown/1000), confronto a 1 decimale.
  check(`arma:${key}`, 'DPS', c.damage / (c.cooldown / 1000), cells[4], { round: true });
}

// ════════════════════════════════════════════════════════════════════════════
// §8 — NEGOZIO (costi)
// ════════════════════════════════════════════════════════════════════════════
const SHOP_KEYS = ['repair', 'restock', 'armor', 'engine', 'turret', 'fuelTank',
  'plating', 'ram', 'nitro', 'ammo', 'filters', 'overcharge'];
// SHOP_ITEMS è un ARRAY ([...]) non un oggetto: prendo il contenuto fra '[' e '];'
// (salto l'annotazione di tipo `ShopItem[]` cercando dopo '=').
const shopArr = /const SHOP_ITEMS[^=]*=\s*\[([\s\S]*?)\]\s*;/.exec(shopSrc);
const shopBlock = shopArr ? shopArr[1] : '';
if (!shopArr) errors.push('[negozio] SHOP_ITEMS non trovato in ShopScene.ts');
checkCoverage('negozio', [...shopBlock.matchAll(/\bkey:\s*'(\w+)'/g)].map(m => m[1]), SHOP_KEYS);
for (const key of SHOP_KEYS) {
  // Isola l'oggetto { … key: 'X' … } (entry a riga singola, niente graffe annidate),
  // poi leggi il PRIMO campo cost: → robusto anche se un desc contenesse "cost:".
  const em = new RegExp(`\\{[^{}]*\\bkey:\\s*'${key}'[^{}]*\\}`).exec(shopBlock);
  if (!em) { errors.push(`[negozio:${key}] voce non trovata in SHOP_ITEMS`); continue; }
  const m = /\bcost:\s*(\d+)/.exec(em[0]);
  if (!m) { errors.push(`[negozio:${key}] campo cost non trovato per la voce`); continue; }
  const codeCost = parseInt(m[1], 10);

  const cells = bibleRow(key); // [Voce, Costo, Tipo, Effetto, …]
  if (!cells || cells.length < 2) { errors.push(`BALANCE §8: riga negozio \`${key}\` non trovata o malformata.`); continue; }
  check(`negozio:${key}`, 'costo', codeCost, cells[1]);
}

// ════════════════════════════════════════════════════════════════════════════
// Esito (riusabile come modulo o eseguibile da CLI)
// ════════════════════════════════════════════════════════════════════════════
const summary =
  `✅ Bilanciamento allineato: ${CONSTS.length} costanti · ${VEHICLE_KEYS.length} veicoli · ` +
  `${ZOMBIE_KEYS.length} nemici · ${BOSS_KEYS.length} boss · ${WEAPON_KEYS.length} armi · ` +
  `${SHOP_KEYS.length} voci negozio verificate (+ copertura: nessuna entità nuova/rimossa non validata).`;

export { errors, summary };

// Eseguito direttamente da `node scripts/validate-balance.mjs`?
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (errors.length) {
    console.error('\n❌ BALANCE.md DISALLINEATO dal codice:\n');
    for (const e of errors) console.error('   • ' + e);
    console.error(`\n${errors.length} disallineamento/i. Aggiorna docs/BALANCE.md (tabelle 🔒) o il codice.\n`);
    process.exit(1);
  }
  console.log(summary);
}
