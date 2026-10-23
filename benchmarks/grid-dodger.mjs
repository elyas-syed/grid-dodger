import { createGame, step, MOVES, clampMove } from "../src/engine.mjs";
import { formatDeciderState } from "../src/state-formatter.mjs";

export const SEEDS = [11, 23, 37, 53, 71];
export function seededRandom(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(1664525, n) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
export function snapshots() {
  const cases = [];
  for (let col = 0; col < 5; col++) {
    const neighbor = (d) => Math.max(0, Math.min(4, col + d));
    const layouts = [
      [],
      [{ col, row: 8 }],
      [
        { col, row: 8 },
        { col: neighbor(1), row: 8 },
      ],
      [
        { col, row: 8 },
        { col: neighbor(-1), row: 8 },
      ],
      [
        { col: neighbor(-1), row: 9 },
        { col: neighbor(1), row: 8 },
      ].filter((h) => h.row !== 9 || h.col !== col),
      [
        { col, row: 7 },
        { col: neighbor(1), row: 6 },
      ],
      [0, 1, 2, 3, 4].map((col) => ({ col, row: 8 })),
      [
        { col, row: 8 },
        { col: neighbor(1), row: 9 },
      ].filter((h) => h.row !== 9 || h.col !== col),
    ];
    layouts.forEach((hazards, i) =>
      cases.push({
        id: `col-${col}-layout-${i}`,
        state: { ...createGame(), playerCol: col, hazards },
      }),
    );
  }
  return cases;
}
// Intentionally simple baseline: collision facts plus deterministic tie-breaking.
export function heuristic(state) {
  const safe = MOVES.filter(
    (move) => !step(state, move, { spawnChance: 0 }).gameOver,
  );
  const ranked = safe.map((move) => ({
    move,
    danger: state.hazards.filter(
      (h) => h.col === clampMove(state, move) && h.row === state.rows - 3,
    ).length,
  }));
  ranked.sort(
    (a, b) =>
      a.danger - b.danger ||
      Number(b.move === "stay") - Number(a.move === "stay") ||
      MOVES.indexOf(a.move) - MOVES.indexOf(b.move),
  );
  return {
    choice: ranked[0]?.move || "stay",
    choiceProbability: 1,
    confidence: 1,
    source: "heuristic",
  };
}
export function originalBody(state) {
  const text =
    formatDeciderState(state).split("Move outcomes for THIS tick")[0] +
    "Pick the safest single move this tick among: left, stay, right. Avoid columns that will be occupied when hazards advance.";
  return {
    state: text,
    questions: {
      safest_move: {
        type: "choice",
        instructions:
          "Choose the move that best avoids falling hazards in the next rows. Prefer stay when left and right are equally risky. Do not choose a move that would leave the board.",
        criteria: {
          left: "move one column left (invalid if already at column 0)",
          stay: "do not move this tick",
          right:
            "move one column right (invalid if already at the last column)",
        },
      },
    },
  };
}
