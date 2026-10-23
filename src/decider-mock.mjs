import { MOVES } from "./engine.mjs";

/**
 * Heuristic mock: prefer moving away from hazards on the next player-approaching row.
 * Deterministic given state — good for CI and offline demos.
 *
 * @param {import('./engine.mjs').GameState} state
 * @returns {{ choice: "left"|"stay"|"right", confidence: number, source: string }}
 */
export function mockDecide(state) {
  const playerRow = state.rows - 1;
  const dangerRow = playerRow - 1;
  const dangers = new Set(
    state.hazards.filter((h) => h.row === dangerRow).map((h) => h.col),
  );

  const candidates = MOVES.map((move) => {
    let col = state.playerCol;
    if (move === "left") col = Math.max(0, col - 1);
    if (move === "right") col = Math.min(state.cols - 1, col + 1);
    const hit = dangers.has(col);
    return { move, col, hit };
  });

  const safe = candidates.filter((c) => !c.hit);
  let choice;
  if (safe.length === 0) {
    choice = "stay";
  } else if (safe.some((c) => c.move === "stay")) {
    choice = "stay";
  } else {
    choice = safe[0].move;
  }

  const confidence = safe.length === 0 ? 0.4 : safe.length === 3 ? 0.9 : 0.75;
  return { choice, confidence, source: "mock" };
}
