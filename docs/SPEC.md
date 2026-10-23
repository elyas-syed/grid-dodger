# Grid Dodger specification

A browser game demonstrating **tool selection** with Strands Decider 2B. Bedrock narrates run endings and never controls movement. Source remains private; the protected hosted demo permits public play.

## Rules and controls

| Item | Behavior |
|---|---|
| Board | Five columns, ten rows; player on bottom row |
| Actions | left / stay / right; at most one column per tick, clamped at edges |
| Tick | Move first; check step-on collision; advance hazards one row; check falling collision |
| Score | Increments on hazard advances, including a final falling-collision tick; a step-on collision does not increment |
| Goal | Reaching 500 ends the run as a win; goal takes precedence if the same advance also collides |
| Human | Keyboard move is applied at each tick; no AI control |
| Decider | Model selection goes through the probability policy and registered move tool |
| Shadow | Human moves after a model suggestion; AI does not execute the move |
| Keys | Left/right or A/D; Space/down/S stay; R reset; M mute |
| Pause | Suspend the same run; the primary button reads Resume until continued or ended |
| Stop | End a started or paused run; record result and request voluntary-stop recap |
| Restart | Start after an ending creates a new run; mode/source/URL changes reset unfinished runs |

## Scheduling and display

Human/mock automatic ticks use a 480 ms inter-tick delay. HTTP autonomous inference prefetch overlaps an 80 ms gap. Shadow requests the next board's suggestion immediately when that board is known and paints immediately on response. It targets 600 ms from suggestion display to move application, with at least 280 ms remaining when a tick consumes a prefetched response. Network/model time is additional, so this is not a fixed 600 ms wall-clock tick rate. Early keypresses are retained.

The shadow status remains steady. The previous suggestion and metrics stay in the card during pending inference, while the ghost is shown only for a matching current-board tick. Reserved card/metric space prevents routine layout jumps.

“How Decider chose this move” starts open and can be collapsed; long detail content scrolls within its bounded region. Start smoothly focuses a new run; Resume preserves scroll position; reduced-motion preference uses immediate scrolling. The flight deck places mode tabs and run controls horizontally above the centered board. Desktop preserves the original 320px board width (shrinking only to fit its container), content-sized copilot cards and a blended sticky headline; up to 1040px, the copilot panels move below the game. Phone presentation prioritizes readable gameplay and permits manual scrolling.

Human mode replaces absent probabilities with “Model probabilities appear in Decider or Shadow mode.” and hides inapplicable metric fields. A deterministic recap result banner shows the outcome and exact score before narration loads, remains visible if narration fails, and clears on reset. The browser removes recognized leading outcome/score sentences already represented in that banner, preserving subsequent feedback and source attribution.

The main card separates raw model selection, any different threshold-applied action, and engine-checked safe-option facts for the decision board. These facts are not inferred model reasoning. The detail section contains supplied move probabilities, model choice probability, source, and relative certainty; missing values are labeled unavailable. Decision time appears above it. The generic unsure badge and sound are removed; internal fallback accounting remains.

## Difficulty and score history

Difficulty scales hazard density continuously from 100 to 500:

| Score | Level |
|---|---|
| Below 100 | Standard |
| 100–299 | Rising |
| 300–399 | Hard |
| 400–500 | Extreme |

With progress clamped to `(score - 100) / 400`, the primary spawn chance rises from .36 to .96, secondary from .126 to .826, and two additional chances from 0 to .80 and .55. Movement stays one row per tick. New-row hazards use distinct columns and occupy at most four of five columns. Open cells do not guarantee a reachable path across consecutive rows. An explicit engine `spawnChance` override retains the original two-attempt behavior for deterministic fixtures.

Human and Decider each retain their last three completed/stopped scores, newest first, in browser local storage when available. Shadow and unfinished reset runs are excluded. This is local history, not a shared leaderboard.

## Decision contract

| Item | Behavior |
|---|---|
| Model | StrandsAgents/strands-decider-2B-hobson-v19 |
| Question | `safest_move`, type `choice`, options left/stay/right |
| Context | Compact board, deterministic collision outcomes, approaching hazards |
| Wiring | Generic selector → registered move_left / hold_position / move_right tool → one engine tick |
| Probability | Relative preference among options, not correctness/survival probability |
| Relative certainty | Response confidence rescaled from distribution; legacy client field is `reliability` |
| Threshold | .40 default; below threshold or missing probability selects stay; stay can collide |
| Errors | Invalid enum, failed request, or timeout pauses without advancing hazards |
| Cancellation | Old decisions cannot move reset runs; old recaps cannot overwrite new runs |

## Recap and hosting

Both local JS and deployed Python recap implementations accept `collision`, `stopped`, and `won` outcomes with score, pilot mode, whitelisted move history, and optional validated collision evidence. Stop/win discard collision evidence and prepend an exact outcome/score opening. The prompt requests under 80 words of generated narration; the fixed opening is additional. The current source prompt reports scores in points and actions as moves; it identifies recent move history as a sample rather than a full run. Generated text containing internal tick terminology is rejected. This wording update was deployed and verified against live Bedrock on 2026-10-17. Known unsupported mechanics or excessive generated length produce an explicitly labeled offline fallback. Screening does not guarantee factual correctness of every sentence.

Hosting: S3/CloudFront UI, ALB/ECS EC2 g4dn CUDA inference, API Gateway/Lambda/Bedrock recaps, CodeBuild/private ECR image build, digest-pinned task. CloudFront origin restrictions and secret headers protect origins; WAF and API throttles limit requests without player sign-in or a spending cap.

The experiment does not establish model superiority over a heuristic. Recorded benchmark episodes stop at 60 ticks, before the difficulty ramp. Publication, repository visibility changes, extra movement mechanics, guaranteed survival, and video production are outside current scope.

Estimated infrastructure costs and assumptions are in [COSTS.md](COSTS.md). Local working notes belong in the Git-ignored docs-local/ directory.
