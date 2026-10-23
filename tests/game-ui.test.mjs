import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { createGame, clampMove, step, getDifficulty } from "../src/engine.mjs";
import { applyDecisionPolicy } from "../src/policy.mjs";
import { executeMoveTool } from "../src/move-tools.mjs";
import { decisionContext } from "../src/state-formatter.mjs";
import { collisionFacts } from "../src/run-summary.mjs";

// Run the actual browser controller with a small DOM/audio/canvas harness.
// Deferred HTTP responses reproduce pause/restart races without a browser dependency.
function harness({ reducedMotion = false, embedded = false } = {}) {
  const elements = new Map();
  const scrollRequests = [];
  const html = readFileSync(
    new URL("../game/index.html", import.meta.url),
    "utf8",
  );
  const declaredIds = new Set(
    [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
  );
  const noop = () => {};
  const ctx = new Proxy({}, { get: () => noop, set: () => true });
  function element(id) {
    if (!id.startsWith(".") && !declaredIds.has(id))
      throw new Error(`Controller references an absent HTML element: ${id}`);
    if (!elements.has(id))
      elements.set(id, {
        value: "",
        textContent: "",
        style: {},
        hidden: false,
        checked: true,
        width: 320,
        height: 520,
        disabled: false,
        classList: { add: noop, remove: noop, toggle: noop },
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        getAttribute(name) {
          return this.attributes[name];
        },
        listeners: {},
        addEventListener(type, fn) {
          this.listeners[type] = fn;
        },
        getContext: () => ctx,
        scrollIntoView: (options) => scrollRequests.push({ id, options }),
      });
    return elements.get(id);
  }
  element("mode").value = "decider";
  element("decider-source").value = "http";
  element("threshold").value = "0.40";
  const requests = [];
  const timers = [];
  const recaps = [];
  const storage = new Map();
  const keyListeners = {};
  const scope = {
    createGame,
    clampMove,
    step,
    applyDecisionPolicy,
    executeMoveTool,
    collisionFacts,
    getDifficulty,
    decisionContext,
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    fetch: (_url, opts) =>
      new Promise((resolve) =>
        recaps.push({
          resolve,
          body: JSON.parse(opts.body),
          signal: opts.signal,
        }),
      ),
    mockDecide: () => ({ choice: "right", confidence: 1 }),
    DEFAULT_DECIDER_PROXY: "/decider",
    httpDecide: (_state, opts) =>
      new Promise((resolve, reject) =>
        requests.push({ resolve, reject, signal: opts.signal }),
      ),
    document: {
      getElementById: element,
      querySelector: element,
      documentElement: { dataset: { arcadeEmbed: String(embedded) } },
    },
    window: {
      matchMedia: () => ({ matches: reducedMotion }),
      addEventListener: (event, fn) => {
        keyListeners[event] = fn;
      },
    },
    console,
    Date,
    AbortController,
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeout: noop,
    getSprites: () => ({}),
    loadSprites: async () => {},
    hazardStyle: () => ({}),
    sfx: new Proxy({}, { get: () => noop }),
  };
  for (const name of [
    "blitInCell",
    "drawBoardBackdrop",
    "drawCellGlow",
    "drawShadowGhost",
    "loadAudioSamples",
    "pauseBgm",
    "setMuted",
    "startBgm",
    "stopBgm",
    "unlockAudio",
  ])
    scope[name] = noop;
  const source = readFileSync(
    new URL("../game/app.js", import.meta.url),
    "utf8",
  ).replace(/^import[\s\S]*?from\s+"[^"\n]+";\n/gm, "");
  vm.runInNewContext(
    source +
      "\nthis.api = {startLoop, stopLoop, reset, tick, readThreshold, getState: () => state, getRunning: () => running, finishRun, setState: value => {state = value}, getOutcome: () => outcome};",
    scope,
  );
  return {
    ...scope.api,
    element,
    requests,
    timers,
    recaps,
    storage,
    scrollRequests,
    pressKey: (key, target) =>
      keyListeners.keydown({ key, target, preventDefault: noop }),
  };
}
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const right = {
  choice: "right",
  confidence: 0.9,
  source: "http",
  decide_ms: 15,
};

test("autonomous HTTP decision moves the player and prefetches next tick", async () => {
  const h = harness();
  h.startLoop();
  h.requests[0].resolve(right);
  await flush();
  assert.equal(h.getState().playerCol, 3);
  assert.equal(h.getState().tick, 1);
  assert.equal(h.requests.length, 2);
});

test("a response from before reset cannot move the new game", async () => {
  const h = harness();
  h.startLoop();
  h.reset();
  h.startLoop();
  assert.equal(h.requests[0].signal.aborted, true);
  h.requests[0].resolve(right);
  await flush();
  assert.equal(h.getState().tick, 0);
  h.requests[1].resolve(right);
  await flush();
  assert.equal(h.getState().tick, 1);
  assert.equal(h.getState().playerCol, 3);
});

test("shadow paints a suggestion before waiting for the human move", async () => {
  const h = harness();
  h.element("mode").value = "shadow";
  h.startLoop();
  assert.equal(
    h.element("status").textContent,
    "shadow · follow the yellow target",
  );
  h.requests[0].resolve(right);
  await flush();
  assert.equal(h.element("move-label").textContent, "suggest right");
  assert.equal(h.element("shadow-cue").textContent, "SUGGEST RIGHT");
  assert.equal(
    h.element("status").textContent,
    "shadow · follow the yellow target",
  );
  assert.equal(h.getState().tick, 0);
  assert.ok(h.timers.some((t) => t.ms >= 280));
});

test("failed prefetched HTTP request pauses without silently advancing hazards", async () => {
  const h = harness();
  h.startLoop();
  h.requests[0].resolve(right);
  await flush();
  h.requests[1].reject(new Error("upstream offline"));
  await flush();
  await h.tick();
  assert.equal(h.getState().tick, 1);
  assert.equal(h.getRunning(), false);
  assert.match(h.element("decision-meta").textContent, /upstream offline/);
});

test("zero threshold is honored and changing mode resets the game", () => {
  const h = harness();
  h.element("threshold").value = "0";
  assert.equal(h.readThreshold(), 0);
  h.startLoop();
  h.element("mode").value = "shadow";
  h.element("mode").listeners.change();
  assert.equal(h.getRunning(), false);
  assert.equal(h.requests[0].signal.aborted, true);
});

test("shadow keeps its card and metrics while the next suggestion is pending", async () => {
  const h = harness();
  h.element("mode").value = "shadow";
  h.startLoop();
  h.requests[0].resolve(right);
  await flush();
  const snapshot = ["move-label", "conf-label", "latency", "status"].map(
    (id) => h.element(id).textContent,
  );
  h.timers.find((t) => t.ms >= 280).fn();
  await flush();
  assert.equal(h.getState().tick, 1);
  assert.equal(h.requests.length, 2);
  assert.deepEqual(
    ["move-label", "conf-label", "latency", "status"].map(
      (id) => h.element(id).textContent,
    ),
    snapshot,
  );
});

test("stop aborts pending decisions, records once, and sends a stopped recap", async () => {
  const h = harness();
  h.startLoop();
  h.finishRun("stopped");
  h.finishRun("stopped");
  assert.equal(h.getOutcome(), "stopped");
  assert.equal(h.getRunning(), false);
  assert.equal(h.requests[0].signal.aborted, true);
  assert.equal(h.recaps.length, 1);
  assert.equal(h.recaps[0].body.outcome, "stopped");
  assert.equal(h.recaps[0].body.score, 0);
  assert.match(h.element("recent-scores").textContent, /Decider: 0/);
  h.requests[0].resolve(right);
  await flush();
  assert.equal(h.getState().tick, 0);
});

test("surviving tick 500 wins, ends the loop, and requests a victory recap", async () => {
  const h = harness();
  h.element("mode").value = "human";
  h.setState({ ...createGame(), score: 499, tick: 499 });
  h.startLoop();
  await flush();
  assert.equal(h.getState().score, 500);
  assert.equal(h.getOutcome(), "won");
  assert.equal(h.getRunning(), false);
  assert.equal(h.element("status").textContent, "you win!");
  assert.equal(h.recaps[0].body.outcome, "won");
  assert.match(h.element("recent-scores").textContent, /Human: 500/);
});

test("last three scores are separate, newest first, and exclude shadow runs", () => {
  const h = harness();
  for (const score of [4, 9, 12, 8]) {
    h.reset();
    h.element("mode").value = "human";
    h.setState({ ...createGame(), score: score - 1 });
    h.startLoop();
    h.finishRun("stopped");
  }
  assert.match(h.element("recent-scores").textContent, /Human: 8 · 12 · 9/);
  h.reset();
  h.element("mode").value = "shadow";
  h.startLoop();
  h.finishRun("stopped");
  assert.match(h.element("recent-scores").textContent, /Decider: No runs yet/);
  assert.match([...h.storage.values()][0], /8,12,9/);
});

test("a recap arriving after reset cannot overwrite a new run", async () => {
  const h = harness();
  h.startLoop();
  h.finishRun("stopped");
  h.reset();
  h.recaps[0].resolve({
    ok: true,
    json: async () => ({ text: "old recap", source: "bedrock" }),
  });
  await flush();
  assert.equal(h.recaps[0].signal.aborted, true);
  assert.equal(h.element(".recap-box").hidden, false);
  assert.match(h.element("recap-text").textContent, /Your story lands here/);
  assert.doesNotMatch(h.element("recap-text").textContent, /old recap/);
});

test("reaching the 500-point goal takes precedence at the score boundary", async () => {
  const h = harness();
  h.element("mode").value = "human";
  h.setState({
    ...createGame(),
    score: 499,
    tick: 499,
    hazards: [{ col: 2, row: 8 }],
  });
  h.startLoop();
  await flush();
  assert.equal(h.getState().score, 500);
  assert.equal(h.getOutcome(), "won");
  assert.equal(h.recaps[0].body.outcome, "won");
  assert.equal(h.recaps[0].body.collision, null);
  assert.equal(h.recaps[0].body.gameOver, false);
});

test("shadow uses the 0.6-second reaction window and preserves early input", async () => {
  const h = harness();
  h.element("mode").value = "shadow";
  h.startLoop();
  h.requests[0].resolve(right);
  await flush();
  const firstWait = h.timers.find((t) => t.ms >= 280);
  assert.ok(firstWait.ms <= 600);
  assert.equal(
    h.getState().tick,
    0,
    "board waits while the suggestion is visible",
  );
  firstWait.fn();
  await flush();
  h.requests[1].resolve(right);
  await flush();
  h.pressKey("ArrowRight"); // The prefetched tip is visible before the next tick starts.
  const nextTick = h.tick();
  await flush();
  const secondWait = h.timers.filter((t) => t.ms >= 280)[1];
  assert.ok(secondWait);
  secondWait.fn();
  await nextTick;
  assert.equal(h.getState().tick, 2);
  assert.equal(
    h.getState().playerCol,
    3,
    "early keypress is applied rather than discarded",
  );
});

test("close model choices show safe options without disguising a policy fallback", async () => {
  const h = harness();
  h.startLoop();
  h.requests[0].resolve({
    ...right,
    confidence: 0.36,
    probabilities: { left: 0.32, stay: 0.32, right: 0.36 },
  });
  await flush();
  assert.match(
    h.element("decision-context").textContent,
    /Model picked right; policy applied stay/,
  );
  assert.match(
    h.element("decision-context").textContent,
    /All 3 moves are safe/,
  );
  assert.match(h.element("option-probabilities").textContent, /right: 36.0%/);
  assert.doesNotMatch(h.element("decision-context").textContent, /unsure/i);
  assert.equal(h.getState().playerCol, 2);
});

test("missing move probabilities are unavailable rather than zero", async () => {
  const h = harness();
  h.startLoop();
  h.requests[0].resolve({ ...right, probabilities: undefined });
  await flush();
  assert.equal(
    h.element("option-probabilities").textContent,
    "Move probabilities unavailable",
  );
});

test("partial move probabilities preserve supplied values and label missing moves", async () => {
  const h = harness();
  h.startLoop();
  h.requests[0].resolve({ ...right, probabilities: { right: 0.9 } });
  await flush();
  assert.equal(
    h.element("option-probabilities").textContent,
    "Move probabilities · left: unavailable · stay: unavailable · right: 90.0%",
  );
});

test("difficulty level follows score without changing the shadow reaction window", async () => {
  const h = harness();
  h.setState({ ...createGame(), score: 450 });
  h.element("mode").value = "shadow";
  h.startLoop();
  h.requests[0].resolve(right);
  await flush();
  assert.equal(h.element("difficulty").textContent, "Extreme");
  assert.ok(h.timers.some((t) => t.ms >= 280 && t.ms <= 600));
});

test("mode buttons reset pending work and expose the selected pilot", () => {
  const h = harness();
  h.startLoop();
  h.element("mode-shadow").listeners.click();
  assert.equal(h.element("mode").value, "shadow");
  assert.equal(h.element("mode-shadow").getAttribute("aria-pressed"), "true");
  assert.equal(h.element("mode-decider").getAttribute("aria-pressed"), "false");
  assert.equal(h.getRunning(), false);
  assert.equal(h.requests[0].signal.aborted, true);
});

test("touch controls steer human play and are disabled for autonomous mode", async () => {
  const h = harness();
  assert.equal(h.element("move-right").disabled, true);
  h.element("mode-human").listeners.click();
  h.startLoop();
  await flush();
  assert.equal(h.element("move-right").disabled, false);
  h.element("move-right").listeners.click();
  await h.tick();
  assert.equal(h.getState().playerCol, 3);
  h.element("mode-decider").listeners.click();
  h.startLoop();
  assert.equal(h.element("move-right").disabled, true);
});

test("editing advanced settings does not steer or restart a running game", async () => {
  const h = harness();
  h.element("mode-human").listeners.click();
  h.startLoop();
  await flush();
  const field = { closest: () => true };
  h.pressKey("ArrowRight", field);
  h.pressKey("r", field);
  await h.tick();
  assert.equal(h.getState().playerCol, 2);
  assert.equal(h.getState().tick, 2);
  assert.equal(h.getRunning(), true);
});

test("arrows still steer after focusing a button while Space keeps native activation", async () => {
  const h = harness();
  h.element("mode-human").listeners.click();
  h.startLoop();
  await flush();
  const button = { closest: (selector) => selector === "button, summary" };
  h.pressKey("ArrowRight", button);
  h.pressKey(" ", button);
  await h.tick();
  assert.equal(h.getState().playerCol, 3);
});

for (const reducedMotion of [false, true]) {
  test(`Start focuses the arcade and respects reduced motion (${reducedMotion})`, () => {
    const h = harness({ reducedMotion });
    h.element("btn-start").listeners.click();
    assert.equal(h.getRunning(), true);
    assert.equal(h.scrollRequests.length, 1);
    assert.equal(h.scrollRequests[0].id, "flight-deck");
    assert.equal(h.scrollRequests[0].options.block, "start");
    assert.equal(
      h.scrollRequests[0].options.behavior,
      reducedMotion ? "auto" : "smooth",
    );
    h.stopLoop();
    h.element("btn-start").listeners.click();
    assert.equal(
      h.scrollRequests.length,
      1,
      "Resume must preserve the viewport",
    );
    h.finishRun("stopped");
    assert.equal(h.scrollRequests[1].id, ".recap-box");
    h.element("btn-start").listeners.click();
    assert.equal(
      h.scrollRequests[2].id,
      "flight-deck",
      "A new run focuses the arcade again",
    );
  });
}

test("embedded Start, Resume and recap preserve the landing page viewport", () => {
  const h = harness({ embedded: true });
  h.element("mode-human").listeners.click();
  h.element("btn-start").listeners.click();
  assert.equal(h.getRunning(), true);
  h.stopLoop();
  h.element("btn-start").listeners.click();
  assert.equal(h.getRunning(), true);
  h.finishRun("stopped");
  assert.equal(h.getRunning(), false);
  assert.equal(h.scrollRequests.length, 0);
  h.element("btn-start").listeners.click();
  assert.equal(h.getRunning(), true);
  assert.equal(h.scrollRequests.length, 0);
});

test("paused runs offer Resume while ready and finished runs offer Start", () => {
  const h = harness();
  assert.equal(h.element("start-label").textContent, "Start");
  h.startLoop();
  h.stopLoop();
  assert.equal(h.element("start-label").textContent, "Resume");
  h.startLoop();
  assert.equal(h.element("start-label").textContent, "Start");
  h.finishRun("stopped");
  assert.equal(h.element("start-label").textContent, "Start");
  h.reset();
  assert.equal(h.element("start-label").textContent, "Start");
});

test("human mode explains absent model probabilities and restores metrics on mode change", () => {
  const h = harness();
  h.element("mode-human").listeners.click();
  assert.equal(
    h.element("option-probabilities").textContent,
    "Model probabilities appear in Decider or Shadow mode.",
  );
  assert.equal(h.element("model-metrics").hidden, true);
  h.startLoop();
  assert.equal(h.element("model-metrics").hidden, true);
  h.element("mode-shadow").listeners.click();
  assert.equal(h.element("model-metrics").hidden, false);
});

for (const [outcome, label, score] of [
  ["stopped", "You stopped", 12],
  ["won", "You win!", 500],
  ["collision", "Game over", 27],
]) {
  test(`recap result shows exact ${outcome} score before narration and clears on reset`, () => {
    const h = harness();
    h.startLoop();
    h.setState({ ...h.getState(), score });
    h.finishRun(outcome);
    assert.equal(h.element("recap-result").hidden, false);
    assert.equal(h.element("recap-outcome").textContent, label);
    assert.equal(h.element("recap-score").textContent, String(score));
    h.reset();
    assert.equal(h.element("recap-result").hidden, true);
    assert.equal(h.element("recap-score").textContent, "");
  });
}

for (const [outcome, text, feedback] of [
  [
    "stopped",
    "You stopped the run. Your score: 5. Next time: look ahead.",
    "Next time: look ahead.",
  ],
  [
    "won",
    "You win! You reached 5 points. You win! You reached 5 points. Keep watching the next row.",
    "Keep watching the next row.",
  ],
  [
    "collision",
    "Survived 5 ticks. Decider steered for 3 logged moves. Next time: look ahead.",
    "Decider steered for 3 logged moves. Next time: look ahead.",
  ],
  [
    "stopped",
    "Look ahead. Your score: 5. Stay can still collide.",
    "Look ahead. Your score: 5. Stay can still collide.",
  ],
]) {
  test(`recap removes only repeated leading result facts: ${text}`, async () => {
    const h = harness();
    h.startLoop();
    h.setState({ ...h.getState(), score: 5 });
    h.finishRun(outcome);
    h.recaps[0].resolve({
      ok: true,
      json: async () => ({ text, source: "bedrock", modelId: "test-model" }),
    });
    await flush();
    assert.equal(
      h.element("recap-text").textContent,
      `${feedback}\n\n— Bedrock (test-model)`,
    );
    assert.equal(h.element("recap-score").textContent, "5");
  });
}
