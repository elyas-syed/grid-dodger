import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyDecisionPolicy } from "../src/policy.mjs";

describe("policy", () => {
  it("accepts confident valid choice", () => {
    const d = applyDecisionPolicy({ choice: "left", confidence: 0.8 }, 0.55);
    assert.equal(d.choice, "left");
    assert.equal(d.unsure, false);
  });

  it("forces stay when below threshold", () => {
    const d = applyDecisionPolicy({ choice: "right", confidence: 0.2 }, 0.55);
    assert.equal(d.choice, "stay");
    assert.equal(d.unsure, true);
    assert.equal(d.rawChoice, "right");
  });

  it("rejects invalid choice", () => {
    const d = applyDecisionPolicy({ choice: "up", confidence: 0.99 }, 0.55);
    assert.equal(d.choice, "stay");
    assert.equal(d.unsure, true);
  });
});
