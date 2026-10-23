import { step } from "./engine.mjs";
import { dispatchToolSelection } from "./tool-selection.mjs";

/** Bind the three model options to actual game actions; each advances exactly one tick. */
export function createMoveTools(state, opts) {
  return {
    left: { name: "move_left", execute: () => step(state, "left", opts) },
    stay: { name: "hold_position", execute: () => step(state, "stay", opts) },
    right: { name: "move_right", execute: () => step(state, "right", opts) },
  };
}

export function executeMoveTool(state, selection, opts) {
  return dispatchToolSelection(selection, createMoveTools(state, opts));
}
