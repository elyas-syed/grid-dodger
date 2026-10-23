# Reusable recipe: closed-option tool selection

Submission pattern: **Tool selection**. Intended submission tags: **#strands-decider-2b #tool-selection**.

This reusable pattern is included with the public Grid Dodger source.

## What this recipe does

Convert a typed Decider 2B choice into exactly one registered action. Grid Dodger binds `left`, `stay`, and `right` to the named tools `move_left`, `hold_position`, and `move_right`. Each tool moves at most one column and advances one game tick. Shadow mode performs the same selection without executing the AI action; the human chooses the move.

This is tool selection, rather than request classification or a safety guardrail. Deterministic code computes collision facts. Decider selects the action. The game-specific confidence policy delegates to the generic selector, then the game dispatches the selected tool.

## Typed question and options

The executable question is `buildSystemOneBody(state)` in `src/decider-http.mjs`:

```js
{
  state: '<board, approaching hazards, per-option move outcomes>',
  questions: {
    safest_move: {
      type: 'choice',
      instructions: 'Choose a SAFE move from the explicit move outcomes. Never choose COLLISION if a SAFE move exists. Prefer stay only if stay is SAFE. Avoid board edges that prevent movement and consider hazards arriving in two ticks.',
      criteria: {
        left: 'SAFE this tick; destination column 1',
        stay: 'COLLISION: game ends; destination column 2',
        right: 'SAFE this tick; destination column 3'
      }
    }
  }
}
```

The criteria are generated per board by `describeMoveOutcomes`. They account for both stepping onto a hazard already on the bottom row and hazards falling onto the destination. These are computed facts, not model predictions. Multiple options can be safe; future danger and tie-breaking still affect selection.

## Drop-in wiring

The generic module `src/tool-selection.mjs` has no game or AWS dependencies:

```js
import { runToolRecipe } from './src/tool-selection.mjs';

const result = await runToolRecipe({
  readDecision: async () => ({ choice: 'lookup', choiceProbability: 0.8 }),
  tools: {
    lookup: { execute: () => lookupDocumentation() },
    ask: { execute: () => askForMissingSubject() }
  },
  fallback: 'ask',
  threshold: 0.4
});
```

Replace `readDecision` with the typed Decider request for your own question and options. It must return the chosen option key and that option's probability. Tools execute only after selection; HTTP errors propagate rather than executing a guessed tool. Unknown options cannot dispatch arbitrary functions. A low score selects the caller's declared fallback.

Runnable example, with a second question unrelated to games:

```bash
node examples/tool-selection.mjs
DECIDER_URL=http://127.0.0.1:8000 node examples/tool-selection.mjs --live 'What is our documented refund policy?'
```

The example's tools return demonstration results; connect them to real documentation and clarification tools in your agent. No Strands InterventionHandler is claimed or required: the recipe is wired directly into this agent's execution path.

## Game execution path

1. `formatDeciderState` and `describeMoveOutcomes` build the decision context.
2. `httpDecide` posts the typed question to `/v1/systemone`.
3. `parseSystemOneResponse` preserves the full option distribution, chosen-option probability, and distribution-derived relative certainty (legacy `reliability` field).
4. `applyDecisionPolicy` calls the generic `selectTool`.
5. `executeMoveTool` calls `dispatchToolSelection` on the registered move tools.
6. On collision, voluntary stop, or win, the outcome, score, valid move history, and appropriate collision evidence go to Bedrock for a short recap.

The browser's URL is `/decider`; local serving proxies it to port 8000 and CloudFront forwards it to the GPU service. Never expose AWS credentials to the browser.

## Probability and fallback limitations

`probabilities[choice]` is the model's relative preference among the supplied options. It is **not** a calibrated probability that the move is correct. `confidence` from the model response is retained as `reliability`, a certainty score rescaled from the option distribution (not a separate correctness prediction). The client keeps a legacy `confidence` alias for option probability for compatibility; the expandable HUD details show **Model choice probability** and the full three-option distribution.

Missing option probability is treated as 0, not replaced by reliability. The UI threshold is 0.40. Below it, the game chooses `stay` and records an internal `unsure` flag and shows an explicit threshold fallback when the applied action differs from the model choice. **Staying is not guaranteed safe.** Other agents must select a fallback appropriate to their action's consequences; this is not a safety system.

## Evaluation and honest boundaries

Run `npm run benchmark -- --offline` for the deterministic baseline, or set `DECIDER_URL` and run `npm run benchmark` to compare the reconstructed original prompt, collision-aware prompt, and heuristic. Read `benchmarks/results/REPORT.md` and its raw JSON after a live run.

The heuristic has access to the same collision facts and is a serious baseline. This game does not prove a model is required or better than rules. The reusable contribution is an observable typed decision-to-tool loop, a human shadow mode, and a reproducible account of what improves or fails.

The primary HUD describes the model's selected action and deterministic engine safety facts, labeled separately. It removes the generic unsure badge and sound. Safe-option counts are not model reasoning or predictions about future survival.
