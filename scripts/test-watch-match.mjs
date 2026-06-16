import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const WATCHED = [
  'src/GameData.ts',
  'src/scenes/GameScene.ts',
].map(p => resolve(root, p));

console.log('Root:', root);
console.log('WATCHED paths:');
WATCHED.forEach(p => console.log('  ' + p));

// Test various emissions
const file1 = resolve(root, 'src/GameData.ts');
const match1 = WATCHED.includes(file1);
console.log(`\nDirect resolve: ${match1} - ${file1}`);

// Forward slashes
const file2 = resolve(root + '/src/GameData.ts');
const match2 = WATCHED.includes(resolve(file2));
console.log(`Forward slashes resolve: ${match2} - ${resolve(file2)}`);

// Case sensitivity
const file3 = resolve(root, 'src/gamedata.ts');
const match3 = WATCHED.includes(resolve(file3));
console.log(`Different case: ${match3} - ${resolve(file3)}`);
