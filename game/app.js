import { createGame, clampMove, step, getDifficulty } from "../src/engine.mjs";
import { mockDecide } from "../src/decider-mock.mjs";
import { DEFAULT_DECIDER_PROXY, httpDecide } from "../src/decider-http.mjs";
import { applyDecisionPolicy } from "../src/policy.mjs";
import { executeMoveTool } from "../src/move-tools.mjs";
import { decisionContext } from "../src/state-formatter.mjs";
import { collisionFacts } from "../src/run-summary.mjs";
import {
  blitInCell,
  drawBoardBackdrop,
  drawCellGlow,
  drawShadowGhost,
  getSprites,
  hazardStyle,
  loadSprites,
} from "./sprites.mjs";
import {
  loadAudioSamples,
  pauseBgm,
  setMuted,
  sfx,
  startBgm,
  stopBgm,
  unlockAudio,
} from "./audio.mjs";

const embeddedArcade = document.documentElement?.dataset.arcadeEmbed === "true";
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const elScore = document.getElementById("score");
const elStatus = document.getElementById("status");
const elMove = document.getElementById("move-label");
const elConf = document.getElementById("conf-label");
const elConfFill = document.getElementById("conf-fill");
const elContext = document.getElementById("decision-context");
const elDistribution = document.getElementById("option-probabilities");
const elDifficulty = document.getElementById("difficulty");
const elMeta = document.getElementById("decision-meta");
const elMode = document.getElementById("mode");
const elSource = document.getElementById("decider-source");
const elThreshold = document.getElementById("threshold");
const elDeciderUrl = document.getElementById("decider-url");
const elDecisionLog = document.getElementById("decision-log");
const elLatency = document.getElementById("latency");
const btnStart = document.getElementById("btn-start");
const startLabel = document.getElementById("start-label");
const modelMetrics = document.getElementById("model-metrics");
const recapResult = document.getElementById("recap-result");
const recapOutcome = document.getElementById("recap-outcome");
const recapScore = document.getElementById("recap-score");
const btnStop = document.getElementById("btn-stop");
const elRecentScores = document.getElementById("recent-scores");
const btnPause = document.getElementById("btn-pause");
const btnRecap = document.getElementById("btn-recap");
const elMute = document.getElementById("mute");
const recapBox = document.querySelector(".recap-box");
const recapText = document.getElementById("recap-text");
const elShadowCue = document.getElementById("shadow-cue");
const elActionCaption = document.getElementById("action-caption");
const elProgress = document.getElementById("goal-progress");
const elSourceLabel = document.getElementById("source-label");
const elModeHelp = document.getElementById("mode-help");
const modeButtons = ["human", "decider", "shadow"].map((mode) => ({
  mode,
  button: document.getElementById(`mode-${mode}`),
}));
const moveButtons = ["left", "stay", "right"].map((move) => ({
  move,
  button: document.getElementById(`move-${move}`),
}));
const RECAP_PLACEHOLDER =
  "Your story lands here. Stop, win, or finish a run for a recap with your score.";
const sprites = getSprites();

/** Base delay between ticks once the previous tick finished (human / mock). */
const TICK_MS = 480;
/**
 * Extra pause after an HTTP Decider move for readability.
 * Inference overlaps this pause through prefetch.
 */
const DECIDER_GAP_MS = 80;
/** Shadow: how long the yellow tip stays up before your key locks in. */
const SHADOW_REACT_MS = 600;
/** Minimum remaining react time once a tick starts (even if tip arrived early). */
const SHADOW_REACT_MIN_MS = 280;
const CELL = 56;
const PAD = 20;
const LOG_MAX = 40;
const LATENCY_WINDOW = 30;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneState(s) {
  return {
    ...s,
    hazards: s.hazards.map((h) => ({ col: h.col, row: h.row })),
  };
}

const WIN_SCORE = 500;
const SCORE_KEY = "grid-dodger-recent-scores-v1";
let recentScores;
try {
  recentScores = JSON.parse(localStorage.getItem(SCORE_KEY)) || {};
} catch {
  recentScores = {};
}
if (
  !recentScores ||
  typeof recentScores !== "object" ||
  Array.isArray(recentScores)
)
  recentScores = {};
let outcome = null;
let recapController = null;
let state = createGame();
let running = false;
let everStarted = false;
let timer = null;
let tickInFlight = false;
let suggestSeq = 0;
let pendingHuman = "stay";
let history = [];
let lastCollision = null;
let decisionLog = [];
let unsureCount = 0;
let lastDecision = null;
/** When set, renderHud keeps this status text (shadow suggest/react phases). */
let statusHold = null;
/** Prefetched Decider result for the current board tick (hides HTTP latency). */
let shadowPrefetch = null;
/** Prefetch for Mode=decider: start next decide while the board shows the last move. */
let deciderPrefetch = null;
/** When the current shadow tip was painted (for early display + react timing). */
let shadowTipAt = 0;
let shadowTipTick = -1;
/** Recent HTTP/mock decide_ms samples for avg latency HUD. */
let latencySamples = [];
let recapInFlight = false;
let runId = 0;
let decisionController = new AbortController();

function advanceRun(move, selection) {
  const before = state;
  state = selection ? executeMoveTool(before, selection) : step(before, move);
  lastCollision = collisionFacts(before, move, state);
}

function readThreshold() {
  const n = Number(elThreshold.value);
  return elThreshold.value.trim() !== "" && Number.isFinite(n)
    ? Math.max(0, Math.min(1, n))
    : 0.4;
}

function cellSize() {
  return Math.min(
    CELL,
    Math.floor((canvas.width - PAD * 2) / state.cols),
    Math.floor((canvas.height - PAD * 2) / state.rows),
  );
}

function suggestTargetCol(fromCol, suggestion) {
  return clampMove({ ...state, playerCol: fromCol }, suggestion || "stay");
}

function draw() {
  const s = cellSize();
  drawBoardBackdrop(
    ctx,
    canvas.width,
    canvas.height,
    state.tick,
    sprites.bgTile,
  );

  const ox = (canvas.width - state.cols * s) / 2;
  const oy = (canvas.height - state.rows * s) / 2;

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const x = ox + c * s;
      const y = oy + r * s;
      ctx.fillStyle =
        r === state.rows - 1
          ? "rgba(46, 90, 72, 0.18)"
          : "rgba(20, 28, 38, 0.35)";
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = "#2a3848";
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
    }
  }

  for (const h of state.hazards) {
    const x = ox + h.col * s;
    const y = oy + h.row * s;
    const style = hazardStyle(h, sprites);
    drawCellGlow(ctx, x, y, s, style.glow, 0.2);
    blitInCell(ctx, style.sprite, x, y, s, style.pad, style.rotate);
  }

  const pr = state.rows - 1;
  const px = ox + state.playerCol * s;
  const py = oy + pr * s;
  drawCellGlow(ctx, px, py, s, "#3ecf8e", 0.32);
  blitInCell(ctx, sprites.player, px, py, s, 0.08);

  // Yellow ghost = Decider's suggested cell for the *next* human move (shadow mode)
  if (
    shadowTipTick === state.tick &&
    lastDecision?.mode === "shadow" &&
    lastDecision.shadowSuggestion
  ) {
    const col =
      typeof lastDecision.suggestCol === "number"
        ? lastDecision.suggestCol
        : suggestTargetCol(state.playerCol, lastDecision.shadowSuggestion);
    drawShadowGhost(
      ctx,
      ox + col * s,
      oy + pr * s,
      s,
      lastDecision.shadowSuggestion === "stay",
    );
  }

  if (state.gameOver || outcome) {
    ctx.fillStyle = "rgba(8, 12, 18, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e8eef4";
    ctx.font = "600 22px IBM Plex Sans, Segoe UI, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      outcome === "won"
        ? "YOU WIN!"
        : outcome === "stopped"
          ? "STOPPED"
          : "GAME OVER",
      canvas.width / 2,
      canvas.height / 2 - 8,
    );
    ctx.font = "400 14px IBM Plex Sans, Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "#9aabbc";
    ctx.fillText(
      `Score ${state.score} · R or Start to retry`,
      canvas.width / 2,
      canvas.height / 2 + 18,
    );
    ctx.textAlign = "start";
  }
}

function renderDecisionHud() {
  const human = elMode.value === "human";
  modelMetrics.hidden = human;
  if (human) {
    elMove.textContent = lastDecision?.move || "—";
    elContext.textContent = "Human controls the move";
    elDistribution.textContent =
      "Model probabilities appear in Decider or Shadow mode.";
    elConf.textContent = "—";
    elConfFill.style.width = "0%";
    elMeta.textContent = "—";
    return;
  }
  if (!lastDecision || lastDecision.error) {
    elMove.textContent = lastDecision?.error ? "error" : "—";
    elConf.textContent = "—";
    elConfFill.style.width = "0%";
    elConfFill.classList.remove("low");
    elContext.textContent = lastDecision?.error || "Waiting for a decision";
    elDistribution.textContent = lastDecision?.error
      ? "Move probabilities unavailable"
      : "Move probabilities appear after the first decision.";
    elMeta.textContent = lastDecision?.error || "—";
    return;
  }

  if (lastDecision.mode === "shadow" && lastDecision.shadowSuggestion) {
    elMove.textContent = `suggest ${lastDecision.shadowSuggestion}`;
  } else {
    elMove.textContent =
      lastDecision.move ||
      lastDecision.choice ||
      lastDecision.shadowSuggestion ||
      "—";
  }

  const hasConf = typeof lastDecision.confidence === "number";
  if (hasConf) {
    const pct = Math.round(lastDecision.confidence * 100);
    elConf.textContent = `${pct}%`;
    elConfFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    elConfFill.classList.remove("low");
  } else {
    elConf.textContent = "—";
    elConfFill.style.width = "0%";
    elConfFill.classList.remove("low");
  }

  elContext.textContent = lastDecision.context || "Human controls the move";
  const moves = ["left", "stay", "right"];
  const hasProbabilities = moves.some(
    (move) =>
      typeof lastDecision.probabilities?.[move] === "number" &&
      Number.isFinite(lastDecision.probabilities[move]),
  );
  elDistribution.textContent = hasProbabilities
    ? "Move probabilities · " +
      moves
        .map((move) => {
          const p = lastDecision.probabilities?.[move];
          return `${move}: ${typeof p === "number" && Number.isFinite(p) ? `${(p * 100).toFixed(1)}%` : "unavailable"}`;
        })
        .join(" · ")
    : "Move probabilities unavailable";

  const bits = [];
  if (lastDecision.mode) bits.push(lastDecision.mode);
  if (lastDecision.source) bits.push(lastDecision.source);
  if (typeof lastDecision.decide_ms === "number")
    bits.push(`${lastDecision.decide_ms} ms`);
  if (typeof lastDecision.reliability === "number") {
    bits.push(`relative certainty ${lastDecision.reliability.toFixed(2)}`);
  }
  elMeta.textContent = bits.join(" · ") || "—";
}

function noteLatency(ms) {
  if (typeof ms !== "number" || ms < 0) return;
  latencySamples.push(ms);
  if (latencySamples.length > LATENCY_WINDOW) latencySamples.shift();
}

function renderLatency() {
  if (!latencySamples.length) {
    elLatency.textContent = "—";
    return;
  }
  const last = latencySamples[latencySamples.length - 1];
  const avg = Math.round(
    latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length,
  );
  elLatency.textContent = `last ${last} ms · avg ${avg} ms (n=${latencySamples.length})`;
}

function renderHud() {
  startLabel.textContent =
    !running && everStarted && !outcome ? "Resume" : "Start";
  recapResult.hidden = !outcome;
  recapOutcome.textContent = outcome
    ? { stopped: "You stopped", won: "You win!", collision: "Game over" }[
        outcome
      ]
    : "";
  recapScore.textContent = outcome ? String(state.score) : "";
  elScore.textContent = String(state.score);
  elProgress.value = Math.min(WIN_SCORE, state.score);
  elSourceLabel.textContent =
    elMode.value === "human"
      ? "Human control"
      : elSource.value === "mock"
        ? "Offline mock"
        : "HTTP model";
  elActionCaption.textContent =
    elMode.value === "human"
      ? "YOUR LAST MOVE"
      : elMode.value === "shadow"
        ? "NEXT SUGGESTION"
        : "APPLIED MOVE";
  elShadowCue.textContent =
    elMode.value === "shadow"
      ? shadowTipTick === state.tick && lastDecision?.shadowSuggestion
        ? `SUGGEST ${lastDecision.shadowSuggestion.toUpperCase()}`
        : "NEXT HINT INCOMING"
      : elMode.value === "human"
        ? "YOU’RE IN CONTROL"
        : "DECIDER AT THE HELM";
  elShadowCue.classList.toggle("shadow-active", elMode.value === "shadow");
  elModeHelp.textContent = {
    human:
      "Your ship. Your decisions. Dodge with the arrows or controls below.",
    decider:
      "Hands off. Decider picks the moves; watch its choices in the copilot panel.",
    shadow:
      "Follow the yellow target or choose your own path. You have the final say.",
  }[elMode.value];
  for (const { mode, button } of modeButtons)
    button.setAttribute("aria-pressed", String(elMode.value === mode));
  for (const { button } of moveButtons)
    button.disabled =
      !running || Boolean(outcome) || elMode.value === "decider";
  elDifficulty.textContent = getDifficulty(state.score).label;
  if (outcome)
    elStatus.textContent =
      outcome === "won"
        ? "you win!"
        : outcome === "stopped"
          ? "stopped"
          : "game over";
  else if (running && elMode.value === "shadow")
    elStatus.textContent = "shadow · follow the yellow target";
  else if (statusHold) elStatus.textContent = statusHold;
  else if (running && tickInFlight && elMode.value === "decider") {
    elStatus.textContent = "deciding…";
  } else if (running) elStatus.textContent = "running";
  else if (everStarted) elStatus.textContent = "paused";
  else elStatus.textContent = "ready";
  renderDecisionHud();
  renderLatency();
  btnRecap.disabled = !outcome || recapInFlight;
  btnStop.disabled = !everStarted || Boolean(outcome);
}

function appendDecisionLog(entry) {
  decisionLog.unshift(entry);
  if (decisionLog.length > LOG_MAX) decisionLog.length = LOG_MAX;
  elDecisionLog.textContent = decisionLog.join("\n");
}

function logFromDecision(move, decidedLike) {
  if (!decidedLike || decidedLike.error) {
    appendDecisionLog(
      `t=${state.tick} ERROR ${decidedLike?.error || "unknown"} → paused`,
    );
    return;
  }
  const conf =
    typeof decidedLike.confidence === "number"
      ? decidedLike.confidence.toFixed(2)
      : "-";
  const ms =
    typeof decidedLike.decide_ms === "number"
      ? `${decidedLike.decide_ms}ms`
      : "";
  const fallback = decidedLike.unsure ? " threshold-fallback" : "";
  const model = decidedLike.rawChoice ? ` model=${decidedLike.rawChoice}` : "";
  const suggest = decidedLike.shadowSuggestion
    ? ` suggest=${decidedLike.shadowSuggestion}`
    : "";
  appendDecisionLog(
    `t=${state.tick} ${decidedLike.source || "?"} ${move}${model} option_p=${conf}${fallback}${suggest} ${ms}`.trim(),
  );
}

async function getRawDecision(forState = state) {
  if (elSource.value === "http") {
    const url = (elDeciderUrl.value || DEFAULT_DECIDER_PROXY).trim();
    return httpDecide(forState, { url, signal: decisionController.signal });
  }
  const raw = mockDecide(forState);
  return { ...raw, decide_ms: 0 };
}

function startDeciderPrefetch(forState) {
  if (elMode.value !== "decider" || elSource.value !== "http") {
    deciderPrefetch = null;
    return null;
  }
  const snap = cloneState(forState);
  const tickId = snap.tick;
  const promise = getRawDecision(snap).catch((err) => ({
    choice: "stay",
    confidence: 0,
    source: "error",
    decide_ms: 0,
    error: String(err.message || err),
  }));
  deciderPrefetch = { tickId, promise };
  return deciderPrefetch;
}

async function takeDeciderDecision(forState) {
  const pref = deciderPrefetch;
  if (pref && pref.tickId === forState.tick) {
    deciderPrefetch = null;
    return pref.promise;
  }
  deciderPrefetch = null;
  return getRawDecision(forState);
}

function paintShadowTip(raw, forState, threshold) {
  if (raw?.error) {
    lastDecision = {
      mode: "shadow",
      move: lastDecision?.move || "—",
      error: raw.error,
    };
  } else {
    const decided = applyDecisionPolicy(
      raw.choice != null ? raw : { choice: "stay", confidence: 0 },
      threshold,
    );
    lastDecision = {
      mode: "shadow",
      move: "—",
      shadowSuggestion: decided.choice,
      rawChoice: decided.rawChoice,
      context: decisionContext(forState, raw, decided),
      probabilities: raw.probabilities,
      suggestCol: suggestTargetCol(forState.playerCol, decided.choice),
      confidence: decided.confidence,
      reliability: raw.reliability,
      unsure: decided.unsure,
      source: raw.source || "mock",
      decide_ms: raw.decide_ms || 0,
    };
  }
  noteLatency(raw.decide_ms || 0);
  shadowTipAt = Date.now();
  shadowTipTick = forState.tick;
  statusHold = raw?.error ? "suggestion unavailable" : "your move";
  sfx.tip();
  draw();
  renderHud();
}

function startShadowPrefetch(forState) {
  const snap = cloneState(forState);
  const tickId = snap.tick;
  const threshold = readThreshold();
  const promise = getRawDecision(snap).catch((err) => ({
    choice: "stay",
    confidence: 0,
    source: "error",
    decide_ms: 0,
    error: String(err.message || err),
  }));
  const pref = { tickId, promise, painted: false };
  shadowPrefetch = pref;
  // Paint tip as soon as Decider answers — often before the next tick starts
  promise.then((raw) => {
    if (!running || elMode.value !== "shadow") return;
    if (shadowPrefetch !== pref || pref.tickId !== state.tick) return;
    if (pref.painted) return;
    pref.painted = true;
    paintShadowTip(raw, snap, threshold);
  });
  return pref;
}

/**
 * Shadow: paint the tip immediately, leave time to react, then lock the human move.
 */
async function shadowTick(threshold) {
  const seq = ++suggestSeq;
  statusHold = "your move";
  renderHud();

  let pref =
    shadowPrefetch && shadowPrefetch.tickId === state.tick
      ? shadowPrefetch
      : startShadowPrefetch(state);

  const raw = await pref.promise;
  if (!running || seq !== suggestSeq) return 0;
  if (raw.error) throw new Error(raw.error);

  if (!pref.painted || shadowTipTick !== state.tick) {
    pref.painted = true;
    paintShadowTip(raw, state, threshold);
  }

  const elapsed = Date.now() - shadowTipAt;
  const wait = Math.max(SHADOW_REACT_MIN_MS, SHADOW_REACT_MS - elapsed);
  await sleep(wait);
  if (!running || seq !== suggestSeq) return raw.decide_ms || 0;

  const move = pendingHuman;
  pendingHuman = "stay";
  lastDecision = { ...lastDecision, mode: "shadow", move };
  logFromDecision(move, lastDecision);
  history.push(move);
  sfx.move(move);

  advanceRun(move);
  shadowTipTick = -1;
  // Kick next tip immediately so it can appear early on the new board
  if (!state.gameOver && state.score < WIN_SCORE) startShadowPrefetch(state);
  return raw.decide_ms || 0;
}

async function tick() {
  if (!running || state.gameOver || outcome || tickInFlight) return;
  tickInFlight = true;
  const activeRun = runId;
  renderHud();

  const mode = elMode.value;
  const threshold = readThreshold();
  let move = "stay";
  let decideMs = 0;

  try {
    if (mode === "human") {
      move = pendingHuman;
      pendingHuman = "stay";
      lastDecision = { mode, move, source: "human" };
      logFromDecision(move, lastDecision);
      history.push(move);
      sfx.move(move);
      advanceRun(move);
    } else if (mode === "shadow") {
      decideMs = await shadowTick(threshold);
      if (!running || activeRun !== runId) return decideMs;
    } else {
      // decider: one move per tick (left|stay|right), then hazards fall one row
      elStatus.textContent = "deciding…";
      const raw = await takeDeciderDecision(state);
      decideMs = raw.decide_ms || 0;
      if (!running || activeRun !== runId) return;
      if (raw.error) throw new Error(raw.error);
      const decided = applyDecisionPolicy(raw, threshold);
      move = decided.choice;
      lastDecision = {
        mode,
        move,
        ...decided,
        context: decisionContext(state, raw, decided),
        probabilities: raw.probabilities,
        reliability: raw.reliability,
        source: raw.source,
        decide_ms: raw.decide_ms,
      };
      if (decided.unsure) {
        unsureCount += 1;
        sfx.move(move);
      } else {
        sfx.move(move);
      }
      noteLatency(decideMs);
      logFromDecision(move, lastDecision);
      history.push(move);
      advanceRun(move, decided);
      // Kick off next HTTP decide while the board shows this result (overlaps gap).
      if (running && !state.gameOver && state.score < WIN_SCORE)
        startDeciderPrefetch(state);
    }

    draw();
    renderHud();

    if (state.score >= WIN_SCORE) finishRun("won");
    else if (state.gameOver) finishRun("collision");

    return decideMs;
  } catch (err) {
    if (!running || activeRun !== runId) return;
    lastDecision = { error: String(err.message || err) };
    logFromDecision("stay", lastDecision);
    stopLoop();
    draw();
    renderHud();
    elStatus.textContent =
      "Decider unavailable — paused. Check URL or retry Start.";
    return 0;
  } finally {
    if (activeRun === runId) tickInFlight = false;
  }
}

function renderRecentScores() {
  elRecentScores.textContent = ["human", "decider"]
    .map((mode) => {
      const scores = Array.isArray(recentScores[mode])
        ? recentScores[mode]
            .filter((n) => Number.isInteger(n) && n >= 0)
            .slice(0, 3)
        : [];
      return `${mode === "human" ? "Human" : "Decider"}: ${scores.length ? scores.join(" · ") : "No runs yet"}`;
    })
    .join("\n");
}

function finishRun(reason) {
  if (outcome || !everStarted) return;
  outcome = reason;
  if (reason !== "collision") lastCollision = null;
  stopLoop();
  stopBgm();
  if (reason === "collision") sfx.gameOver();
  const mode = elMode.value;
  if (mode === "human" || mode === "decider") {
    const previous = Array.isArray(recentScores[mode])
      ? recentScores[mode].filter((n) => Number.isInteger(n) && n >= 0)
      : [];
    recentScores[mode] = [state.score, ...previous].slice(0, 3);
    try {
      localStorage.setItem(SCORE_KEY, JSON.stringify(recentScores));
    } catch {
      /* Storage may be disabled. */
    }
  }
  renderRecentScores();
  draw();
  renderHud();
  requestRecap();
}

// The result banner already presents these exact facts; keep the narration focused on feedback.
function recapNarration(text) {
  let narration = String(text || "").trim();
  const score = state.score;
  const prefixes =
    outcome === "stopped"
      ? ["You stopped the run.", `Your score: ${score}.`]
      : outcome === "won"
        ? ["You win!", `You reached ${score} points.`]
        : [
            `Survived ${score} ticks on your own (${history.length} moves logged).`,
            `Survived ${score} ticks.`,
          ];
  let prefix;
  while (
    (prefix = prefixes.find((p) =>
      narration.toLowerCase().startsWith(p.toLowerCase()),
    ))
  ) {
    narration = narration.slice(prefix.length).trimStart();
  }
  return narration || "No additional feedback supplied.";
}

async function requestRecap() {
  if (recapInFlight || !outcome) return;
  const recapRun = runId;
  const controller = new AbortController();
  recapController = controller;
  recapInFlight = true;
  btnRecap.disabled = true;
  recapBox.hidden = false;
  recapText.textContent = "Fetching Bedrock recap…";
  if (!embeddedArcade) recapBox.scrollIntoView({ block: "nearest" });

  try {
    const res = await fetch("/api/recap", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        score: state.score,
        history,
        unsureCount,
        mode: elMode.value,
        gameOver: outcome === "collision",
        outcome,
        collision: lastCollision,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
      );
    }
    const data = await res.json();
    if (recapRun !== runId || controller.signal.aborted) return;
    const footer =
      data.source === "bedrock"
        ? `\n\n— Bedrock (${data.modelId || "model"})`
        : `\n\n— Offline recap${data.reason ? ` (${data.reason})` : ""}.`;
    recapText.textContent = `${recapNarration(data.text)}${footer}`;
    sfx.recap();
  } catch (err) {
    if (recapRun !== runId || controller.signal.aborted) return;
    const hint =
      location.protocol === "file:"
        ? " Open via http://127.0.0.1:8080/game/ (npm run serve), not a file:// page."
        : " Is npm run serve running?";
    recapText.textContent = `Recap failed: ${err.message || err}.${hint}`;
  } finally {
    if (recapRun === runId && recapController === controller) {
      recapInFlight = false;
      renderHud();
    }
  }
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function scheduleNext() {
  clearTimer();
  if (!running || state.gameOver || outcome) return;
  // Shadow already waited SHADOW_REACT_MS inside the tick — short gap only.
  // Decider+HTTP prefetch overlaps the short gap.
  const scheduledRun = runId;
  const shadow = elMode.value === "shadow";
  const httpDecider = elSource.value === "http" && elMode.value === "decider";
  const delay = shadow ? 80 : httpDecider ? DECIDER_GAP_MS : TICK_MS;
  timer = setTimeout(() => {
    tick()
      .then(() => {
        if (scheduledRun === runId) scheduleNext();
      })
      .catch((e) => {
        console.error(e);
        elStatus.textContent = "error";
        scheduleNext();
      });
  }, delay);
}

function startLoop() {
  if (running || outcome) return;
  unlockAudio();
  clearTimer();
  running = true;
  everStarted = true;
  const startedRun = runId;
  btnStart.disabled = true;
  btnPause.disabled = false;
  sfx.start();
  startBgm();
  if (elMode.value === "shadow") startShadowPrefetch(state);
  renderHud();
  // Fire first tick immediately
  tick()
    .then(() => {
      if (startedRun === runId) scheduleNext();
    })
    .catch((e) => {
      console.error(e);
      elStatus.textContent = "error";
    });
}

function stopLoop() {
  running = false;
  runId += 1;
  suggestSeq += 1;
  decisionController.abort();
  decisionController = new AbortController();
  shadowPrefetch = null;
  deciderPrefetch = null;
  clearTimer();
  tickInFlight = false;
  statusHold = null;
  pauseBgm();
  btnStart.disabled = false;
  btnPause.disabled = true;
  renderHud();
}

function reset() {
  recapController?.abort();
  recapController = null;
  stopLoop();
  outcome = null;
  stopBgm();
  everStarted = false;
  tickInFlight = false;
  statusHold = null;
  shadowPrefetch = null;
  deciderPrefetch = null;
  shadowTipAt = 0;
  shadowTipTick = -1;
  suggestSeq += 1;
  state = createGame();
  history = [];
  lastCollision = null;
  decisionLog = [];
  latencySamples = [];
  unsureCount = 0;
  lastDecision = null;
  pendingHuman = "stay";
  recapBox.hidden = false;
  recapText.textContent = RECAP_PLACEHOLDER;
  recapInFlight = false;
  elDecisionLog.textContent = "—";
  draw();
  renderHud();
}

for (const { mode, button } of modeButtons) {
  button.addEventListener("click", () => {
    if (elMode.value === mode) return;
    elMode.value = mode;
    reset();
  });
}
for (const { move, button } of moveButtons) {
  button.addEventListener("click", () => {
    if (running && !outcome && elMode.value !== "decider") pendingHuman = move;
  });
}

btnStart.addEventListener("click", () => {
  const startingNewRun = !everStarted || Boolean(outcome) || state.gameOver;
  unlockAudio();
  if (outcome || state.gameOver) reset();
  startLoop();
  if (startingNewRun && !embeddedArcade)
    document.getElementById("flight-deck").scrollIntoView({
      block: "start",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
});
btnPause.addEventListener("click", () => stopLoop());
btnStop.addEventListener("click", () => finishRun("stopped"));
for (const control of [elMode, elSource, elDeciderUrl]) {
  control.addEventListener("change", () => reset());
}
elThreshold.addEventListener("change", () => {
  if (outcome) return;
  stopLoop();
  lastDecision = null;
  shadowTipTick = -1;
  draw();
  renderHud();
});
btnRecap.addEventListener("click", () => {
  unlockAudio();
  requestRecap();
});

if (elMute) {
  setMuted(elMute.checked);
  elMute.addEventListener("change", () => {
    unlockAudio();
    setMuted(elMute.checked);
  });
}

window.addEventListener("keydown", (e) => {
  // Keep text editing and native Space/Enter activation separate from game keys.
  if (e.target?.closest?.("input, textarea, select, [contenteditable=true]"))
    return;
  if (e.target?.closest?.("button, summary") && [" ", "Enter"].includes(e.key))
    return;
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    pendingHuman = "left";
    e.preventDefault();
  } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    pendingHuman = "right";
    e.preventDefault();
  } else if (
    e.key === "ArrowDown" ||
    e.key === "s" ||
    e.key === "S" ||
    e.key === " "
  ) {
    pendingHuman = "stay";
    e.preventDefault();
  } else if (e.key === "r" || e.key === "R") {
    reset();
  } else if (e.key === "m" || e.key === "M") {
    if (elMute) {
      elMute.checked = !elMute.checked;
      setMuted(elMute.checked);
    }
  }
});

loadSprites().then(() => draw());
loadAudioSamples();
renderRecentScores();
reset();
