import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '_site');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Publish only the static showcase, its referenced art, and recorded footage.
for (const name of ['index.html', 'landing.css', 'landing.js', 'showcase-config.mjs', 'assets', 'media']) {
  await cp(path.join(root, 'game/landing', name), path.join(output, name), { recursive: true });
}
let html = await readFile(path.join(output, 'index.html'), 'utf8');
const assets = new Set([...html.matchAll(/(?:src|poster)="\.\.\/assets\/([^"]+)"/g)].map(match => match[1]));
for (const name of assets) {
  if (name.includes('..')) throw new Error('Unexpected asset path');
  const target = path.join(output, 'game-assets', name);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(path.join(root, 'game/assets', name), target);
}
html = html.replaceAll('../assets/', './game-assets/');
await writeFile(path.join(output, 'index.html'), html);
await writeFile(path.join(output, '.nojekyll'), '');
console.log('Static GitHub Pages showcase built in _site/. No inference backend is included.');
