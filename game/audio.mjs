/**
 * Classic arcade SFX — user-provided samples for start/game-over when available,
 * Web Audio chiptune fallback otherwise. See assets/ATTRIBUTION.txt
 */

let ctx = null;
let muted = false;
let master = null;
let bgm = null;
const sampleCache = new Map();
const BGM_SRC = "./assets/bgm-suits-you.mp3";
const BGM_VOLUME = 0.28;

function ensureCtx() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function setMuted(value) {
  muted = Boolean(value);
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : 0.28, ctx.currentTime, 0.02);
  }
  for (const a of sampleCache.values()) {
    a.muted = muted;
  }
  if (bgm) {
    bgm.muted = muted;
    bgm.volume = muted ? 0 : BGM_VOLUME;
  }
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type = "square", gain = 0.4, slideTo = null, when = 0) {
  const ac = ensureCtx();
  if (!ac || !master) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function sequence(notes, type = "square", gain = 0.32) {
  const ac = ensureCtx();
  if (!ac) return;
  for (const n of notes) {
    tone(n.f, n.d, type, gain * (n.g ?? 1), n.to ?? null, n.t);
  }
}

function noiseBurst(dur, gain = 0.25, when = 0) {
  const ac = ensureCtx();
  if (!ac || !master) return;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1400;
  const t0 = ac.currentTime + when;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function getSample(key, src) {
  if (sampleCache.has(key)) return sampleCache.get(key);
  const a = new Audio(src);
  a.preload = "auto";
  a.volume = 0.55;
  sampleCache.set(key, a);
  return a;
}

function playSample(key, src, { volume = 0.55 } = {}) {
  if (muted) return false;
  ensureCtx();
  try {
    const base = getSample(key, src);
    const a = base.cloneNode();
    a.volume = volume;
    a.muted = muted;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function ensureBgm() {
  if (bgm) return bgm;
  bgm = new Audio(BGM_SRC);
  bgm.loop = true;
  bgm.preload = "auto";
  bgm.volume = muted ? 0 : BGM_VOLUME;
  bgm.muted = muted;
  return bgm;
}

/** Prefetch start / game-over / BGM. */
export function loadAudioSamples() {
  getSample("start", "./assets/sfx-start.mp3");
  getSample("gameover", "./assets/sfx-gameover.mp3");
  ensureBgm();
}

/** Unlock audio on first user gesture. */
export function unlockAudio() {
  ensureCtx();
  loadAudioSamples();
}

export function startBgm() {
  if (muted) return;
  ensureCtx();
  const a = ensureBgm();
  a.muted = muted;
  a.volume = BGM_VOLUME;
  const p = a.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

export function stopBgm() {
  if (!bgm) return;
  bgm.pause();
  bgm.currentTime = 0;
}

export function pauseBgm() {
  if (!bgm) return;
  bgm.pause();
}

export const sfx = {
  move(dir) {
    if (dir === "left") tone(440, 0.05, "square", 0.22);
    else if (dir === "right") tone(554, 0.05, "square", 0.22);
    else tone(330, 0.04, "triangle", 0.14);
  },
  unsure() {
    tone(196, 0.1, "triangle", 0.18, 147);
  },
  tip() {
    sequence(
      [
        { f: 784, d: 0.04, t: 0 },
        { f: 988, d: 0.06, t: 0.04 },
      ],
      "sine",
      0.14,
    );
  },
  /** User-provided Floraphonic start sting; else chiptune fanfare */
  start() {
    if (playSample("start", "./assets/sfx-start.mp3", { volume: 0.6 })) return;
    sequence(
      [
        { f: 392, d: 0.09, t: 0 },
        { f: 523.25, d: 0.09, t: 0.1 },
        { f: 659.25, d: 0.09, t: 0.2 },
        { f: 783.99, d: 0.18, t: 0.3, g: 1.15 },
        { f: 1046.5, d: 0.12, t: 0.42, g: 0.85 },
      ],
      "square",
      0.34,
    );
    sequence(
      [
        { f: 196, d: 0.35, t: 0, g: 0.55 },
        { f: 261.63, d: 0.25, t: 0.3, g: 0.45 },
      ],
      "triangle",
      0.2,
    );
  },
  tickSoft() {
    tone(180, 0.03, "triangle", 0.08);
  },
  crash() {
    noiseBurst(0.22, 0.4);
    tone(140, 0.28, "sawtooth", 0.28, 48);
  },
  /** Arcade game-over sample if present; else descending doom */
  gameOver() {
    if (playSample("gameover", "./assets/sfx-gameover.mp3", { volume: 0.7 })) return;
    noiseBurst(0.16, 0.32, 0);
    sequence(
      [
        { f: 392, d: 0.14, t: 0.05 },
        { f: 311.13, d: 0.14, t: 0.2 },
        { f: 233.08, d: 0.16, t: 0.35 },
        { f: 155.56, d: 0.45, t: 0.52, to: 82, g: 1.1 },
      ],
      "square",
      0.36,
    );
  },
  recap() {
    sequence(
      [
        { f: 523.25, d: 0.07, t: 0 },
        { f: 659.25, d: 0.09, t: 0.18 },
        { f: 783.99, d: 0.12, t: 0.18 },
      ],
      "triangle",
      0.16,
    );
  },
};
