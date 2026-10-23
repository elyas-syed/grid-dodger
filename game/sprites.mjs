/**
 * Board sprites — lean set:
 *   player starship (Space Starter Kit)
 *   enemy dark fighter (nose-down)
 *   dark asteroid (user-provided)
 * See assets/ATTRIBUTION.txt
 */

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function paintGrid(pixels, palette, scale = 4) {
  const rows = pixels.length;
  const cols = pixels[0].length;
  const c = makeCanvas(cols * scale, rows * scale);
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const key = pixels[y][x];
      if (!key || key === ".") continue;
      g.fillStyle = palette[key];
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

const PLAYER_PX = [
  "....c....",
  "...ccc...",
  "..cchcc..",
  ".ccchccc.",
  "cccwhwccc",
  ".cccwccc.",
  "..c.c.c..",
  "...a.a...",
];
const PLAYER_PALETTE = { c: "#2dd4a0", h: "#7dffc8", w: "#e8fff4", a: "#1a9a6e" };

const HAZARD_PX = [
  "..rrr..",
  ".rrdrr.",
  "rrdddrr",
  "rdddddr",
  "rrdddrr",
  ".rrdrr.",
  "..rrr..",
];
const HAZARD_PALETTE = { r: "#ff6b6b", d: "#c43c3c" };

const SKIN_FILES = {
  "fighter-dark": ["./assets/hazard-fighter-dark.svg"],
  asteroid: ["./assets/hazard-asteroid.png"],
};

const SKIN_GLOW = {
  "fighter-dark": "#c0c8d4",
  asteroid: "#7a8490",
};

const SKIN_PAD = {
  "fighter-dark": 0.05,
  asteroid: 0.05,
};

const SKIN_ROTATE = {
  "fighter-dark": Math.PI,
  asteroid: 0,
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadFirst(srcs) {
  for (const src of srcs) {
    const img = await loadImage(src);
    if (img) return img;
  }
  return null;
}

let cache = null;
let readyPromise = null;

export function getSprites() {
  if (cache) return cache;
  const fallback = paintGrid(HAZARD_PX, HAZARD_PALETTE, 4);
  cache = {
    player: paintGrid(PLAYER_PX, PLAYER_PALETTE, 4),
    hazard: fallback,
    skins: {},
    bgTile: null,
    ready: false,
  };
  return cache;
}

export function loadSprites() {
  if (readyPromise) return readyPromise;
  const sprites = getSprites();
  const skinEntries = Object.entries(SKIN_FILES);
  readyPromise = Promise.all([
    loadFirst(["./assets/player.svg"]),
    loadFirst(["./assets/bg-space.svg"]),
    ...skinEntries.map(([, srcs]) => loadFirst(srcs)),
  ]).then(([player, bg, ...skinImgs]) => {
    if (player) sprites.player = player;
    sprites.bgTile = bg;
    const skins = {};
    skinEntries.forEach(([key], i) => {
      if (skinImgs[i]) skins[key] = skinImgs[i];
    });
    sprites.skins = skins;
    if (skins["fighter-dark"]) sprites.hazard = skins["fighter-dark"];
    else if (skins.asteroid) sprites.hazard = skins.asteroid;
    sprites.ready = true;
    return sprites;
  });
  return readyPromise;
}

export function drawCellGlow(ctx, x, y, size, color, alpha = 0.22) {
  const g = ctx.createRadialGradient(
    x + size / 2,
    y + size / 2,
    size * 0.1,
    x + size / 2,
    y + size / 2,
    size * 0.55,
  );
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x, y, size, size);
  ctx.restore();
}

export function blitInCell(ctx, sprite, ox, oy, cell, pad = 0.1, rotate = 0) {
  const inset = cell * pad;
  const dw = cell - inset * 2;
  const dh = cell - inset * 2;
  const cx = ox + cell / 2;
  const cy = oy + cell / 2;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  if (rotate) {
    ctx.translate(cx, cy);
    ctx.rotate(rotate);
    ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(sprite, ox + inset, oy + inset, dw, dh);
  }
  ctx.restore();
}

export function hazardStyle(h, sprites) {
  const skin = h.skin && sprites.skins?.[h.skin] ? h.skin : "asteroid";
  const sprite =
    sprites.skins?.[skin] ||
    sprites.skins?.asteroid ||
    sprites.skins?.["fighter-dark"] ||
    sprites.hazard;
  return {
    sprite,
    glow: SKIN_GLOW[skin] || "#9aa8b8",
    pad: SKIN_PAD[skin] ?? 0.08,
    rotate: SKIN_ROTATE[skin] ?? 0,
  };
}

export function hazardFor(h, sprites) {
  return hazardStyle(h, sprites).sprite;
}

export function drawShadowGhost(ctx, ox, oy, cell, stay) {
  ctx.save();
  ctx.strokeStyle = "#f0c14b";
  ctx.lineWidth = Math.max(2, cell * 0.06);
  if (stay) ctx.setLineDash([cell * 0.12, cell * 0.1]);
  else ctx.setLineDash([]);
  const m = cell * 0.08;
  ctx.strokeRect(ox + m, oy + m, cell - m * 2, cell - m * 2);
  const cx = ox + cell / 2;
  const cy = oy + cell / 2;
  const r = cell * 0.12;
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(240, 193, 75, 0.85)";
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawBoardBackdrop(ctx, w, h, tick = 0, bgTile = null) {
  if (bgTile) {
    ctx.drawImage(bgTile, 0, 0, w, h);
    ctx.fillStyle = "rgba(7, 11, 16, 0.2)";
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = "#070b10";
    ctx.fillRect(0, 0, w, h);
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(20, 40, 70, 0.15)");
  g.addColorStop(1, "rgba(10, 20, 30, 0.35)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
