#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createGame, step, MOVES } from "../src/engine.mjs";
import { httpDecide } from "../src/decider-http.mjs";
import { applyDecisionPolicy } from "../src/policy.mjs";
import {
  snapshots,
  heuristic,
  originalBody,
  seededRandom,
  SEEDS,
} from "../benchmarks/grid-dodger.mjs";

const offline = process.argv.includes("--offline");
const url = process.env.DECIDER_URL;
if (!offline && !url)
  throw new Error(
    "Set DECIDER_URL to a live Decider base URL, or use --offline",
  );
const out =
  process.env.BENCHMARK_OUT ||
  (offline ? "benchmarks/results-offline" : "benchmarks/results");
const threshold = 0.4;
const variants = offline
  ? ["heuristic"]
  : ["heuristic", "original", "grounded"];
const report = {
  schemaVersion: 1,
  recordedAt: new Date().toISOString(),
  clientNode: process.version,
  imageDigest: process.env.BENCHMARK_IMAGE_DIGEST || null,
  configuration: {
    threshold,
    seeds: SEEDS,
    maxTicks: 60,
    snapshots: 40,
    variants,
    warmupRequests: offline ? 0 : 1,
    spawnChance: 0.36,
    notes:
      "Single run per fixed case/seed; same spawn RNG per policy, episodes end on collision or 60-tick cap. Heuristic has no model calls. Latency includes network; no frontier-model or monetary cost comparison. Spawn RNG is seeded; model inference is not seeded.",
  },
  snapshots: [],
  episodes: [],
};
async function decide(state, variant) {
  const start = performance.now();
  const raw =
    variant === "heuristic"
      ? heuristic(state)
      : await httpDecide(state, {
          url,
          ...(variant === "original"
            ? {
                fetchImpl: (_url, init) =>
                  fetch(_url, {
                    ...init,
                    body: JSON.stringify(originalBody(state)),
                  }),
              }
            : {}),
        });
  return {
    raw,
    ms: performance.now() - start,
    serverMs: raw.raw?.latency_ms ?? null,
    usage: raw.raw?.usage ?? null,
  };
}
if (!offline) {
  const health = await fetch(`${url.replace(/\/$/, "")}/health`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!health.ok) throw Error(`Health HTTP ${health.status}`);
  report.serverHealth = await health.json();
  await httpDecide(createGame(), { url });
}
for (const fixture of snapshots()) {
  const avoidable = MOVES.some(
    (move) => !step(fixture.state, move, { spawnChance: 0 }).gameOver,
  );
  for (const variant of variants) {
    try {
      const result = await decide(fixture.state, variant);
      const selection = applyDecisionPolicy(result.raw, threshold);
      report.snapshots.push({
        id: fixture.id,
        variant,
        state: fixture.state,
        avoidable,
        rawChoice: result.raw.choice,
        choice: selection.choice,
        choiceProbability:
          result.raw.choiceProbability ?? result.raw.confidence,
        reliability: result.raw.reliability ?? null,
        probabilities:
          result.raw.raw?.answers?.safest_move?.probabilities ?? null,
        unsure: selection.unsure,
        collision: step(fixture.state, selection.choice, { spawnChance: 0 })
          .gameOver,
        ms: result.ms,
        serverMs: result.serverMs,
        usage: result.usage,
      });
    } catch (error) {
      report.snapshots.push({
        id: fixture.id,
        variant,
        avoidable,
        error: String(error),
      });
    }
  }
}
console.log("Snapshot evaluation complete");
for (const seed of SEEDS)
  for (const variant of variants) {
    const rng = seededRandom(seed);
    let state = createGame();
    const decisions = [];
    let error = null;
    while (!state.gameOver && state.tick < 60) {
      try {
        const result = await decide(state, variant);
        const selection = applyDecisionPolicy(result.raw, threshold);
        decisions.push({
          tick: state.tick,
          rawChoice: result.raw.choice,
          choice: selection.choice,
          unsure: selection.unsure,
          ms: result.ms,
          serverMs: result.serverMs,
          usage: result.usage,
        });
        state = step(state, selection.choice, { rng });
      } catch (err) {
        error = String(err);
        break;
      }
    }
    const episode = {
      seed,
      variant,
      ticks: state.tick,
      collision: state.gameOver,
      capped: !state.gameOver && !error,
      error,
      decisions,
    };
    report.episodes.push(episode);
    console.log(
      `${variant} seed=${seed}: ticks=${state.tick} collision=${state.gameOver}${error ? " ERROR" : ""}`,
    );
  }
const quantile = (values, q) => {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.max(0, Math.ceil(q * s.length) - 1)] : null;
};
report.summary = variants.map((variant) => {
  const snaps = report.snapshots.filter((r) => r.variant === variant);
  const successful = snaps.filter((r) => !r.error);
  const avoidable = successful.filter((r) => r.avoidable);
  const episodes = report.episodes.filter((r) => r.variant === variant);
  const samples = [...successful, ...episodes.flatMap((r) => r.decisions)];
  return {
    variant,
    snapshotRequests: snaps.length,
    snapshotErrors: snaps.filter((r) => r.error).length,
    avoidableCases: avoidable.length,
    avoidableCollisions: avoidable.filter((r) => r.collision).length,
    unavoidableCases: successful.filter((r) => !r.avoidable).length,
    episodeErrors: episodes.filter((r) => r.error).length,
    meanSurvivalTicks:
      episodes.reduce((a, b) => a + b.ticks, 0) / episodes.length,
    medianSurvivalTicks: quantile(
      episodes.map((r) => r.ticks),
      0.5,
    ),
    cappedEpisodes: episodes.filter((r) => r.capped).length,
    sampleCount: samples.length,
    snapshotMedianMs: quantile(
      successful.map((r) => r.ms),
      0.5,
    ),
    snapshotP95Ms: quantile(
      successful.map((r) => r.ms),
      0.95,
    ),
    medianMs: quantile(
      samples.map((r) => r.ms),
      0.5,
    ),
    p95Ms: quantile(
      samples.map((r) => r.ms),
      0.95,
    ),
    inputTokens: samples.reduce((a, r) => a + (r.usage?.input_tokens || 0), 0),
    outputTokens: samples.reduce(
      (a, r) => a + (r.usage?.output_tokens || 0),
      0,
    ),
  };
});
await mkdir(out, { recursive: true });
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + "\n");
const lines = [
  "# Reproducible Grid Dodger benchmark",
  "",
  `Recorded: ${report.recordedAt}. Threshold: 0.40. 40 fixed snapshots; five fixed spawn seeds; 60-tick episode cap.`,
  "",
  "| Variant | Avoidable snapshot collisions | Mean survival ticks | Capped / 5 | Median request ms | p95 request ms | Errors |",
  "|---|---:|---:|---:|---:|---:|---:|",
];
for (const r of report.summary)
  lines.push(
    `| ${r.variant} | ${r.avoidableCollisions}/${r.avoidableCases} | ${r.meanSurvivalTicks.toFixed(1)} | ${r.cappedEpisodes} | ${r.snapshotMedianMs.toFixed(2)} | ${r.snapshotP95Ms.toFixed(2)} | ${r.snapshotErrors + r.episodeErrors} |`,
  );
lines.push(
  "",
  "Latency columns use only the same 40 snapshot cases for each variant; aggregate snapshot-plus-episode timings are also in JSON. Heuristic latency is local computation, not an inference request. Model latency includes HTTP/network overhead. The original prompt is reconstructed from the repo’s pre-fix question. Each variant is evaluated on the same snapshots and spawn seeds, but episode states diverge after different moves. Spawn RNG is seeded; model inference is not. Five episodes are a small exploratory sample; capped runs are censored. No cost or frontier-model speedup claim is supported by this experiment. Raw decisions, token usage, errors, and timings are in report.json.",
);
await writeFile(`${out}/REPORT.md`, lines.join("\n") + "\n");
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.some((r) => r.snapshotErrors || r.episodeErrors))
  process.exitCode = 1;
