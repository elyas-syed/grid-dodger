import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

test("local-file launch gives a server link and prevents a misleading nonfunctional Start", () => {
  const html = readFileSync(
    new URL("../game/index.html", import.meta.url),
    "utf8",
  );
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = {
    "launch-warning": { hidden: true },
    "btn-start": { disabled: false },
    status: { textContent: "ready" },
  };
  runInNewContext(code, {
    location: { protocol: "file:" },
    document: { getElementById: (id) => nodes[id] },
  });
  assert.equal(nodes["launch-warning"].hidden, false);
  assert.equal(nodes["btn-start"].disabled, true);
  assert.match(nodes.status.textContent, /server/i);
  assert.match(html, /data-hosted-game-link/);
});
