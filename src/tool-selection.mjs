/** Reusable closed-option tool selection. No game or AWS dependencies. */
export function selectTool(raw, { options, fallback, threshold = 0.4 }) {
  if (!options.includes(fallback))
    throw new Error("Fallback must be a declared option");
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
    throw new Error("Threshold must be between 0 and 1");
  const rawChoice = String(raw.choice || "")
    .toLowerCase()
    .trim();
  const probability = Number(raw.choiceProbability ?? raw.confidence);
  const valid =
    options.includes(rawChoice) &&
    Number.isFinite(probability) &&
    probability >= 0 &&
    probability <= 1;
  const unsure = !valid || probability < threshold;
  return {
    choice: unsure ? fallback : rawChoice,
    rawChoice,
    confidence: Number.isFinite(probability) ? probability : 0,
    choiceProbability: Number.isFinite(probability) ? probability : 0,
    unsure,
  };
}

/** Only explicitly registered tools can run; no eval or arbitrary function names. */
export function dispatchToolSelection(selection, tools) {
  if (
    !Object.hasOwn(tools, selection.choice) ||
    typeof tools[selection.choice]?.execute !== "function"
  ) {
    throw new Error(`Unregistered tool option: ${selection.choice}`);
  }
  return tools[selection.choice].execute();
}

/** Drop-in wiring for another agent. readDecision returns a normalized typed choice. */
export async function runToolRecipe({
  readDecision,
  tools,
  fallback,
  threshold = 0.4,
}) {
  const raw = await readDecision();
  const selection = selectTool(raw, {
    options: Object.keys(tools),
    fallback,
    threshold,
  });
  return {
    raw,
    selection,
    result: await dispatchToolSelection(selection, tools),
  };
}
