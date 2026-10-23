import { MOVES } from "./engine.mjs";
import { selectTool } from "./tool-selection.mjs";

/**
 * @typedef {{ choice: "left"|"stay"|"right", confidence: number, rawChoice?: string, unsure?: boolean }} Decision
 */

/**
 * @param {{ choice: string, confidence: number }} raw
 * @param {number} threshold
 * @returns {Decision}
 */
export function applyDecisionPolicy(raw, threshold = 0.4) {
  return selectTool(raw, { options: MOVES, fallback: "stay", threshold });
}
