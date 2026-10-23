/** Deterministic collision evidence for the narrator; not an inferred explanation. */
export function collisionFacts(before, move, after) {
  if (!after.gameOver) return null;
  return {
    stage: after.tick === before.tick ? "step-on" : "falling",
    move,
    playerCol: after.playerCol,
    playerRow: after.rows - 1,
  };
}
