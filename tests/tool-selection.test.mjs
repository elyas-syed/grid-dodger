import assert from "node:assert/strict";
import { test } from "node:test";
import {
  runToolRecipe,
  dispatchToolSelection,
} from "../src/tool-selection.mjs";
import { createGame, step } from "../src/engine.mjs";
import { createMoveTools, executeMoveTool } from "../src/move-tools.mjs";
import { collisionFacts } from "../src/run-summary.mjs";
import {
  snapshots,
  seededRandom,
  heuristic,
} from "../benchmarks/grid-dodger.mjs";

test("generic recipe dispatches only the selected registered tool", async () => {
  const calls = [];
  const tools = {
    search: { execute: () => calls.push("search") },
    ask: { execute: () => calls.push("ask") },
  };
  const output = await runToolRecipe({
    readDecision: async () => ({ choice: "search", choiceProbability: 0.8 }),
    tools,
    fallback: "ask",
  });
  assert.equal(output.selection.choice, "search");
  assert.deepEqual(calls, ["search"]);
  await runToolRecipe({
    readDecision: async () => ({ choice: "search", choiceProbability: 0.1 }),
    tools,
    fallback: "ask",
  });
  assert.deepEqual(calls, ["search", "ask"]);
  assert.throws(
    () => dispatchToolSelection({ choice: "constructor" }, tools),
    /Unregistered/,
  );
  await assert.rejects(
    () =>
      runToolRecipe({
        readDecision: async () => {
          throw Error("network failed");
        },
        tools,
        fallback: "ask",
      }),
    /network failed/,
  );
  assert.equal(calls.length, 2);
});

test("move tools execute exactly one engine tick and expose named actions", () => {
  const state = createGame();
  assert.equal(createMoveTools(state).left.name, "move_left");
  const next = executeMoveTool(state, { choice: "left" }, { spawnChance: 0 });
  assert.equal(next.playerCol, 1);
  assert.equal(next.tick, 1);
  assert.equal(state.tick, 0);
});

test("collision evidence distinguishes stepping onto a hazard from falling", () => {
  let state = { ...createGame(), hazards: [{ col: 3, row: 9 }] };
  assert.equal(
    collisionFacts(state, "right", step(state, "right")).stage,
    "step-on",
  );
  state = { ...createGame(), hazards: [{ col: 2, row: 8 }] };
  assert.equal(
    collisionFacts(state, "stay", step(state, "stay")).stage,
    "falling",
  );
  assert.equal(
    collisionFacts(state, "right", step(state, "right", { spawnChance: 0 })),
    null,
  );
});

test("benchmark fixtures are deterministic and baseline avoids avoidable collisions", () => {
  assert.equal(snapshots().length, 40);
  assert.deepEqual(snapshots(), snapshots());
  const a = seededRandom(11),
    b = seededRandom(11);
  assert.deepEqual(
    Array.from({ length: 100 }, a),
    Array.from({ length: 100 }, b),
  );
  for (const { state } of snapshots()) {
    const possible = ["left", "stay", "right"].some(
      (move) => !step(state, move, { spawnChance: 0 }).gameOver,
    );
    if (possible)
      assert.equal(
        step(state, heuristic(state).choice, { spawnChance: 0 }).gameOver,
        false,
      );
  }
});
