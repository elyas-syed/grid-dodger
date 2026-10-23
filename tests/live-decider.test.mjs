/**
 * Opt-in live integration against a running strands-decider serve.
 *
 *   DECIDER_URL=http://127.0.0.1:8000 npm run test:live
 *
 * Skips by default so CI stays mock-only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGame, MOVES, step } from "../src/engine.mjs";
import { httpDecide } from "../src/decider-http.mjs";
import { applyDecisionPolicy } from "../src/policy.mjs";

const live = process.env.DECIDER_LIVE === "1";
const url = (process.env.DECIDER_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

describe("live strands-decider (opt-in)", { skip: !live }, () => {
  it("returns a valid move enum with confidence", async () => {
    const s = createGame();
    s.playerCol = 2;
    s.hazards = [{ col: 2, row: s.rows - 2 }];
    const d = await httpDecide(s, { url });
    assert.ok(MOVES.includes(d.choice), `unexpected choice: ${d.choice}`);
    assert.ok(d.confidence >= 0 && d.confidence <= 1);
    assert.ok(d.decide_ms >= 0);
    console.log(
      `live decide → ${d.choice} conf=${d.confidence.toFixed(3)} ${d.decide_ms}ms model=${d.model}`,
    );
  });

  for (const [name, playerCol, hazards, expected] of [
    ["only left safe", 2, [{ col: 2, row: 8 }, { col: 3, row: 9 }], "left"],
    ["only right safe", 2, [{ col: 2, row: 8 }, { col: 1, row: 9 }], "right"],
    ["left edge escape", 0, [{ col: 0, row: 8 }], "right"],
  ]) {
    it(`avoids collision: ${name}`, async () => {
      const state = { ...createGame(), playerCol, hazards };
      const raw = await httpDecide(state, { url });
      const move = applyDecisionPolicy(raw, 0.4).choice;
      assert.equal(move, expected, `${name}: model=${raw.choice}, confidence=${raw.confidence}`);
      assert.equal(step(state, move, { spawnChance: 0 }).gameOver, false);
    });
  }
});
