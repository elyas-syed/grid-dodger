#!/usr/bin/env node
/**
 * Static file server + Decider CORS proxy + Bedrock recap API.
 *
 *   POST /decider/v1/systemone  →  DECIDER_URL/v1/systemone
 *   POST /api/recap             →  Bedrock or mock (server-side creds only)
 *
 * Usage:
 *   npm run serve
 *   DECIDER_URL=http://127.0.0.1:8000 PORT=8080 npm run serve
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateRecap, normalizeRecapSummary } from "../src/recap.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** Load gitignored `.env` into process.env without overriding existing vars. */
function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

const PORT = Number(process.env.PORT || 8080);
const DECIDER_URL = (process.env.DECIDER_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const MIME = {
  ".mp4": "video/mp4",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
}

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function proxyDecider(req, res, restPath) {
  const target = `${DECIDER_URL}${restPath || "/"}`;
  const body = await readBody(req);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: {
        "content-type": req.headers["content-type"] || "application/json",
        accept: "application/json",
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
    });
  } catch (err) {
    const msg = `Decider proxy failed (${DECIDER_URL}): ${err.message || err}`;
    sendJson(res, 502, { error: msg });
    return;
  }

  const text = await upstream.text();
  send(res, upstream.status, text, {
    "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
}

async function handleRecap(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "POST only" });
    return;
  }
  let raw;
  try {
    const buf = await readBody(req);
    raw = buf.length ? JSON.parse(buf.toString("utf8")) : {};
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }
  const summary = normalizeRecapSummary(raw);
  const result = await generateRecap(summary);
  sendJson(res, 200, {
    text: result.text,
    source: result.source,
    modelId: result.modelId || null,
    reason: result.reason || null,
    summary,
  });
}

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const joined = path.normalize(path.join(ROOT, decoded));
  if (joined !== ROOT && !joined.startsWith(ROOT + path.sep)) return null;
  if (!["game", "src"].some(dir => joined === path.join(ROOT, dir) || joined.startsWith(path.join(ROOT, dir) + path.sep))) return null;
  return joined;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/recap") {
    await handleRecap(req, res);
    return;
  }

  if (url.pathname === "/decider" || url.pathname.startsWith("/decider/")) {
    const rest = url.pathname.slice("/decider".length) || "/";
    await proxyDecider(req, res, rest);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed");
    return;
  }

  if (url.pathname === "/") {
    send(res, 302, "", { location: "/game/" });
    return;
  }
  // Only browser assets are public; never serve .env, state, or private docs.
  if (!url.pathname.startsWith("/game/") && !url.pathname.startsWith("/src/")) {
    send(res, 404, "Not found");
    return;
  }

  let filePath;
  try {
    filePath = safeJoin(url.pathname);
  } catch {
    send(res, 400, "Bad path");
    return;
  }
  if (!filePath) {
    send(res, 400, "Bad path");
    return;
  }

  if (url.pathname.endsWith("/")) {
    filePath = path.join(filePath, "index.html");
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      send(res, 404, "Not found");
      return;
    }
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, { "content-type": contentType(filePath) });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    stream.pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Grid Dodger — http://127.0.0.1:${server.address().port}/game/`);
  console.log(`Decider proxy — http://127.0.0.1:${PORT}/decider  →  ${DECIDER_URL}`);
  console.log(`Recap API     — POST http://127.0.0.1:${PORT}/api/recap`);
  console.log(`Decider: npm run decider   (MPS)  |  npm run decider:cpu`);
  if (!process.env.BEDROCK_MODEL_ID) {
    console.log(`Recap: mock until BEDROCK_MODEL_ID is set (see .env.example)`);
  }
});
