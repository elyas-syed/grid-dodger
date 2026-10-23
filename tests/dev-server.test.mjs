import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { once } from "node:events";
import { test } from "node:test";

test("local server serves game assets, proxies Decider, labels offline recap, and hides private files", async (t) => {
  const upstream = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ path: req.url, method: req.method }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  t.after(() => new Promise((resolve) => upstream.close(resolve)));
  const child = spawn(process.execPath, ["scripts/dev_server.mjs"], {
    env: {
      ...process.env,
      PORT: "0",
      DECIDER_URL: `http://127.0.0.1:${upstream.address().port}`,
      BEDROCK_MODEL_ID: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill());
  let output = "";
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("Dev server did not start")),
      10000,
    );
    child.once("error", reject);
    child.once("exit", (code) => reject(Error(`Dev server exited ${code}`)));
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const m = output.match(/http:\/\/127\.0\.0\.1:(\d+)\/game\//);
      if (m) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${m[1]}`);
      }
    });
  });
  assert.equal((await fetch(`${base}/game/`)).status, 200);
  assert.match(
    (await fetch(`${base}/src/tool-selection.mjs`)).headers.get("content-type"),
    /javascript/,
  );
  for (const name of [
    ".env",
    "terraform/terraform.tfstate",
    "docs/ARTICLE.md",
    "package.json",
    "game/%2e%2e/.env",
  ])
    assert.equal((await fetch(`${base}/${name}`)).status, 404, name);
  assert.equal((await fetch(`${base}/game/%2e%2e%2fpackage.json`)).status, 400);
  assert.equal((await fetch(`${base}/game/%zz`)).status, 400);
  const proxy = await fetch(`${base}/decider/health`);
  assert.deepEqual(await proxy.json(), { path: "/health", method: "GET" });
  const recap = await fetch(`${base}/api/recap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ score: 3, history: ["left"], mode: "human" }),
  });
  assert.equal((await recap.json()).source, "mock");
  assert.equal(
    (await fetch(`${base}/api/recap`, { method: "POST", body: "{broken" }))
      .status,
    400,
  );
});
