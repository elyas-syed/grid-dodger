import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const terraform = readFileSync(new URL('../terraform/cloudfront_functions.tf', import.meta.url), 'utf8');
const block = terraform.split('resource "aws_cloudfront_function" "game_index" {')[1];
const source = block.match(/code\s*=\s*<<-EOF\n([\s\S]*?)\n\s*EOF/)[1];
const context = vm.createContext({});
vm.runInContext(source, context);

test('CloudFront resolves arcade and landing directory URLs without changing explicit objects or API paths', () => {
  for (const [uri, expected] of [
    ['/game/', '/game/index.html'],
    ['/game/landing/', '/game/landing/index.html'],
    ['/game/index.html', '/game/index.html'],
    ['/game/landing/index.html', '/game/landing/index.html'],
    ['/game/landing/landing.css', '/game/landing/landing.css'],
    ['/game/landing/landing.js', '/game/landing/landing.js'],
    ['/game/landing/media/grid-dodger-demo.mp4', '/game/landing/media/grid-dodger-demo.mp4'],
    ['/api/recap', '/api/recap'],
    ['/decider/health', '/decider/health'],
    ['/game/landing-other/', '/game/landing-other/'],
  ]) {
    const request = { uri, method: 'GET', headers: {}, querystring: { v: { value: '123' } } };
    const result = context.handler({ request });
    assert.equal(result, request);
    assert.equal(result.uri, expected);
    assert.equal(result.querystring.v.value, '123');
  }
});

test('CloudFront preserves existing root redirects and canonicalizes the landing directory', () => {
  for (const [uri, location] of [['/', '/game/index.html'], ['/game', '/game/index.html'], ['/game/landing', '/game/landing/']]) {
    const result = context.handler({ request: { uri } });
    assert.equal(result.statusCode, 302);
    assert.equal(result.headers.location.value, location);
  }
});
