import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

console.log('here:', here);
console.log('root:', root);
console.log('exists:', import.meta.url);

const testWatched = 'src/GameData.ts';
const resolved = resolve(root, testWatched);
console.log('Resolved src/GameData.ts:', resolved);
