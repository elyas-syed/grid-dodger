# Grid Dodger evaluation

Run the deterministic baseline without AWS or model weights:

```bash
npm run benchmark -- --offline
```

For the comparison, use a running Decider endpoint with `/v1/systemone` and `/health`:

```bash
DECIDER_URL=https://YOUR_DOMAIN/decider \
BENCHMARK_IMAGE_DIGEST=sha256:YOUR_DIGEST \
npm run benchmark
```

The script runs serially: one warmup, 40 fixed snapshots per variant, then five fixed spawn seeds capped at 60 ticks per variant. Variants are a deterministic collision-aware heuristic, the reconstructed original prompt, and the current grounded prompt. Threshold is 0.40 for model decisions. The heuristic has score 1 and executes directly.

Snapshot comparisons share identical board inputs, including nine unavoidable boards. The same seeded spawn RNG is restarted for each episode/controller, but action-dependent trajectories diverge. Model inference itself is not seeded. Latency columns use the same 40 snapshot requests per variant; JSON additionally records aggregate timings, token counts, request errors, raw choices, selected moves, and episode traces. No model calls are made for the heuristic.

Outputs:

- `results/REPORT.md`: live comparison summary.
- `results/report.json`: raw live measurements and server health metadata.
- `results-offline/`: deterministic baseline-only run; not evidence of model performance.
- `built-requirements.txt`: `package==version` entries captured from the clean CodeBuild container. This is an environment fingerprint, **not** a portable pip lockfile; CUDA packages and base-image dependencies need the Dockerfile's installation context. Some base-image direct-reference packages may not appear in this filtered fingerprint.

Five episodes are an exploratory sample. A 60-tick cap censors longer survival, and these cases are not representative of all games. The study does not demonstrate monetary savings or superiority over a frontier model. Do not omit a heuristic win or a model failure from the article.


The game ramps hazard density from score 100, with Hard at 300 and Extreme at 400. The recorded 60-tick episodes do not reach that ramp and do not measure current endgame difficulty. Later deterministic difficulty simulations are documented separately in [the validation record](../docs/VALIDATION.md); they are not additional live model benchmark results.
