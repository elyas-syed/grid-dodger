import { describeMoveOutcomes, formatDeciderState } from "./state-formatter.mjs";
import { MOVES } from "./engine.mjs";

/** Default same-origin proxy path (see scripts/dev_server.mjs). */
export const DEFAULT_DECIDER_PROXY = "/decider";

/**
 * Build the /v1/systemone request body for Grid Dodger.
 * @param {import('./engine.mjs').GameState} state
 */
export function buildSystemOneBody(state) {
  return {
    state: formatDeciderState(state),
    questions: {
      safest_move: {
        type: "choice",
        instructions:
          "Choose a SAFE move from the explicit move outcomes. Never choose COLLISION if a SAFE move exists. Prefer stay only if stay is SAFE. Avoid board edges that prevent movement and consider hazards arriving in two ticks.",
        criteria: describeMoveOutcomes(state),
      },
    },
  };
}

/**
 * Parse a strands-decider /v1/systemone JSON response into a Decision-like object.
 * @param {any} json
 * @param {number} decide_ms
 */
export function parseSystemOneResponse(json, decide_ms = 0) {
  const answer =
    json?.answers?.safest_move ||
    json?.answers?.choice_0 ||
    Object.values(json?.answers || {})[0] ||
    {};

  if (!MOVES.includes(String(answer.choice || answer.prediction || "").toLowerCase().trim())) {
    throw new Error("Decider returned no valid left/stay/right choice");
  }

  let choice = answer.choice || answer.prediction || "stay";
  choice = String(choice).toLowerCase().trim();

  // Option mass (how strongly it preferred this move) — better for game policy.
  // Model-reported reliability is often low on this novel grid domain and would
  // force stay almost every tick if used as the policy score.
  const reliability =
    typeof answer.confidence === "number" ? answer.confidence : null;
  let confidence = NaN;
  if (answer.probabilities && typeof answer.probabilities === "object") {
    const p = answer.probabilities[choice] ?? answer.probabilities[answer.choice];
    if (typeof p === "number") confidence = p;
  }
  if (!Number.isFinite(confidence) && typeof answer.probability === "number") {
    confidence = answer.probability;
  }
  // Reliability is a different signal. Missing option probability triggers fallback.
  if (!Number.isFinite(confidence)) confidence = 0;

  const fromClient = typeof decide_ms === "number" && decide_ms > 0 ? decide_ms : null;
  const fromServer =
    typeof json?.latency_ms === "number" ? Math.round(json.latency_ms) : null;

  return {
    choice,
    confidence,
    choiceProbability: confidence,
    probabilities: answer.probabilities || null,
    reliability,
    source: "http",
    decide_ms: fromClient ?? fromServer ?? 0,
    model: json?.model || null,
    raw: json,
  };
}

/**
 * Call a local or hosted strands-decider HTTP API.
 *
 * Prefer the same-origin proxy (`/decider`) from the browser to avoid CORS.
 * Direct `http://127.0.0.1:8000` only works if the Decider server allows CORS.
 *
 * @param {import('./engine.mjs').GameState} state
 * @param {{ url?: string, fetchImpl?: typeof fetch, signal?: AbortSignal }} [opts]
 */
export async function httpDecide(state, opts = {}) {
  const base = (opts.url || DEFAULT_DECIDER_PROXY).replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl || fetch;
  const body = buildSystemOneBody(state);

  const started = Date.now();
  const res = await fetchImpl(`${base}/v1/systemone`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const detail = /^\s*</.test(text) ? "" : text.slice(0, 180);
    throw new Error(`Decider HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const json = await res.json();
  return parseSystemOneResponse(json, Date.now() - started);
}
