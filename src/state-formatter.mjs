/** Build compact Decider state text from engine state. */
import { clampMove, MOVES } from "./engine.mjs";

/** Describe the engine's move-then-fall collision rules for each model option. */
export function describeMoveOutcomes(state) {
  const bottom = state.rows - 1;
  return Object.fromEntries(MOVES.map((move) => {
    const col = clampMove(state, move);
    const collision = state.hazards.some(h => h.col === col && (h.row === bottom || h.row === bottom - 1));
    const blocked = move !== "stay" && col === state.playerCol;
    const approaching = state.hazards.some(h => h.col === col && h.row === bottom - 2);
    return [move, `${collision ? "COLLISION: game ends" : "SAFE this tick"}; destination column ${col}${blocked ? "; board edge prevents movement" : ""}${approaching ? "; hazard arrives here in two ticks" : ""}`];
  }));
}

/**
 * @param {import('./engine.mjs').GameState} state
 * @param {number} [lookAhead]
 */
export function formatDeciderState(state, lookAhead = 3) {
  const playerRow = state.rows - 1;
  const edgeLeft = state.playerCol === 0;
  const edgeRight = state.playerCol === state.cols - 1;

  const lines = [
    `You are piloting a ${state.cols}-column grid dodger. Hazards fall one row per tick.`,
    `Player column: ${state.playerCol} (valid columns 0-${state.cols - 1}). Bottom row index: ${playerRow}.`,
    `Edges: left=${edgeLeft ? "blocked" : "open"}, right=${edgeRight ? "blocked" : "open"}.`,
    `Score so far: ${state.score}.`,
  ];

  for (let ahead = 1; ahead <= lookAhead; ahead++) {
    const targetRow = playerRow - ahead;
    if (targetRow < 0) {
      lines.push(`In ${ahead} tick(s): off board (no hazards).`);
      continue;
    }
    const cols = state.hazards
      .filter((h) => h.row === targetRow)
      .map((h) => h.col)
      .sort((a, b) => a - b);
    const label =
      ahead === 1
        ? "Immediate danger (next tick lands on player row)"
        : `In ${ahead} tick(s)`;
    lines.push(
      cols.length
        ? `${label}: hazards in columns [${cols.join(", ")}]`
        : `${label}: no hazards`,
    );
  }

  lines.push("Move outcomes for THIS tick among left, stay, right (move first, then hazards fall):");
  for (const [move, outcome] of Object.entries(describeMoveOutcomes(state))) {
    lines.push(`${move}: ${outcome}`);
  }
  lines.push("A COLLISION ends the game immediately. Choose a SAFE move whenever available. Prefer stay only when it is SAFE.");
  return lines.join("\n");
}


/** Observable engine facts, not an explanation of the model's internal reasoning. */
export function decisionContext(state, raw, selection) {
  const outcomes = describeMoveOutcomes(state);
  const safe = MOVES.filter(move => outcomes[move].startsWith("SAFE"));
  const modelChoice = selection.rawChoice || raw.choice;
  const applied = selection.choice;
  const facts = safe.length === 3 ? "All 3 moves are safe this tick" : safe.length === 0 ? "No safe move this tick" : `${safe.length} safe ${safe.length === 1 ? "move" : "moves"}: ${safe.join(", ")}`;
  const actor = raw.source === "mock" ? "Mock" : "Model";
  const action = modelChoice === applied ? `${actor} picked ${modelChoice}` : `${actor} picked ${modelChoice}; policy applied ${applied} (threshold fallback)`;
  return `${action}. Engine check: ${facts}. ${outcomes[applied].startsWith("COLLISION") ? "Applied move leads to a collision." : ""}`.trim();
}
