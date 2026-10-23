#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputs = JSON.parse(
  execFileSync("terraform", ["-chdir=terraform", "output", "-json"], {
    cwd: root,
    encoding: "utf8",
  }),
);
const bucket = outputs.ui_bucket?.value,
  dist = outputs.cloudfront_distribution_id?.value,
  url = outputs.cloudfront_url?.value;
if (!bucket || !dist || !url) throw Error("Missing Terraform frontend outputs");
const staging = await mkdtemp(path.join(tmpdir(), "grid-dodger-ui-"));
try {
  await cp(path.join(root, "game"), path.join(staging, "game"), {
    recursive: true,
  });
  await mkdir(path.join(staging, "src"));
  for (const file of [
    "engine.mjs",
    "policy.mjs",
    "decider-mock.mjs",
    "decider-http.mjs",
    "state-formatter.mjs",
    "tool-selection.mjs",
    "move-tools.mjs",
    "run-summary.mjs",
  ]) {
    await cp(path.join(root, "src", file), path.join(staging, "src", file));
  }
  const index = path.join(staging, "game/index.html");
  const html = (await readFile(index, "utf8")).replace(
    /href="[^"]*" data-hosted-game-link/,
    `href="${new URL(url).href}" data-hosted-game-link`,
  );
  await writeFile(index, html);
  for (const dir of ["game", "src"])
    execFileSync(
      "aws",
      [
        "s3",
        "sync",
        path.join(staging, dir),
        `s3://${bucket}/${dir}`,
        "--delete",
      ],
      { stdio: "inherit" },
    );
  execFileSync(
    "aws",
    [
      "cloudfront",
      "create-invalidation",
      "--distribution-id",
      dist,
      "--paths",
      "/game/*",
      "/src/*",
    ],
    { stdio: "inherit" },
  );
  console.log(`Game: ${url}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
