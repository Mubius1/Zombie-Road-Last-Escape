import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

console.log('import.meta.url:', import.meta.url);
console.log('here:', here);
console.log('root:', root);

const WATCHED = [
  'src/GameData.ts', 'src/Ui.ts',
  'src/scenes/GameScene.ts', 'src/scenes/ShopScene.ts',
  'docs/ART_BIBLE_ZOMBIES.md', 'docs/ART_BIBLE_OGGETTI.md', 'docs/ART_BIBLE_INTERFACCE.md',
  'docs/BALANCE.md',
].map(p => resolve(root, p));

console.log('\nFirst 3 WATCHED paths:');
WATCHED.slice(0, 3).forEach(p => console.log('  ' + p));
