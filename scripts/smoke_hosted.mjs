#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { isGroundedRecap } from "../src/recap.mjs";
const outputs = JSON.parse(
  execFileSync("terraform", ["-chdir=terraform", "output", "-json"], {
    encoding: "utf8",
  }),
);
const base = new URL(outputs.cloudfront_url.value).origin;
const request = (url, opts = {}) =>
  fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
for (const pathname of [
  "/game/",
  "/game/index.html",
  "/game/styles.css",
  "/game/app.js",
  "/src/tool-selection.mjs",
  "/src/move-tools.mjs",
  "/src/run-summary.mjs",
]) {
  const response = await request(base + pathname);
  assert.equal(response.status, 200, pathname);
  if (pathname.endsWith(".mjs") || pathname.endsWith(".js"))
    assert.match(response.headers.get("content-type"), /javascript/, pathname);
  console.log("PASS", pathname);
}
const root = await request(base + "/", { redirect: "manual" });
assert.equal(root.status, 302);
assert.equal(root.headers.get("location"), "/game/index.html");
const health = await (await request(base + "/decider/health")).json();
assert.equal(health.device, "cuda");
console.log("PASS CUDA health");
for (const pathname of [
  "/docs/ARTICLE.md",
  "/terraform/terraform.tfstate",
  "/.env",
  "/src/recap.mjs",
])
  assert.ok(
    [403, 404].includes((await request(base + pathname)).status),
    pathname,
  );
const opts = {
  method: "POST",
  headers: { "content-type": "application/json" },
};
const direct = await request(outputs.recap_api_endpoint.value + "/api/recap", {
  ...opts,
  body: "{}",
});
assert.equal(direct.status, 403);
const invalid = await request(base + "/api/recap", { ...opts, body: "[]" });
assert.equal(invalid.status, 400);
console.log("PASS origin verification, input validation, private-path denial");
for (const mode of ["human", "shadow", "decider"]) {
  const response = await request(base + "/api/recap", {
    ...opts,
    body: JSON.stringify({
      score: 12,
      history: ["left", "stay", "right"],
      mode,
      gameOver: true,
      collision: {
        stage: "falling",
        move: "right",
        playerCol: 3,
        playerRow: 9,
      },
    }),
  });
  assert.equal(response.status, 200);
  const recap = await response.json();
  assert.equal(recap.source, "bedrock", JSON.stringify(recap));
  assert.ok(isGroundedRecap(recap.text));
  assert.equal(recap.summary.collision.stage, "falling");
  console.log("PASS Bedrock", mode, recap.text);
}
for (const [outcome, score, expected] of [["stopped", 42, /You stopped the run\. Your score: 42\./], ["won", 500, /You win! You reached 500 points\./]]) {
  const response = await request(base + "/api/recap", {
    ...opts, body: JSON.stringify({mode: "human", outcome, score, history: ["left", "stay"], gameOver: false}),
  });
  assert.equal(response.status, 200);
  const recap = await response.json();
  assert.equal(recap.source, "bedrock", JSON.stringify(recap));
  assert.equal(recap.summary.outcome, outcome);
  assert.equal(recap.summary.collision, null);
  assert.match(recap.text, expected);
  console.log("PASS Bedrock", outcome, recap.text);
}
try {
  const directAlb = await fetch(
    `http://${outputs.decider_alb_dns.value}/health`,
    { signal: AbortSignal.timeout(5000) },
  );
  assert.equal(directAlb.status, 403, "Direct ALB access must be blocked");
} catch (error) {
  if (error.name === "AssertionError") throw error;
  assert.ok(["TimeoutError", "TypeError", "AbortError"].includes(error.name));
}
console.log("PASS direct ALB blocked");
console.log("Hosted smoke checks passed:", base);
