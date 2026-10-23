import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyMove,
  advanceHazards,
  createGame,
  clampMove,
  step,
  getDifficulty,
} from "../src/engine.mjs";

describe("engine", () => {
  it("clamps left/right at edges", () => {
    const s = createGame();
    s.playerCol = 0;
    assert.equal(clampMove(s, "left"), 0);
    s.playerCol = s.cols - 1;
    assert.equal(clampMove(s, "right"), s.cols - 1);
  });

  it("applyMove updates column", () => {
    let s = createGame();
    s.playerCol = 2;
    s = applyMove(s, "left");
    assert.equal(s.playerCol, 1);
  });

  it("advanceHazards moves rows down and increments score", () => {
    let s = createGame();
    s.hazards = [{ col: 0, row: 0 }];
    s = advanceHazards(s, { spawnChance: 0, rng: () => 0 });
    assert.equal(s.hazards[0].row, 1);
    assert.equal(s.score, 1);
  });

  it("collision on player row sets gameOver", () => {
    let s = createGame();
    s.playerCol = 2;
    // Hazard one row above player will land on player after advance
    s.hazards = [{ col: 2, row: s.rows - 2 }];
    s = advanceHazards(s, { spawnChance: 0, rng: () => 0 });
    assert.equal(s.gameOver, true);
  });

  it("step kills when moving onto a hazard already on the bottom row", () => {
    let s = createGame();
    s.playerCol = 1;
    s.hazards = [{ col: 2, row: s.rows - 1 }];
    s = step(s, "right", { spawnChance: 0, rng: () => 0 });
    assert.equal(s.playerCol, 2);
    assert.equal(s.gameOver, true);
  });

  it("step combines move and advance", () => {
    let s = createGame();
    s.playerCol = 2;
    s = step(s, "right", { spawnChance: 0, rng: () => 0 });
    assert.equal(s.playerCol, 3);
    assert.equal(s.tick, 1);
  });
});

it("hazard density increases progressively after 100 and keeps movement one row per tick", () => {
  assert.equal(getDifficulty(99).label, "Standard");
  assert.equal(getDifficulty(100).label, "Rising");
  assert.equal(getDifficulty(300).label, "Hard");
  assert.equal(getDifficulty(400).label, "Extreme");
  const counts = [];
  for (const score of [0, 100, 200, 300, 400, 499]) {
    let seed = 12345,
      total = 0;
    const rng = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 2000; i++) {
      const after = advanceHazards(
        { ...createGame(), score, hazards: [{ col: 0, row: 3 }] },
        { rng },
      );
      const spawned = after.hazards.filter((h) => h.row === 0);
      assert.ok(
        spawned.length <= 4,
        "every new five-column row has an opening",
      );
      assert.equal(new Set(spawned.map((h) => h.col)).size, spawned.length);
      assert.ok(after.hazards.some((h) => h.col === 0 && h.row === 4));
      total += spawned.length;
    }
    counts.push(total / 2000);
  }
  assert.equal(counts[0], counts[1]);
  for (let i = 2; i < counts.length; i++) assert.ok(counts[i] > counts[i - 1]);
  assert.ok(counts.at(-1) > counts[0] * 4);
});

it("explicit spawn overrides remain deterministic at high difficulty", () => {
  const after = advanceHazards(
    { ...createGame(), score: 499 },
    { spawnChance: 0, rng: () => 0 },
  );
  assert.equal(after.hazards.length, 0);
});
