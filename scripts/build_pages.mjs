import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '_site');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Publish only the static showcase, its referenced art, and recorded footage.
for (const name of ['index.html', 'landing.css', 'landing.js', 'showcase-config.mjs', 'assets', 'media']) {
  await cp(path.join(root, 'game/landing', name), path.join(output, name), { recursive: true });
}
// Version the complete module/media graph so browsers cannot mix old config
// or recordings with a freshly deployed HTML page.
const fingerprint = data => createHash('sha256').update(data).digest('hex').slice(0, 12);
const mediaVersion = fingerprint(await readFile(path.join(output, 'media/grid-dodger-demo.mp4')));
let config = await readFile(path.join(output, 'showcase-config.mjs'), 'utf8');
config = config.replace(/(videoSrc: '\.\/media\/grid-dodger-demo\.mp4)(?:\?[^']*)?'/, `$1?v=${mediaVersion}'`);
await writeFile(path.join(output, 'showcase-config.mjs'), config);
let script = await readFile(path.join(output, 'landing.js'), 'utf8');
script = script.replace('./showcase-config.mjs', `./showcase-config.mjs?v=${fingerprint(config)}`);
await writeFile(path.join(output, 'landing.js'), script);
let html = await readFile(path.join(output, 'index.html'), 'utf8');
html = html.replace('./landing.js', `./landing.js?v=${fingerprint(script)}`);
html = html.replace('./landing.css', `./landing.css?v=${fingerprint(await readFile(path.join(output, 'landing.css')))}`);
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
