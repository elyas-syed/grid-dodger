#!/usr/bin/env node
/**
 * Optional live Bedrock recap (Phase 4).
 * Usage: npm run recap -- '{"score":12,"history":["left","stay"]}'
 *
 * Requires AWS credentials + BEDROCK_MODEL_ID. Falls back to mock text otherwise.
 */
import { generateRecap } from "../src/recap.mjs";

function parseInput() {
  const raw = process.argv[2];
  if (!raw) {
    return { score: 0, history: [], unsureCount: 0 };
  }
  return JSON.parse(raw);
}

async function main() {
  const result = await generateRecap(parseInput());
  console.log(result.text);
  if (result.source === "mock") {
    console.error(`(mock) ${result.reason || "Bedrock unavailable"}`);
  } else {
    console.error(`(bedrock) model=${result.modelId}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
