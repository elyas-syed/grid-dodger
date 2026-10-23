/** Pure grid-dodger engine (no DOM). */

export const COLS = 5;
export const ROWS = 10;
export const MOVES = Object.freeze(["left", "stay", "right"]);

/**
 * Enemy fighter + dark asteroid (user-provided).
 * @typedef {"fighter-dark"|"asteroid"} HazardSkin
 * @typedef {{ col: number, row: number, skin?: HazardSkin }} Cell
 * @typedef {{
 *   cols: number,
 *   rows: number,
 *   playerCol: number,
 *   hazards: Cell[],
 *   score: number,
 *   gameOver: boolean,
 *   tick: number,
 * }} GameState
 */

const HAZARD_SKINS = Object.freeze([
  "fighter-dark",
  "fighter-dark",
  "asteroid",
  "asteroid",
]);

/** Difficulty changes density, never the one-row-per-tick movement rules. */
export function getDifficulty(score = 0) {
  const progress = Math.max(0, Math.min(1, (score - 100) / 400));
  return {
    label:
      score < 100
        ? "Standard"
        : score < 300
          ? "Rising"
          : score < 400
            ? "Hard"
            : "Extreme",
    spawnChances: [
      0.36 + 0.6 * progress,
      0.126 + 0.7 * progress,
      0.8 * progress,
      0.55 * progress,
    ],
  };
}

/** Pick a visual skin for a newly spawned hazard (stable for that hazard's life). */
export function pickHazardSkin(col, tick, rng = Math.random) {
  const i = Math.floor(rng() * HAZARD_SKINS.length);
  // Bias a little with col/tick so adjacent spawns vary more often.
  return HAZARD_SKINS[(i + col + tick) % HAZARD_SKINS.length];
}

/** @returns {GameState} */
export function createGame(cols = COLS, rows = ROWS) {
  return {
    cols,
    rows,
    playerCol: Math.floor(cols / 2),
    hazards: [],
    score: 0,
    gameOver: false,
    tick: 0,
  };
}

/** @param {GameState} state @param {"left"|"stay"|"right"} move */
export function clampMove(state, move) {
  if (move === "left") return Math.max(0, state.playerCol - 1);
  if (move === "right") return Math.min(state.cols - 1, state.playerCol + 1);
  return state.playerCol;
}

/** @param {GameState} state @param {"left"|"stay"|"right"} move */
export function applyMove(state, move) {
  if (state.gameOver) return state;
  return { ...state, playerCol: clampMove(state, move) };
}

/** True if any hazard shares the player's bottom-row cell. */
export function overlapsPlayer(state) {
  const playerRow = state.rows - 1;
  return state.hazards.some(
    (h) => h.row === playerRow && h.col === state.playerCol,
  );
}

/**
 * Advance hazards one row down; drop off-board; check collision with player (bottom row).
 * @param {GameState} state
 * @param {{ spawnChance?: number, rng?: () => number }} [opts]
 */
export function advanceHazards(state, opts = {}) {
  if (state.gameOver) return state;
  const difficulty = getDifficulty(state.score);
  const spawnChance = opts.spawnChance ?? difficulty.spawnChances[0];
  const rng = opts.rng ?? Math.random;

  let hazards = state.hazards
    .map((h) => ({ col: h.col, row: h.row + 1, skin: h.skin }))
    .filter((h) => h.row < state.rows);

  const nextTick = state.tick + 1;

  // Spawn 0–2 hazards on row 0
  if (rng() < spawnChance) {
    const col = Math.floor(rng() * state.cols);
    hazards.push({ col, row: 0, skin: pickHazardSkin(col, nextTick, rng) });
  }
  if (
    rng() <
    (opts.spawnChance == null ? difficulty.spawnChances[1] : spawnChance * 0.35)
  ) {
    const col = Math.floor(rng() * state.cols);
    if (!hazards.some((h) => h.row === 0 && h.col === col)) {
      hazards.push({
        col,
        row: 0,
        skin: pickHazardSkin(col, nextTick + 1, rng),
      });
    }
  }

  // Extra waves start after 100. Choose unused columns so each row has an opening.
  if (opts.spawnChance == null) {
    for (const chance of difficulty.spawnChances.slice(2)) {
      if (chance <= 0 || rng() >= chance) continue;
      const open = Array.from({ length: state.cols }, (_, col) => col).filter(
        (col) => !hazards.some((h) => h.row === 0 && h.col === col),
      );
      if (open.length <= 1) break;
      const col =
        open[Math.min(open.length - 1, Math.floor(rng() * open.length))];
      hazards.push({ col, row: 0, skin: pickHazardSkin(col, nextTick, rng) });
    }
  }

  const next = {
    ...state,
    hazards,
    score: state.score + 1,
    tick: state.tick + 1,
  };
  return { ...next, gameOver: overlapsPlayer(next) };
}

/**
 * Full tick: move, collide if stepping onto a hazard already on the bottom row,
 * then advance hazards and collide again.
 */
export function step(state, move, opts = {}) {
  if (state.gameOver) return state;
  const moved = applyMove(state, move);
  if (overlapsPlayer(moved)) {
    return { ...moved, gameOver: true };
  }
  return advanceHazards(moved, opts);
}
