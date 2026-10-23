# Reproducible Grid Dodger benchmark

Recorded: 2026-10-17T01:14:32.057Z. Threshold: 0.40. 40 fixed snapshots; five fixed spawn seeds; 60-tick episode cap.

| Variant | Avoidable snapshot collisions | Mean survival ticks | Capped / 5 | Median request ms | p95 request ms | Errors |
|---|---:|---:|---:|---:|---:|---:|
| heuristic | 0/31 | 44.8 | 2 | 0.02 | 0.10 | 0 |
| original | 17/31 | 24.2 | 0 | 354.66 | 384.74 | 0 |
| grounded | 0/31 | 51.0 | 4 | 422.06 | 519.09 | 0 |

Latency columns use only the same 40 snapshot cases for each variant; aggregate snapshot-plus-episode timings are also in JSON. Heuristic latency is local computation, not an inference request. Model latency includes HTTP/network overhead. The original prompt is reconstructed from the repo’s pre-fix question. Each variant is evaluated on the same snapshots and spawn seeds, but episode states diverge after different moves. Spawn RNG is seeded; model inference is not. Five episodes are a small exploratory sample; capped runs are censored. No cost or frontier-model speedup claim is supported by this experiment. Raw decisions, token usage, errors, and timings are in report.json.
