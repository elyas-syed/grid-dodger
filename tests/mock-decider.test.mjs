import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGame, MOVES } from "../src/engine.mjs";
import { mockDecide } from "../src/decider-mock.mjs";
import { formatDeciderState } from "../src/state-formatter.mjs";

describe("mock decider + helpers", () => {
  it("returns a valid move enum", () => {
    const s = createGame();
    s.hazards = [{ col: 2, row: s.rows - 2 }];
    const d = mockDecide(s);
    assert.ok(MOVES.includes(d.choice));
    assert.ok(d.confidence >= 0 && d.confidence <= 1);
  });

  it("avoids a hazard one row above the player", () => {
    const s = createGame();
    s.playerCol = 2;
    s.hazards = [{ col: 2, row: s.rows - 2 }];
    const d = mockDecide(s);
    assert.notEqual(d.choice, "stay");
    assert.ok(MOVES.includes(d.choice));
  });

  it("formats state with player column", () => {
    const s = createGame();
    const text = formatDeciderState(s);
    assert.match(text, /Player column:/);
    assert.match(text, /left, stay, right/);
  });
});
