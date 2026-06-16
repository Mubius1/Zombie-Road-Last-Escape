// Plugin Vite (solo `serve`/dev): esegue i validatori anti-deriva all'avvio del
// dev server e a ogni salvataggio dei file rilevanti. In caso di disallineamento
// mostra un banner in console e l'overlay d'errore nel browser, SENZA fermare il
// server (in build il gate duro è già negli script npm: validate:art / validate:balance).
//
// Tiene allineati dev e build usando esattamente gli stessi script.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const VALIDATORS = [
  { name: 'art',     script: join(here, 'validate-art-bible.mjs') },
  { name: 'balance', script: join(here, 'validate-balance.mjs') },
  { name: 'audio',   script: join(here, 'validate-audio.mjs') },
];

// File che, cambiando, possono disallineare codice ↔ documenti.
const WATCHED = [
  'src/GameData.ts', 'src/Ui.ts', 'src/SoundManager.ts',
  'src/scenes/GameScene.ts', 'src/scenes/ShopScene.ts',
  'docs/ART_BIBLE_ZOMBIES.md', 'docs/ART_BIBLE_OGGETTI.md', 'docs/ART_BIBLE_INTERFACCE.md',
  'docs/ART_BIBLE_AUDIO.md', 'docs/BALANCE.md',
].map(p => resolve(root, p));

const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m/g, '');

/** Esegue tutti i validatori. Ritorna l'elenco dei falliti con il loro output. */
function runValidators() {
  const failures = [];
  for (const v of VALIDATORS) {
    const r = spawnSync(process.execPath, [v.script], { cwd: root, encoding: 'utf8' });
    // spawn fallito (node assente, permessi, limiti FD): r.error è impostato, r.status è null.
    if (r.error) { failures.push({ name: v.name, out: `impossibile eseguire il validatore: ${r.error.message}` }); continue; }
    if (r.status !== 0) {
      const out = ((r.stdout || '') + (r.stderr || '')).trim() || `(uscita ${r.status})`;
      failures.push({ name: v.name, out });
    }
  }
  return failures;
}

export default function validateOnDev() {
  let lastFailed = false;

  return {
    name: 'zombie-road:validate',
    apply: 'serve', // inerte in build

    configureServer(server) {
      const logger = server.config.logger;

      const check = (label) => {
        const failures = runValidators();

        if (failures.length) {
          lastFailed = true;
          const body = failures.map(f => f.out).join('\n\n');
          logger.error(
            `\n\x1b[41m\x1b[97m  ✗ DERIVA RILEVATA — validazione fallita (${label})  \x1b[0m\n` +
            `${body}\n` +
            `\x1b[33m   → Allinea codice e documenti (docs/*.md), poi salva di nuovo.\x1b[0m\n`,
            { timestamp: true }
          );
          // Overlay d'errore nel browser (non blocca il dev server). server.ws può
          // mancare in setup HMR atipici (middlewareMode) → guardia con optional chaining.
          server.ws?.send({
            type: 'error',
            err: {
              message: `Deriva doc↔codice (${failures.map(f => f.name).join(', ')}):\n\n${stripAnsi(body)}`,
              stack: '',
              plugin: 'zombie-road:validate',
              id: 'docs/BALANCE.md',
              loc: { file: 'docs/BALANCE.md', line: 1, column: 1 },
            },
          });
        } else {
          if (lastFailed) {
            logger.info('\x1b[42m\x1b[30m  ✓ Validazione ripristinata  \x1b[0m', { timestamp: true });
            server.ws?.send({ type: 'full-reload' }); // pulisce l'overlay
          }
          lastFailed = false;
        }
      };

      // Avvio del dev server.
      check('avvio');

      // Ri-validazione (debounce) sui file rilevanti.
      let timer = null;
      const onChange = (file) => {
        if (!WATCHED.includes(resolve(file))) return;
        clearTimeout(timer);
        timer = setTimeout(() => check('modifica'), 150);
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
