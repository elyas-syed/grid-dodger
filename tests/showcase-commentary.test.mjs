import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('recorded commentary follows playback, seeking, and replay', () => {
  const source = readFileSync(new URL('../game/landing/landing.js', import.meta.url), 'utf8');
  const script = source.slice(source.indexOf('// Keep summaries aligned'));
  const nodes = new Map();
  const events = {};
  const video = { currentTime: 0, addEventListener: (name, fn) => { events[name] = fn; } };
  const document = { getElementById: id => { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); } };
  vm.runInNewContext(script, { video, document });
  for (const [time, expected] of [[0,'MEET THE MODEL'],[11,'HUMAN MODE'],[21,'DECIDER MODE'],[30,'FOLLOW THE DECISION'],[39,'SHADOW MODE'],[47,'BEDROCK RECAP'],[53,'REUSABLE PATTERN'],[79.55,'YOUR NEXT MOVE'],[0,'MEET THE MODEL'],[40,'SHADOW MODE']]) {
    video.currentTime = time;
    events.seeked();
    assert.equal(nodes.get('commentary-phase').textContent, expected);
  }
  for (const event of ['timeupdate','seeked','loadedmetadata','ended']) assert.equal(typeof events[event], 'function');
});
