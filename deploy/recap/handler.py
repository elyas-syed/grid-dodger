"""Game-over recap Lambda — Bedrock Converse with mock fallback."""

from __future__ import annotations

import json
import hmac
import os
import re
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")


def _normalize(body: dict[str, Any]) -> dict[str, Any]:
    history = body.get("history") or []
    if not isinstance(history, list):
        history = []
    mode = str(body.get("mode") or "human").lower()
    if mode not in {"human", "shadow", "decider"}:
        mode = "human"
    try:
        score = max(0, int(float(body.get("score", 0))))
    except (TypeError, ValueError, OverflowError):
        score = 0
    try:
        unsure = max(0, int(float(body.get("unsureCount", 0))))
    except (TypeError, ValueError, OverflowError):
        unsure = 0
    collision = body.get("collision")
    if not (isinstance(collision, dict)
            and collision.get("stage") in {"step-on", "falling"}
            and collision.get("move") in {"left", "stay", "right"}
            and type(collision.get("playerCol")) is int
            and 0 <= collision["playerCol"] < 5
            and collision.get("playerRow") == 9):
        collision = None
    elif collision:
        collision = {k: collision[k] for k in ("stage", "move", "playerCol", "playerRow")}
    outcome = body.get("outcome") if body.get("outcome") in ("stopped", "won") else "collision"
    if outcome != "collision":
        collision = None
    return {
        "score": score,
        "history": [m for m in history if isinstance(m, str) and m in {"left", "stay", "right"}][-64:],
        "unsureCount": unsure,
        "mode": mode,
        "outcome": outcome,
        "gameOver": outcome == "collision" and body.get("gameOver") is True,
        "collision": collision,
    }


def _outcome_line(summary: dict[str, Any]) -> str:
    if summary["outcome"] == "stopped":
        return f"You stopped the run. Your score: {summary['score']}."
    if summary["outcome"] == "won":
        return f"You win! You reached {summary['score']} points."
    return ""


def _pilot_line(mode: str) -> str:
    if mode == "decider":
        return "Pilot: Strands Decider 2B (auto)."
    if mode == "shadow":
        return "Pilot: human, with Decider suggestions (shadow mode)."
    return "Pilot: human (no Decider control)."


def _prompt(summary: dict[str, Any]) -> str:
    mode = summary["mode"]
    hist = ", ".join(summary["history"][-12:]) or "(none)"
    if mode == "decider":
        role = (
            "You are a witty but kind coach for a tiny grid-dodger game "
            "piloted by an AI decision model (Strands Decider)."
        )
    elif mode == "shadow":
        role = (
            "You are a witty but kind coach for a tiny grid-dodger game "
            "where a human played with AI move suggestions."
        )
    else:
        role = (
            "You are a witty but kind coach for a tiny grid-dodger game "
            "played by a human (no AI controlling moves)."
        )
    return "\n".join(
        [
            role,
            "Write under 80 words. No medical/financial advice. No markdown headings.",
            "Do not credit the Decider for surviving if the pilot was human-only.",
            "Rules: five columns, ten rows; hazards fall one row after each move. The only actions are left, stay, right, one column per move. No diagonals, jumping, shooting, boosts, or power-ups.",
            "Use only the supplied facts. Do not invent skills, near misses, intentions, a perfect run, or reasons for a model decision. Staying is not necessarily safe. Give one tip using legal actions only.",
            _pilot_line(mode),
            f"Run outcome: {summary['outcome']}. {_outcome_line(summary)}",
            "If stopped, the player ended the run voluntarily: do not describe a crash or defeat. If won, celebrate reaching the 500-point goal: do not describe a collision. Include the outcome and exact score.",
            f"Score (points): {summary['score']}",
            f"Recent moves (a sample, not the full run): {hist}",
            f"Unsure (low-confidence) forced stays: {summary['unsureCount']}",
            f"Game over: {summary['gameOver']}. Collision evidence: {json.dumps(summary['collision'])}. A null collision means the cause was not supplied; do not guess it.",
            "Use moves, never ticks, in player-facing text. Report the score in points, not as a survived-move count. Refer to left, stay, and right as moves; stay also counts as a move. Do not infer total move counts or consecutive-action counts from the recent history sample.",
            "Celebrate what went well, one tip for next run.",
        ]
    )


def _grounded(text: str) -> bool:
    return bool(text) and len(text.split()) <= 80 and not re.search(
        r"\b(?:ticks?|diagonals?|jump(?:ing)?|shoot(?:ing)?|power[- ]?ups?|flawless|perfect(?:ly)?)\b", text, re.I
    )


def _mock(summary: dict[str, Any]) -> str:
    opening = _outcome_line(summary)
    if opening:
        return f"{opening} Next time: watch the next row and choose left, stay, or right before hazards arrive."
    mode = summary["mode"]
    score = summary["score"]
    if mode == "decider":
        return (
            f"You scored {score} points. Decider steered. "
            "Next time: glance two rows ahead before you commit."
        )
    if mode == "shadow":
        return (
            f"You scored {score} points with Decider tips. "
            "Next time: trust the yellow ghost a beat earlier."
        )
    return (
        f"You scored {score} points on your own. "
        "Next time: glance two rows ahead before you commit."
    )


def _response(status: int, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "content-type",
            "access-control-allow-methods": "POST,OPTIONS",
        },
        "body": json.dumps(payload),
    }


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    expected = os.environ.get("ORIGIN_VERIFY_TOKEN", "")
    headers = {str(k).lower(): str(v) for k, v in (event.get("headers") or {}).items()}
    if expected and not hmac.compare_digest(headers.get("x-demo-origin", ""), expected):
        return _response(403, {"error": "Use the game URL to request a recap"})
    method = (event.get("requestContext") or {}).get("http", {}).get("method") or event.get(
        "httpMethod", "POST"
    )
    if method == "OPTIONS":
        return _response(204, {})

    try:
        raw = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            import base64

            raw = base64.b64decode(raw).decode("utf-8")
        body = json.loads(raw) if isinstance(raw, str) else (raw or {})
    except (ValueError, TypeError, UnicodeDecodeError):
        return _response(400, {"error": "Invalid JSON body"})

    if not isinstance(body, dict):
        return _response(400, {"error": "JSON body must be an object"})

    summary = _normalize(body)
    try:
        client = boto3.client("bedrock-runtime")
        out = client.converse(
            modelId=MODEL_ID,
            messages=[{"role": "user", "content": [{"text": _prompt(summary)}]}],
            inferenceConfig={"maxTokens": 160, "temperature": 0.2},
        )
        parts = out.get("output", {}).get("message", {}).get("content", [])
        text = "\n".join(p.get("text", "") for p in parts if p.get("text")).strip()
        if not _grounded(text):
            return _response(
                200,
                {
                    "text": _mock(summary),
                    "source": "mock",
                    "modelId": MODEL_ID,
                    "reason": "ungrounded gameplay advice" if text else "empty Bedrock response",
                    "summary": summary,
                },
            )
        return _response(
            200,
            {
                "text": " ".join(filter(None, [_outcome_line(summary), text])),
                "source": "bedrock",
                "modelId": MODEL_ID,
                "reason": None,
                "summary": summary,
            },
        )
    except (ClientError, BotoCoreError, Exception) as err:  # noqa: BLE001 — always fall back
        return _response(
            200,
            {
                "text": _mock(summary),
                "source": "mock",
                "modelId": MODEL_ID,
                "reason": str(err),
                "summary": summary,
            },
        )
