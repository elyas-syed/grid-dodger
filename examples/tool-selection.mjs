#!/usr/bin/env node
// Offline by default. Set DECIDER_URL and pass --live to call your Decider server.
import { runToolRecipe } from "../src/tool-selection.mjs";
const live = process.argv.includes("--live");
const request =
  process.argv
    .filter((v) => v !== "--live")
    .slice(2)
    .join(" ") || "What is our documented refund policy?";
const question = {
  type: "choice",
  instructions:
    "Select lookup for a concrete question that can be answered from documentation. Select ask when the request is missing the subject needed to look anything up.",
  criteria: {
    lookup: "Look up documentation for the specified subject",
    ask: "Ask the user to name the subject before using documentation",
  },
};
const tools = {
  lookup: { execute: () => ({ tool: "lookup", query: request }) },
  ask: {
    execute: () => ({
      tool: "ask",
      message: "Which subject should I look up?",
    }),
  },
};
const readDecision = async () => {
  if (!live) return { choice: "lookup", choiceProbability: 0.9 };
  if (!process.env.DECIDER_URL) throw Error("Set DECIDER_URL for --live");
  const response = await fetch(
    `${process.env.DECIDER_URL.replace(/\/$/, "")}/v1/systemone`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: request,
        questions: { next_tool: question },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!response.ok) throw Error(`Decider HTTP ${response.status}`);
  const body = await response.json();
  const answer = body.answers?.next_tool;
  return {
    choice: answer?.choice,
    choiceProbability: answer?.probabilities?.[answer?.choice],
    reliability: answer?.confidence,
  };
};
console.log(
  JSON.stringify(
    await runToolRecipe({
      readDecision,
      tools,
      fallback: "ask",
      threshold: 0.4,
    }),
    null,
    2,
  ),
);
