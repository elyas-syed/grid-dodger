const MODES = new Set(["human", "shadow", "decider"]);

/**
 * @param {string} [mode]
 * @returns {"human"|"shadow"|"decider"}
 */
export function normalizeMode(mode) {
  const m = String(mode || "human").toLowerCase();
  return MODES.has(m) ? m : "human";
}

export function outcomeLine(summary) {
  if (summary.outcome === "stopped")
    return `You stopped the run. Your score: ${summary.score}.`;
  if (summary.outcome === "won")
    return `You win! You reached ${summary.score} points.`;
  return "";
}

function pilotLine(mode) {
  if (mode === "decider") return "Pilot: Strands Decider 2B (auto).";
  if (mode === "shadow") {
    return "Pilot: human, with Decider suggestions (shadow mode).";
  }
  return "Pilot: human (no Decider control).";
}

/**
 * Build Bedrock user prompt for game-over recap.
 * @param {{ score: number, history: string[], unsureCount?: number, mode?: string }} summary
 */
export function buildRecapPrompt(summary) {
  const mode = normalizeMode(summary.mode);
  const hist = (summary.history || []).slice(-12).join(", ") || "(none)";
  const role =
    mode === "decider"
      ? "You are a witty but kind coach for a tiny grid-dodger game piloted by an AI decision model (Strands Decider)."
      : mode === "shadow"
        ? "You are a witty but kind coach for a tiny grid-dodger game where a human played with AI move suggestions."
        : "You are a witty but kind coach for a tiny grid-dodger game played by a human (no AI controlling moves).";

  return [
    role,
    "Write under 80 words. No medical/financial advice. No markdown headings.",
    "Do not credit the Decider for surviving if the pilot was human-only.",
    "Rules: five columns, ten rows; hazards fall one row after each move. The only actions are left, stay, right, one column per move. No diagonals, jumping, shooting, boosts, or power-ups.",
    "Use only the supplied facts. Do not invent skills, near misses, intentions, a perfect run, or reasons for a model decision. Staying is not necessarily safe. Give one tip using legal actions only.",
    pilotLine(mode),
    `Run outcome: ${summary.outcome || "collision"}. ${outcomeLine(summary)}`,
    "If stopped, the player ended the run voluntarily: do not describe a crash or defeat. If won, celebrate reaching the 500-point goal: do not describe a collision. Include the outcome and exact score.",
    `Score (points): ${summary.score}`,
    `Recent moves (a sample, not the full run): ${hist}`,
    `Unsure (low-confidence) forced stays: ${summary.unsureCount ?? 0}`,
    `Game over: ${summary.gameOver === true}. Collision evidence: ${JSON.stringify(summary.collision ?? null)}. A null collision means the cause was not supplied; do not guess it.`,
    "Use moves, never ticks, in player-facing text. Report the score in points, not as a survived-move count. Refer to left, stay, and right as moves; stay also counts as a move. Do not infer total move counts or consecutive-action counts from the recent history sample.",
    "Celebrate what went well, one tip for next run.",
  ].join("\n");
}

export function isGroundedRecap(text) {
  return (
    Boolean(text) &&
    text.trim().split(/\s+/).length <= 80 &&
    !/\b(?:ticks?|diagonals?|jump(?:ing)?|shoot(?:ing)?|power[- ]?ups?|flawless|perfect(?:ly)?)\b/i.test(
      text,
    )
  );
}

/** Offline stub when Bedrock is unavailable. */
export function mockRecap(summary) {
  const opening = outcomeLine(summary);
  if (opening)
    return `${opening} Next time: watch the next row and choose left, stay, or right before hazards arrive.`;
  const mode = normalizeMode(summary.mode);
  const score = summary.score;
  if (mode === "decider") {
    return `You scored ${score} points. Decider steered. Next time: glance two rows ahead before you commit.`;
  }
  if (mode === "shadow") {
    return `You scored ${score} points with Decider tips. Next time: trust the yellow ghost a beat earlier.`;
  }
  return `You scored ${score} points on your own. Next time: glance two rows ahead before you commit.`;
}

/**
 * Normalize untrusted UI/CLI summary input.
 * @param {any} raw
 */
export function normalizeRecapSummary(raw) {
  const score = Number(raw?.score);
  const unsureCount = Number(raw?.unsureCount);
  const history = Array.isArray(raw?.history)
    ? raw.history
        .filter((m) => m != null && m !== "")
        .map((m) => String(m))
        .filter((m) => ["left", "stay", "right"].includes(m))
        .slice(-64)
    : [];
  return {
    score: Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0,
    history,
    unsureCount: Number.isFinite(unsureCount)
      ? Math.max(0, Math.floor(unsureCount))
      : 0,
    mode: normalizeMode(raw?.mode),
    outcome: ["stopped", "won"].includes(raw?.outcome)
      ? raw.outcome
      : "collision",
    gameOver:
      !["stopped", "won"].includes(raw?.outcome) && raw?.gameOver === true,
    collision:
      !["stopped", "won"].includes(raw?.outcome) &&
      raw?.collision &&
      ["step-on", "falling"].includes(raw.collision.stage) &&
      ["left", "stay", "right"].includes(raw.collision.move) &&
      Number.isInteger(raw.collision.playerCol) &&
      raw.collision.playerCol >= 0 &&
      raw.collision.playerCol < 5 &&
      raw.collision.playerRow === 9
        ? {
            stage: raw.collision.stage,
            move: raw.collision.move,
            playerCol: raw.collision.playerCol,
            playerRow: 9,
          }
        : null,
  };
}

/**
 * Live Bedrock recap with clean mock fallback (no throw to callers).
 * @param {{ score: number, history: string[], unsureCount?: number, mode?: string }} summary
 * @param {{ modelId?: string, region?: string }} [opts]
 * @returns {Promise<{ text: string, source: "bedrock"|"mock", modelId?: string, reason?: string }>}
 */
export async function generateRecap(summary, opts = {}) {
  const normalized = normalizeRecapSummary(summary);
  const modelId = opts.modelId || process.env.BEDROCK_MODEL_ID;
  const region =
    opts.region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "us-east-1";

  if (!modelId) {
    return {
      text: mockRecap(normalized),
      source: "mock",
      reason: "BEDROCK_MODEL_ID unset",
    };
  }

  try {
    const { BedrockRuntimeClient, ConverseCommand } = await import(
      "@aws-sdk/client-bedrock-runtime"
    );
    const client = new BedrockRuntimeClient({ region });
    const out = await client.send(
      new ConverseCommand({
        modelId,
        messages: [
          {
            role: "user",
            content: [{ text: buildRecapPrompt(normalized) }],
          },
        ],
        inferenceConfig: { maxTokens: 160, temperature: 0.2 },
      }),
    );
    const text = out.output?.message?.content
      ?.map((c) => c.text)
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!isGroundedRecap(text)) {
      return {
        text: mockRecap(normalized),
        source: "mock",
        modelId,
        reason: text ? "ungrounded gameplay advice" : "empty Bedrock response",
      };
    }
    return {
      text: [outcomeLine(normalized), text].filter(Boolean).join(" "),
      source: "bedrock",
      modelId,
    };
  } catch (err) {
    return {
      text: mockRecap(normalized),
      source: "mock",
      modelId,
      reason: String(err.message || err),
    };
  }
}
