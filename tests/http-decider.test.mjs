import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createGame } from "../src/engine.mjs";
import { describeMoveOutcomes } from "../src/state-formatter.mjs";
import { applyDecisionPolicy } from "../src/policy.mjs";
import {
  buildSystemOneBody,
  httpDecide,
  parseSystemOneResponse,
} from "../src/decider-http.mjs";

describe("http decider client", () => {
  it("describes both step-on and falling collisions, including clamped edges", () => {
    const state = { ...createGame(), playerCol: 0, hazards: [{ col: 0, row: 8 }, { col: 1, row: 9 }] };
    const outcomes = describeMoveOutcomes(state);
    assert.match(outcomes.left, /COLLISION.*board edge/);
    assert.match(outcomes.stay, /COLLISION/);
    assert.match(outcomes.right, /COLLISION/);
    state.hazards.pop();
    assert.match(buildSystemOneBody(state).questions.safest_move.criteria.right, /SAFE/);
  });

  it("rejects malformed responses instead of silently inventing stay", () => {
    assert.throws(() => parseSystemOneResponse({ answers: {} }), /no valid/);
    assert.throws(() => parseSystemOneResponse({ answers: { safest_move: { choice: "run" } } }), /no valid/);
  });

  it("does not substitute calibrated reliability for missing choice probability", () => {
    const result = parseSystemOneResponse({answers:{safest_move:{choice:"left",confidence:0.9}}});
    assert.equal(result.choiceProbability,0);
    assert.equal(result.reliability,0.9);
    assert.equal(applyDecisionPolicy(result,0.4).choice,"stay");
  });

  it("passes a real GPU response through the confidence policy", () => {
    const result = parseSystemOneResponse({ answers: { safest_move: {
      choice: "right", confidence: 0.5511,
      probabilities: { left: 0.2695, stay: 0.0298, right: 0.7008 },
    } } });
    assert.equal(applyDecisionPolicy(result, 0.4).choice, "right");
  });
  it("builds a choice question with left/stay/right", () => {
    const body = buildSystemOneBody(createGame());
    assert.match(body.state, /Player column:/);
    assert.equal(body.questions.safest_move.type, "choice");
    assert.deepEqual(Object.keys(body.questions.safest_move.criteria).sort(), [
      "left",
      "right",
      "stay",
    ]);
  });

  it("parses choice + prefers option probability for policy confidence", () => {
    const d = parseSystemOneResponse({
      model: "strands-decider-2B-hobson-v19",
      answers: {
        safest_move: {
          type: "choice",
          choice: "RIGHT",
          confidence: 0.09,
          probabilities: { left: 0.2, stay: 0.2, right: 0.81 },
        },
      },
      latency_ms: 120.4,
    });
    assert.equal(d.choice, "right");
    assert.equal(d.confidence, 0.81);
    assert.equal(d.reliability, 0.09);
    assert.equal(d.decide_ms, 120);
    assert.equal(d.model, "strands-decider-2B-hobson-v19");
  });

  it("httpDecide posts to /v1/systemone via fetchImpl", async () => {
    let seenUrl = "";
    let seenBody = null;
    const fetchImpl = async (url, init) => {
      seenUrl = url;
      seenBody = JSON.parse(init.body);
      return {
        ok: true,
        async json() {
          return {
            answers: { safest_move: { choice: "left", confidence: 0.1, probabilities: {left: 0.7} } },
          };
        },
      };
    };

    const d = await httpDecide(createGame(), {
      url: "http://127.0.0.1:8000",
      fetchImpl,
    });
    assert.equal(seenUrl, "http://127.0.0.1:8000/v1/systemone");
    assert.equal(seenBody.questions.safest_move.type, "choice");
    assert.equal(d.choice, "left");
    assert.equal(d.confidence, 0.7);
    assert.equal(d.source, "http");
    assert.ok(typeof d.decide_ms === "number");
  });
});
