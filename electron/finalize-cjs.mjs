// Post-compilazione del wrapper Electron: marca `dist-electron/` come CommonJS.
//
// Perché serve: il package root è `"type": "module"`, quindi senza override Node/Electron
// tratterebbe i `.js` emessi in `dist-electron/` come ESM e fallirebbe (il nostro main/preload
// è compilato come CommonJS: usa `require`/`__dirname`). Scrivendo un package.json locale con
// `{"type":"commonjs"}` in quella cartella, i `.js` lì dentro tornano CommonJS — isolato dal
// resto del progetto. Eseguito da `build:electron` (e dal launcher dev compila a parte).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'dist-electron');

await mkdir(outDir, { recursive: true });
await writeFile(
  resolve(outDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
  'utf8',
);

console.log('[build:electron] dist-electron/package.json scritto ({"type":"commonjs"})');
