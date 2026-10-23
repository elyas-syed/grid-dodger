import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));

test('Pages artifact resolves its asset graph below a project prefix and excludes backend/private material', () => {
  execFileSync(process.execPath, ['scripts/build_pages.mjs'], { cwd: root });
  const site = path.join(root, '_site');
  const pageUrl = new URL('https://example.github.io/grid-dodger/');
  const html = readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /\bautoplay\b|<iframe|RECORDING IN PREPARATION|strands-test/);
  assert.match(html, /<video[^>]+controls[^>]+playsinline/);
  const pending = ['index.html', 'landing.css', 'landing.js', 'showcase-config.mjs'];
  const visited = new Set();
  while (pending.length) {
    const file = pending.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(path.join(site, file), 'utf8');
    const refs = [...source.matchAll(/(?:src|poster|href)="([^"]+)"|(?:from\s+|videoSrc:\s*)['"]([^'"]+)['"]|url\(['"]?([^'"\)]+)['"]?\)/g)]
      .map(m => m[1] || m[2] || m[3]);
    for (const ref of refs) {
      if (/^(https?:|data:|#)/.test(ref)) continue;
      const resolved = new URL(ref, new URL(file, pageUrl));
      assert.ok(resolved.pathname.startsWith('/grid-dodger/'), `${ref} escapes project prefix`);
      const relative = decodeURIComponent(resolved.pathname.slice('/grid-dodger/'.length));
      assert.ok(existsSync(path.join(site, relative)), `Missing asset ${relative}`);
      if (/\.(?:m?js|css)$/.test(relative)) pending.push(relative);
    }
  }
  for (const [, file] of html.matchAll(/data-repository-path="([^"]*)"/g)) {
    if (file) assert.ok(existsSync(path.join(root, file)), `Missing linked repository file ${file}`);
  }
  const config = readFileSync(path.join(site, 'showcase-config.mjs'), 'utf8');
  assert.match(config, /repositoryRef: 'main'/);
  assert.match(config, /elyas-syed\/grid-dodger/);
  const allowed = new Set(['index.html', 'landing.css', 'landing.js', 'showcase-config.mjs', 'assets', 'media', 'game-assets', '.nojekyll']);
  for (const file of readdirSync(site)) assert.ok(allowed.has(file), `Unexpected published path ${file}`);
  const video = path.join(site, 'media/grid-dodger-demo.mp4');
  assert.ok(statSync(video).size > 1_000_000, 'Video is empty or unexpectedly small');
  assert.ok(statSync(video).size < 100 * 1024 * 1024, 'Video exceeds repository file limit');
});
