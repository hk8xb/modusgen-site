// The Platform page's six paper objects, one for each piece of software: the model gateway, the
// company agent, coding agents, the company portal, evaluations, and serving and monitoring.
// Each is cut from the same thick handmade paper as the home page's figure and stands on its own
// torn tile, with request dots that keep moving. The opening shows all six; as each piece is read,
// the one before lifts away and the next drops in: its tile first, then its parts one by one.
// Same isometric camera, light and materials as stack.js, whose palette and paper helpers it borrows.
//
// World units: each tile is TW wide (x) and TD deep (y), lying in the x/y plane; z points up.
// The camera looks from the +x/+y side, so faces turned to -x or -y are never seen, and the
// front band of every tile (y > TD - 1) is kept clear for the piece's name.

import {
  C,
  CARD,
  COAL,
  BLUE,
  SANS,
  GRAIN_N,
  GRAIN_WORLD,
  rgb,
  mix,
  clamp,
  easeOutExpo,
  easeOutCubic,
  smooth,
  smoothstep,
  softLock,
  rng,
  hash,
  loop,
  paperGrain,
  roundedRect,
  resample,
  strand,
  edgeFuzz,
} from "./stack.js";

const TW = 12;
const TD = 10.4;
const PLATE_T = 0.3;
const ORDER = ["gateway", "agent", "coders", "portal", "evals", "serving"];
const NAMES = {
  gateway: "Model gateway",
  agent: "Company agent",
  coders: "Coding agents",
  portal: "Company portal",
  evals: "Evaluations",
  serving: "Serving and monitoring",
};
// how tall each piece stands, for framing it on its own; the pinned frame uses the tallest for all
const TALL = { gateway: 1.4, agent: 4.2, coders: 2.3, portal: 2.6, evals: 2.5, serving: 3.6 };
const TALLEST = 3.4;

// The opening: two columns and three rows, read left to right like the page below it.
const HOME = ORDER.map((_, i) => {
  const row = Math.floor(i / 2);
  const col = i % 2;
  return [row * 15 + col * 11.4, row * 15 - col * 11.4];
});

const LANES = [2.4, 6.0, 9.6];
const SCREEN_INK = [241, 235, 223];
const SCREEN_BLUE = [111, 155, 255];
const FAINT = "rgba(70, 66, 60, 0.1)";
const PRINT = "rgba(70, 66, 60, 0.26)";
const TEAMS = [
  ["Routing", 0.91],
  ["Payments", 0.95],
  ["Growth", 0.86],
  ["Platform", 0.91],
  ["Data", 0.81],
];
const easeInCubic = (t) => Math.pow(clamp(t), 3);
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- paper

// A tile torn from a larger sheet, as stack.js tears its sheets: the outer line of the tear (A),
// the inner line where the white fringe meets the face (B), loose fibres and a short fuzz.
function tornTile(seed, w, d) {
  const r = rng(seed);
  const base = resample(roundedRect(0, 0, w, d, 0.45, 6), 0.06);
  const wander = loop(r, 9);
  const ripple = loop(r, 41);
  const tooth = loop(r, 167);
  const fray = loop(r, 520);
  const bite = loop(r, 23);
  const width = loop(r, 57);
  const shred = loop(r, 233);
  const count = base.length;
  const A = [];
  const B = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const [x, y, nx, ny] = base[i];
    const inA = 0.12 + 0.075 * wander(t) + 0.03 * ripple(t) + 0.018 * tooth(t) + 0.015 * fray(t) + 0.05 * Math.max(0, bite(t) - 0.5);
    const fw = 0.026 + 0.08 * Math.pow(0.5 + 0.5 * width(t), 2.2) + 0.016 * Math.abs(shred(t));
    A.push([x - nx * inA, y - ny * inA]);
    B.push([x - nx * (inA + fw), y - ny * (inA + fw)]);
  }
  const fibers = [];
  for (let k = 0; k < 560; k++) {
    const i = (r() * count) | 0;
    const len = 0.03 + r() * r() * 0.18;
    const [sx, sy, ex, ey] = strand(r, A[i][0], A[i][1], base[i][2], base[i][3], 1.9, len, 0.04);
    const bend = (r() - 0.5) * 0.7 * len;
    fibers.push([sx, sy, (sx + ex) / 2 - (ey - sy) * (bend / len), (sy + ey) / 2 + (ex - sx) * (bend / len), ex, ey]);
  }
  const fuzz = [];
  for (let k = 0; k < 950; k++) {
    const i = (r() * count) | 0;
    fuzz.push(strand(r, A[i][0], A[i][1], base[i][2], base[i][3], 2.2, 0.012 + r() * 0.042, 0.02));
  }
  return { A, B, fibers, fuzz };
}

// A part cut from card: a block, a card standing on its edge, or a stack of thin cards.
function cut(pid, id, x, y, w, d, h, paper = CARD, o = {}) {
  const outline = roundedRect(x, y, w, d, o.r ?? (h > 1 ? 0.05 : 0.08), 2);
  const b = { id, x, y, w, d, h, paper, z0: o.z0 || 0, kind: o.kind || "block", outline, glow: 0, order: 0 };
  b.fuzz = edgeFuzz(outline, hash(`${pid}.${id}`), Math.round((w + d) * 24));
  if (b.kind === "stack") {
    const r = rng(hash(`${pid}.${id}.cards`));
    b.cards = Array.from({ length: 12 }, () => roundedRect(x + (r() - 0.5) * 0.1, y + (r() - 0.5) * 0.08, w, d, 0.05, 1));
  }
  return b;
}

// Painter's order: parts on the tile first, then parts standing on other parts; within each, a part
// wholly behind another along y, or else along x, goes first.
function paintOrder(a, b) {
  const la = a.z0 > 0 ? 1 : 0;
  const lb = b.z0 > 0 ? 1 : 0;
  if (la !== lb) return la - lb;
  if (a.y + a.d <= b.y + 1e-6) return -1;
  if (b.y + b.d <= a.y + 1e-6) return 1;
  if (a.x + a.w <= b.x + 1e-6) return -1;
  if (b.x + b.w <= a.x + 1e-6) return 1;
  return a.x + a.w / 2 + a.y + a.d / 2 - (b.x + b.w / 2 + b.y + b.d / 2);
}

// ---------------------------------------------------------------- things that move

// A request (a dot) or a card moving along a path. Each node is [x, y, z] on the piece, and each leg
// names what it rides on, "ground" or a part's id; that decides when it is drawn, so nothing shows
// through a block it has gone behind. Events can fire at nodes, on the way out (fwd) or back.
function mover(nodes, rides, o = {}) {
  const cum = [0];
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1];
    const b = nodes[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return {
    nodes,
    rides,
    cum,
    total: cum[cum.length - 1],
    s: 0,
    dir: 1,
    speed: o.speed || 3.2,
    wait: o.delay || 0,
    until: null,
    look: o.look || "dot",
    ink: !!o.ink,
    fwd: o.fwd || {},
    back: o.back || {},
    onEnd: o.onEnd || null,
    onStart: o.onStart || null,
    fade: o.fade || null,
    data: o.data || {},
    trail: [],
    at: null,
    dead: false,
  };
}

function pointOn(m) {
  const s = clamp(m.s, 0, m.total);
  let i = 0;
  while (i < m.cum.length - 2 && s > m.cum[i + 1]) i++;
  const a = m.nodes[i];
  const b = m.nodes[i + 1];
  const len = m.cum[i + 1] - m.cum[i];
  const t = len > 0 ? (s - m.cum[i]) / len : 0;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, ride: m.rides[i] };
}

function moveAll(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.wait > 0) m.wait -= dt;
    else if (m.until) {
      if (m.until(m)) m.until = null;
    } else {
      const prev = m.s;
      m.s += m.dir * m.speed * dt;
      if (m.dir > 0) {
        for (let k = 1; k < m.cum.length - 1; k++) {
          if (m.fwd[k] && prev < m.cum[k] && m.s >= m.cum[k]) {
            m.s = m.cum[k];
            m.fwd[k](m);
            break;
          }
        }
        if (m.s >= m.total) {
          m.s = m.total;
          m.trail.length = 0;
          if (m.onEnd) m.onEnd(m);
          else m.dead = true;
        }
      } else {
        for (let k = m.cum.length - 2; k >= 1; k--) {
          if (m.back[k] && prev > m.cum[k] && m.s <= m.cum[k]) {
            m.s = m.cum[k];
            m.back[k](m);
            break;
          }
        }
        if (m.s <= 0) {
          m.s = 0;
          if (m.onStart) m.onStart(m);
          m.dead = true;
        }
      }
    }
    if (m.dead) {
      list.splice(i, 1);
      continue;
    }
    m.at = pointOn(m);
    m.trail.push(m.at);
    if (m.trail.length > 11) m.trail.shift();
  }
}

// a line of "words": dashes of varied length, for text too small to set
function wordLine(seed, width) {
  const r = rng(seed);
  const out = [];
  let total = 0;
  while (total < width) {
    const w = 0.22 + r() * 0.62;
    out.push(w);
    total += w + 0.11;
  }
  return out;
}

// ---------------------------------------------------------------- the figure

export function createKit(root, opts = {}) {
  const canvas = root.querySelector("canvas");
  if (!canvas) return null;
  const main = canvas.getContext("2d");
  if (!main) return null;
  const mode = opts.mode || "solo";
  const still = !!opts.reduceMotion;
  const soloIndex = Math.max(0, ORDER.indexOf(opts.piece));

  let ctx = main;
  const grainTile = paperGrain();
  const mainGrain = main.createPattern(grainTile, "repeat");
  let grainFill = mainGrain;
  let buf = null;
  let bctx = null;
  let bufGrain = null;
  let size = null;
  let frames = null;
  let current = [];

  const st = {
    w: 0,
    h: 0,
    dpr: 1,
    time: 0,
    last: 0,
    visible: false,
    raf: 0,
    // the pinned figure's place in the page: -1 the opening, 0 to 5 each piece in turn; where the
    // scroll points, and where the figure has eased to
    posTarget: -1,
    pos: -1,
    yaw: 0,
    pitch: 0,
    yawT: 0,
    pitchT: 0,
    // the opening's tiles drop in one after another; a piece shown on its own is already built
    intro: still || mode === "solo" ? 9 : 0,
  };
  const cam = { s: 20, px: 0, py: 0, ou: 0, ov: 0, cos: Math.SQRT1_2, sin: Math.SQRT1_2, pitch: 0.42 };
  // where the piece being drawn stands, and how far it has been lifted
  const T = { ox: 0, oy: 0, oz: 0 };

  // ---- projection and framing

  function proj(x, y, z) {
    const dx = T.ox + x - cam.px;
    const dy = T.oy + y - cam.py;
    const u = dx * cam.cos - dy * cam.sin;
    const v = (dx * cam.sin + dy * cam.cos) * cam.pitch - (T.oz + z);
    return [st.w / 2 + (u + cam.ou) * cam.s, st.h / 2 + (v + cam.ov) * cam.s];
  }

  // A camera that fits boxes [x0, y0, x1, y1, height] into the frame, at the resting angle.
  function fit(boxes, padX, padY) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const b of boxes) {
      x0 = Math.min(x0, b[0]);
      y0 = Math.min(y0, b[1]);
      x1 = Math.max(x1, b[2]);
      y1 = Math.max(y1, b[3]);
    }
    const px = (x0 + x1) / 2;
    const py = (y0 + y1) / 2;
    const k = Math.SQRT1_2;
    let u0 = Infinity;
    let u1 = -Infinity;
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const b of boxes) {
      for (const x of [b[0], b[2]]) {
        for (const y of [b[1], b[3]]) {
          const u = (x - px - (y - py)) * k;
          const v = (x - px + (y - py)) * k * 0.42;
          u0 = Math.min(u0, u);
          u1 = Math.max(u1, u);
          v0 = Math.min(v0, v - b[4]);
          v1 = Math.max(v1, v + PLATE_T + 0.35);
        }
      }
    }
    const s = Math.max(1, Math.min((st.w - padX) / (u1 - u0), (st.h - padY) / (v1 - v0)));
    return { px, py, s, ou: -(u0 + u1) / 2, ov: -(v0 + v1) / 2 };
  }

  function lerpFrame(a, b, t) {
    return {
      px: lerp(a.px, b.px, t),
      py: lerp(a.py, b.py, t),
      s: Math.exp(lerp(Math.log(a.s), Math.log(b.s), t)),
      ou: lerp(a.ou, b.ou, t),
      ov: lerp(a.ov, b.ov, t),
    };
  }

  function layout() {
    let w;
    let h;
    if (size) {
      w = size.w;
      h = size.h;
    } else {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w !== st.w || h !== st.h || dpr !== st.dpr) {
      st.w = w;
      st.h = h;
      st.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      frames = null;
    }
  }

  function aim() {
    if (!frames) {
      const solo = mode === "solo";
      frames = {
        focus: fit([[0, 0, TW, TD, solo ? TALL[ORDER[soloIndex]] : TALLEST]], solo ? 14 : 48, solo ? 14 : 64),
        all: fit(HOME.map(([x, y], i) => [x, y, x + TW, y + TD, TALL[ORDER[i]]]), 20, 28),
      };
    }
    const yaw = Math.PI / 4 + st.yaw;
    cam.cos = Math.cos(yaw);
    cam.sin = Math.sin(yaw);
    cam.pitch = 0.42 + st.pitch;
    let f;
    if (mode === "solo") f = frames.focus;
    else if (mode === "lineup") f = frames.all;
    else f = st.pos < 0 ? lerpFrame(frames.all, frames.focus, smooth(clamp(st.pos + 1))) : frames.focus;
    cam.px = f.px;
    cam.py = f.py;
    cam.s = f.s;
    cam.ou = f.ou;
    cam.ov = f.ov;
  }

  // ---- drawing primitives

  function set() {
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
  }

  function pathAt(pts, z) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = proj(pts[i][0], pts[i][1], z);
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
    ctx.closePath();
  }

  // The cut edge of a tile or part: a quad for every segment of its outline that faces the camera,
  // shaded by the way it faces, as in stack.js.
  const SHADES = 8;
  function slab(pts, z0, z1, shade, lit, soft = 0) {
    const n = pts.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const sgn = area > 0 ? 1 : -1;
    const lightOf = new Float32Array(n);
    const faces = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      let nx = (b[1] - a[1]) * sgn;
      let ny = -(b[0] - a[0]) * sgn;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      faces[i] = nx * cam.sin + ny * cam.cos > 0 ? 1 : 0;
      lightOf[i] = 0.5 + 0.5 * (ny * cam.sin - nx * cam.cos);
    }
    const paths = new Array(SHADES).fill(null);
    for (let i = 0; i < n; i++) {
      if (!faces[i]) continue;
      const a = pts[i];
      const b = pts[(i + 1) % n];
      let l = lightOf[i];
      if (soft) {
        l = 0;
        for (let j = -soft; j <= soft; j++) l += lightOf[(i + j + n) % n];
        l /= 2 * soft + 1;
      }
      const k = Math.min(SHADES - 1, (l * SHADES) | 0);
      const p = paths[k] || (paths[k] = new Path2D());
      const a0 = proj(a[0], a[1], z0);
      const b0 = proj(b[0], b[1], z0);
      const b1 = proj(b[0], b[1], z1);
      const a1 = proj(a[0], a[1], z1);
      p.moveTo(a0[0], a0[1]);
      p.lineTo(b0[0], b0[1]);
      p.lineTo(b1[0], b1[1]);
      p.lineTo(a1[0], a1[1]);
      p.closePath();
    }
    ctx.lineWidth = 0.75;
    for (let k = 0; k < SHADES; k++) {
      if (!paths[k]) continue;
      const col = rgb(mix(shade, lit, (k + 0.5) / SHADES));
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.fill(paths[k]);
      ctx.stroke(paths[k]);
    }
  }

  // A soft shadow under an outline, falling down and to the right, away from the light.
  function castShadow(pts, z, blur, dx, dy, alpha) {
    const d = st.dpr;
    ctx.save();
    ctx.shadowColor = rgb(C.shadow, alpha);
    ctx.shadowBlur = blur * d;
    ctx.shadowOffsetX = dx * d;
    ctx.shadowOffsetY = dy * d;
    pathAt(pts, z);
    ctx.fillStyle = rgb(C.edgeShade);
    ctx.fill();
    ctx.restore();
  }

  // A tall part's shadow, thrown across the tile away from the light. The shape is drawn far off the
  // canvas and only its shadow is brought back, so only the soft shadow lands.
  function throwShadow(b, alpha) {
    const k = cam.s / 30;
    const sx = b.h * 0.42;
    const sy = b.h * 0.2;
    const x0 = b.x;
    const y0 = b.y;
    const x1 = b.x + b.w;
    const y1 = b.y + b.d;
    const pts = [
      [x0, y0],
      [x1, y0],
      [x1 + sx, y0 + sy],
      [x1 + sx, y1 + sy],
      [x0 + sx, y1 + sy],
      [x0, y1],
    ];
    const off = 4000;
    ctx.save();
    ctx.shadowColor = rgb(C.shadow, alpha);
    ctx.shadowBlur = (5 + b.h * 2.5) * k * st.dpr;
    ctx.shadowOffsetX = off * st.dpr;
    ctx.shadowOffsetY = 0;
    ctx.translate(-off, 0);
    pathAt(pts, 0);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
  }

  // The paper's grain, laid flat on the plane at height z and moving with it.
  function grain(pts, z, sx, sy, alpha) {
    if (!grainFill || alpha <= 0) return;
    const o = proj(-sx, -sy, z);
    const s = cam.s * (GRAIN_WORLD / GRAIN_N);
    grainFill.setTransform(new DOMMatrix([cam.cos * s, cam.sin * cam.pitch * s, -cam.sin * s, cam.cos * cam.pitch * s, o[0], o[1]]));
    pathAt(pts, z);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = grainFill;
    ctx.fill();
    ctx.restore();
  }

  function strands(list, z, color, width) {
    ctx.beginPath();
    for (const f of list) {
      const a = proj(f[0], f[1], z);
      const b = proj(f[2], f[3], z);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function polyline(pts, z, color, width = 1) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = proj(pts[i][0], pts[i][1], z);
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // A line pressed into the paper: a shadowed groove with a lit lip just below it.
  function groove(pts, z) {
    polyline(pts, z, C.groove, 1);
    ctx.save();
    ctx.translate(0, 0.9);
    polyline(pts, z, C.grooveLit, 0.8);
    ctx.restore();
  }

  // Run fn with the canvas mapped onto the horizontal plane at height z, from (x, y), in world units scaled by k.
  function onPlane(x, y, z, k, fn) {
    const o = proj(x, y, z);
    const d = st.dpr;
    const s = cam.s * k;
    ctx.save();
    ctx.setTransform(d * cam.cos * s, d * cam.sin * cam.pitch * s, -d * cam.sin * s, d * cam.cos * cam.pitch * s, d * o[0], d * o[1]);
    fn();
    ctx.restore();
  }

  // Run fn on the upright face turned to +y, in world units from its top left corner (x, y, z), downward.
  function onWallY(x, y, z, fn) {
    const o = proj(x, y, z);
    const d = st.dpr;
    ctx.save();
    ctx.setTransform(d * cam.cos * cam.s, d * cam.sin * cam.pitch * cam.s, 0, d * cam.s, d * o[0], d * o[1]);
    fn();
    ctx.restore();
  }

  // Printed labels are set at 11px or more, or left out.
  const minPx = () => 11;

  function setText(size, color, weight) {
    ctx.font = `${weight} 100px ${SANS}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
  }

  // Text printed flat on a surface at height z, its baseline at y.
  function label(text, x, y, z, size, color, weight = 500, min = minPx(), align = "left") {
    if (size * cam.s < min) return;
    onPlane(x, y, z + 0.004, size / 100, () => {
      setText(size, color, weight);
      ctx.textAlign = align;
      ctx.fillText(text, 0, 0);
    });
  }

  // The same, running along -y: up the page and to the right.
  function labelY(text, x, y, z, size, color, weight = 500) {
    if (size * cam.s < minPx()) return;
    onPlane(x, y, z + 0.004, size / 100, () => {
      ctx.rotate(-Math.PI / 2);
      setText(size, color, weight);
      ctx.fillText(text, 0, 0);
    });
  }

  // Text on an upright face, inside onWallY, its baseline at y.
  function wallText(text, x, y, size, color, weight = 500) {
    if (size * cam.s < minPx()) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 100, size / 100);
    setText(size, color, weight);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // Dashes of varied length standing for words, revealed left to right up to `upto`.
  function words(list, x, y, h, upto, color) {
    let at = x;
    ctx.fillStyle = color;
    for (const w of list) {
      if (at - x >= upto) break;
      const ww = Math.min(w, x + upto - at);
      if (ww > 0.01) ctx.fillRect(at, y, ww, h);
      at += w + 0.11;
    }
  }

  // A ring that spreads and fades on a surface, where a request has just arrived.
  function ripple(x, y, z, r, color, alpha) {
    const ring = [];
    for (let k = 0; k <= 24; k++) ring.push([x + Math.cos((k / 24) * Math.PI * 2) * r, y + Math.sin((k / 24) * Math.PI * 2) * r]);
    polyline(ring, z, rgb(color, alpha), 1.2);
  }

  // A key, printed flat: its bow, its blade and two teeth.
  function keyGlyph(x, y, z, k, color) {
    onPlane(x, y, z + 0.004, k, () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.075;
      ctx.beginPath();
      ctx.arc(0.16, 0, 0.15, 0, Math.PI * 2);
      ctx.moveTo(0.31, 0);
      ctx.lineTo(0.78, 0);
      ctx.moveTo(0.62, 0);
      ctx.lineTo(0.62, 0.12);
      ctx.moveTo(0.73, 0);
      ctx.lineTo(0.73, 0.1);
      ctx.stroke();
    });
  }

  // A tick or a cross, printed flat.
  function mark(kind, x, y, z, k, color) {
    onPlane(x, y, z + 0.004, k, () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.09;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      if (kind === "ok") {
        ctx.moveTo(-0.16, 0);
        ctx.lineTo(-0.04, 0.12);
        ctx.lineTo(0.18, -0.14);
      } else {
        ctx.moveTo(-0.12, -0.12);
        ctx.lineTo(0.12, 0.12);
        ctx.moveTo(0.12, -0.12);
        ctx.lineTo(-0.12, 0.12);
      }
      ctx.stroke();
    });
  }

  // three short printed lines, as on a record or a task card
  function cardLines(x, y, z, w, color = PRINT) {
    onPlane(x, y, z + 0.003, 1, () => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w * 0.5, 0.07);
      ctx.fillRect(0, 0.2, w * 0.68, 0.07);
      ctx.fillRect(0, 0.4, w * 0.36, 0.07);
    });
  }

  // A small card lying at (x, y), its underside at z: a record, a task, a settings file, a model release.
  function cardAt(x, y, z, o) {
    const w = o.w || 0.5;
    const d = o.d || 0.36;
    const h = o.h || 0.04;
    const paper = o.paper || CARD;
    let y0 = y - d / 2;
    if (o.clipY != null) y0 = Math.max(y0, o.clipY);
    const dd = y + d / 2 - y0;
    if (dd <= 0.01) return;
    const outline = roundedRect(x - w / 2, y0, w, dd, 0.03, 1);
    const k = cam.s / 30;
    castShadow(outline, z, 5 * k, 1.6 * k, 2.6 * k, 0.22);
    slab(outline, z, z + h, paper.shade, paper.lit);
    pathAt(outline, z + h);
    ctx.fillStyle = rgb(paper.top);
    ctx.fill();
    ctx.strokeStyle = paper.edge;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    if (o.lines && dd > d * 0.7) {
      onPlane(x - w / 2 + 0.08, y - d / 2 + 0.09, z + h + 0.003, 1, () => {
        ctx.fillStyle = paper === BLUE ? "rgba(255, 255, 255, 0.6)" : PRINT;
        ctx.fillRect(0, 0, w * 0.5, 0.05);
        ctx.fillRect(0, 0.11, w * 0.72, 0.05);
        if (d > 0.4) ctx.fillRect(0, 0.22, w * 0.38, 0.05);
      });
    }
    if (o.mark) mark(o.mark, x + w * 0.24, y + d * 0.1, z + h, 0.85, rgb(C.ink, 0.85));
  }

  // ---- tiles, parts and stacks

  function drawTile(p, lift) {
    const sheet = p.tile;
    const k = cam.s / 30;
    const up = clamp(lift / 5);
    castShadow(sheet.A, -PLATE_T, (16 + 14 * up) * k, (5 + 4 * up) * k, (11 + 10 * up) * k, 0.2 - 0.06 * up);
    slab(sheet.A, -PLATE_T, 0, C.edgeShade, C.edgeLit, 3);
    pathAt(sheet.A, 0);
    ctx.fillStyle = rgb(C.fringe);
    ctx.fill();
    const l = proj(0, TD, 0);
    const r = proj(TW, 0, 0);
    const g = ctx.createLinearGradient(l[0], l[1], r[0], r[1]);
    g.addColorStop(0, rgb(mix(C.sheet[2], [255, 255, 255], 0.22)));
    g.addColorStop(1, rgb(mix(C.sheet[2], C.edgeShade, 0.1)));
    pathAt(sheet.B, 0);
    ctx.fillStyle = g;
    ctx.fill();
    grain(sheet.A, 0, 1.7 + p.index * 2.3, 2.9 + p.index * 1.9, 1);
    if (cam.s > 13) {
      ctx.beginPath();
      for (const f of sheet.fibers) {
        const a = proj(f[0], f[1], 0);
        const m = proj(f[2], f[3], 0);
        const b = proj(f[4], f[5], 0);
        ctx.moveTo(a[0], a[1]);
        ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
      }
      ctx.strokeStyle = C.fiber;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    if (cam.s > 18) strands(sheet.fuzz, 0, C.fuzz, 0.45);
  }

  function drawBlock(b, grow) {
    const h = b.h * grow;
    if (h < 0.004) {
      // not risen yet: only its outline, pressed into the card below
      pathAt(b.outline, 0.003);
      ctx.strokeStyle = "rgba(70, 66, 60, 0.12)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      return 0;
    }
    const paper = b.paper;
    const k = cam.s / 30;
    if (b.h > 1) throwShadow(b, 0.13 * grow);
    castShadow(b.outline, 0, 8 * k, 2.4 * k, 3.8 * k, 0.24);
    slab(b.outline, 0, h, paper.shade, paper.lit);
    pathAt(b.outline, h);
    ctx.fillStyle = rgb(mix(paper.top, paper === BLUE ? C.blueLit : C.blueTint, clamp(b.glow) * 0.6));
    ctx.fill();
    grain(b.outline, h, b.x * 1.31, b.y * 0.77, paper.grain);
    pathAt(b.outline, h);
    ctx.strokeStyle = paper.edge;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    if (cam.s > 16) strands(b.fuzz, h, paper.fuzz, 0.45);
    return h;
  }

  // A stack of thin cards: usage records, tasks. The newest lands on top; a full stack files some away.
  function drawStack(p, b, grow) {
    const S = p.s.stacks[b.id];
    const n = Math.max(0, Math.round(S.n * grow));
    const k = cam.s / 30;
    const filing = Math.min(1, S.file);
    for (let i = 0; i < n; i++) {
      const outline = b.cards[i % b.cards.length];
      let z = i * 0.07;
      let a = 1;
      if (i === n - 1 && S.land < 1) z += (1 - easeOutCubic(S.land)) * 0.55;
      if (S.file > 0 && i >= S.keep) {
        z += (1 - filing) * 1.4;
        a = filing;
      }
      ctx.save();
      ctx.globalAlpha *= a;
      if (i === 0) castShadow(outline, 0, 7 * k, 2 * k, 3.2 * k, 0.22);
      slab(outline, z, z + 0.05, CARD.shade, CARD.lit);
      pathAt(outline, z + 0.05);
      ctx.fillStyle = rgb(CARD.top);
      ctx.fill();
      ctx.strokeStyle = CARD.edge;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }
    return n ? (n - 1) * 0.07 + 0.05 : 0;
  }

  function ping(p, ride, x, y, z, r0 = 0.22, color = C.blue) {
    p.pings.push({ ride, x, y, z, r0, color, t: 1 });
  }

  function drawPings(p, ride) {
    for (const g of p.pings) if (g.ride === ride) ripple(g.x, g.y, g.z + 0.004, g.r0 + 0.5 * (1 - g.t), g.color, 0.75 * g.t);
  }

  // Requests are blue paper dots on their way in; answers come back as dots of ink.
  function drawMovers(p, ride) {
    const r0 = clamp(cam.s * 0.085, 2, 3.6);
    const d = st.dpr;
    for (const m of p.movers) {
      const pt = m.at;
      if (!pt || pt.ride !== ride) continue;
      const fade = m.fade ? clamp(m.fade(pt, m)) : 1;
      if (fade <= 0.01) continue;
      if (m.look !== "dot") {
        ctx.save();
        ctx.globalAlpha *= fade;
        cardAt(pt.x, pt.y, pt.z, m.data);
        ctx.restore();
        continue;
      }
      const col = m.ink ? C.ink : C.blue;
      const tr = m.trail;
      ctx.lineCap = "round";
      for (let i = 1; i < tr.length; i++) {
        if (tr[i].ride !== ride || tr[i - 1].ride !== ride) continue;
        const a = proj(tr[i - 1].x, tr[i - 1].y, tr[i - 1].z);
        const b = proj(tr[i].x, tr[i].y, tr[i].z);
        const k = i / tr.length;
        ctx.strokeStyle = rgb(col, (m.ink ? 0.24 : 0.34) * k * fade);
        ctx.lineWidth = 0.5 + 1.4 * k;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      const q = proj(pt.x, pt.y, pt.z);
      ctx.save();
      ctx.shadowColor = rgb(C.shadow, 0.36 * fade);
      ctx.shadowBlur = 3 * d;
      ctx.shadowOffsetX = 1 * d;
      ctx.shadowOffsetY = 1.6 * d;
      ctx.fillStyle = rgb(col, fade);
      ctx.beginPath();
      ctx.arc(q[0], q[1], r0 * (m.data.r || 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- the six pieces

  // 1. Model gateway: calls from a person's, a team's and an app's keys meet the gateway, which checks
  // each key and its rate limit, writes a usage record for every call, and sends each on to your own
  // models or out to a frontier model. A caller over its limit waits at its slot until the limit drains.
  function gatewayCall(p, lane, frontier) {
    const s = p.s;
    const x = LANES[lane];
    const nodes = [
      [x, 7.6, 0.16],
      [x, 6.8, 0.16],
      [x, 6.72, 0.02],
      [x, 5.86, 0.02],
      [x, 5.86, 0.55],
      [x, 5.25, 0.55],
      [x, 4.2, 0.55],
      [x, 4.14, 0.02],
      [x, 3.6, 0.02],
    ];
    if (frontier) nodes.push([10.5, 3.6, 0.02], [10.5, -0.9, 0.02]);
    else nodes.push([3.4, 3.6, 0.02], [3.4, 2.98, 0.02]);
    const caller = ["person", "team", "app"][lane];
    const rides = [caller, "ground", "ground", "gw", "gw", "gw", "ground", "ground", "ground", "ground"];
    const pass = () => {
      s.flash[lane] = 1;
      s.meter[lane] = Math.min(1, s.meter[lane] + 0.3);
      const L = s.stacks.ledger;
      if (L.file > 0) return;
      L.n += 1;
      L.land = 0;
      if (L.n >= 9) L.file = 1.8;
    };
    p.movers.push(
      mover(nodes, rides, {
        speed: 3.4,
        fwd: {
          5: (m) => {
            if (s.meter[lane] > 0.82) m.until = () => (s.meter[lane] < 0.5 ? (pass(), true) : false);
            else pass();
          },
        },
        back: { 5: () => (s.flash[lane] = Math.max(s.flash[lane], 0.5)) },
        onEnd: (m) => {
          m.dir = -1;
          m.ink = true;
          if (frontier) m.wait = 0.6;
          else {
            m.wait = 0.4;
            p.by.models.glow = 0.9;
            ping(p, "models", 3.4, 2.0, 0.6);
          }
        },
        fade: frontier ? (pt) => (pt.y + 0.5) / 0.9 : null,
      })
    );
  }

  const gatewayDef = {
    setup(p, add) {
      add("person", 1.0, 6.8, 2.8, 1.6, 0.16);
      add("team", 4.6, 6.8, 2.8, 1.6, 0.16);
      add("app", 8.2, 6.8, 2.8, 1.6, 0.16);
      add("gw", 0.8, 4.2, 10.4, 1.6, 0.55);
      add("models", 1.0, 0.9, 3.6, 2.0, 0.6, BLUE);
      add("ledger", 5.4, 1.1, 2.0, 1.4, 0, CARD, { kind: "stack" });
      p.grooves = [
        ...LANES.map((x) => [
          [x, 6.8],
          [x, 5.8],
        ]),
        ...LANES.map((x) => [
          [x, 4.2],
          [x, 3.6],
        ]),
        [
          [2.4, 3.6],
          [10.5, 3.6],
        ],
        [
          [3.4, 3.6],
          [3.4, 2.9],
        ],
        [
          [10.5, 3.6],
          [10.5, -0.9],
        ],
      ];
      p.s = { meter: [0.15, 0.3, 0.45], flash: [0, 0, 0], stacks: { ledger: { n: 6, land: 1, file: 0, keep: 4 } }, next: 0.2 };
    },
    step(p, dt) {
      const s = p.s;
      for (let k = 0; k < 3; k++) {
        s.meter[k] = Math.max(0, s.meter[k] - dt * 0.13);
        s.flash[k] = Math.max(0, s.flash[k] - dt * 2.2);
      }
      if (still) return;
      s.next -= dt;
      if (s.next <= 0 && p.movers.length < 6) {
        s.next = 0.55 + Math.random() * 0.45;
        const r = Math.random();
        gatewayCall(p, r < 0.24 ? 0 : r < 0.54 ? 1 : 2, Math.random() < 0.35);
      }
    },
    print() {
      label("Usage records", 5.4, 3.22, 0, 0.32, rgb(C.ink, 0.6));
      labelY("To frontier models", 11.0, 3.35, 0, 0.32, rgb(C.ink, 0.55));
    },
    decorate(p, b, top) {
      const s = p.s;
      if (b.id === "person" || b.id === "team" || b.id === "app") {
        label({ person: "Person", team: "Team", app: "App" }[b.id], b.x + 0.3, b.y + 1.02, top, 0.36, C.label);
        keyGlyph(b.x + b.w - 1.1, b.y + 0.8, top, 1, rgb(C.ink, 0.6));
      } else if (b.id === "gw") {
        label("Model gateway", b.x + 0.35, b.y + 0.6, top, 0.42, C.label, 600);
        label("OpenAI · Anthropic", 2.85, b.y + 1.46, top, 0.32, rgb(C.ink, 0.55));
        onPlane(0, 0, top + 0.004, 1, () => {
          for (let k = 0; k < 3; k++) {
            const x = LANES[k];
            // the key slot, which lights as a key is accepted
            ctx.fillStyle = rgb(C.hole, 0.8);
            ctx.fillRect(x - 0.06, 5.0, 0.12, 0.5);
            if (s.flash[k] > 0.02) {
              ctx.fillStyle = rgb(C.blue, 0.55 * s.flash[k]);
              ctx.fillRect(x - 0.13, 4.94, 0.26, 0.62);
            }
            // the caller's rate limit: a meter that fills with each call, and the line it may not pass
            ctx.fillStyle = FAINT;
            ctx.fillRect(x + 0.3, 5.14, 0.95, 0.15);
            ctx.fillStyle = rgb(C.blue, 0.5 + 0.4 * s.meter[k]);
            ctx.fillRect(x + 0.3, 5.14, 0.95 * clamp(s.meter[k]), 0.15);
            ctx.fillStyle = rgb(C.ink, 0.45);
            ctx.fillRect(x + 0.3 + 0.95 * 0.82, 5.08, 0.02, 0.27);
          }
        });
      } else if (b.id === "models") {
        label("Your models", b.x + 0.35, b.y + b.d - 0.42, top, 0.36, BLUE.text);
      } else if (b.id === "ledger") {
        cardLines(b.x + 0.22, b.y + 0.3, top, b.w);
      }
    },
  };

  // 2. Company agent: an employee signs in with their company identity, asks, and the question passes
  // your data rules on its way to your own models; the route to frontier models is closed by a rule.
  function agentCall(p) {
    const s = p.s;
    const nodes = [
      [7.0, 3.3, 0.02],
      [7.0, 4.2, 0.02],
      [7.46, 4.2, 0.02],
      [7.56, 4.2, 0.14],
      [8.6, 4.2, 0.14],
      [8.6, 3.72, 0.14],
      [8.6, 3.64, 0.02],
      [8.6, 2.56, 0.02],
    ];
    const rides = ["ground", "ground", "ground", "rules", "rules", "ground", "ground"];
    p.movers.push(
      mover(nodes, rides, {
        speed: 4.2,
        fwd: {
          4: (m) => {
            p.by.rules.glow = 1;
            m.wait = 0.3;
          },
        },
        onEnd: (m) => {
          m.dir = -1;
          m.ink = true;
          m.wait = 0.45;
          p.by.models.glow = 0.9;
          ping(p, "models", 9.6, 1.7, 0.55);
        },
        onStart: () => (s.answerAt = s.phase),
      })
    );
  }

  // a call meant for a frontier model: your data rules send it nowhere, and it stops at the closed gate
  function blocked(p) {
    const s = p.s;
    p.movers.push(
      mover(
        [
          [8.6, 4.2, 0.14],
          [9.66, 4.2, 0.14],
          [9.76, 4.2, 0.02],
          [10.46, 4.2, 0.02],
        ],
        ["rules", "rules", "ground"],
        {
          speed: 3.2,
          onEnd: (m) => {
            if (m.data.done) {
              m.dead = true;
              return;
            }
            m.data.done = true;
            s.shut = 1;
            m.wait = 0.6;
          },
          fade: (pt, m) => (m.data.done ? m.wait / 0.6 : 1),
        }
      )
    );
  }

  function identity(p) {
    const s = p.s;
    p.movers.push(
      mover(
        [
          [8.5, 7.1, 0.08],
          [7.86, 7.1, 0.02],
          [5.0, 7.1, 0.02],
          [5.0, 3.32, 0.02],
        ],
        ["badge", "ground", "ground"],
        {
          speed: 4.4,
          data: { r: 0.8 },
          onEnd: (m) => {
            m.dead = true;
            s.signinAt = s.phase;
          },
        }
      )
    );
  }

  // a message on the chat card: a light block holding a line of words, right-aligned like a sent message
  function bubble(right, y, w, h, list, reveal, color) {
    ctx.fillStyle = `rgba(70, 66, 60, ${0.075 * Math.min(1, reveal * 3)})`;
    ctx.fillRect(right - w, y, w, h);
    words(list, right - w + 0.17, y + h / 2 - 0.06, 0.12, (w - 0.34) * reveal, color);
  }

  const agentDef = {
    setup(p, add) {
      add("panel", 1.2, 3.0, 6.2, 0.22, 4.0, CARD, { r: 0.04 });
      add("badge", 7.9, 6.2, 3.0, 1.8, 0.08);
      add("rules", 7.5, 3.7, 2.2, 1.0, 0.14);
      add("models", 8.2, 0.9, 2.8, 1.6, 0.55, BLUE);
      add("gate", 10.52, 3.5, 0.26, 1.4, 0.42, COAL, { r: 0.04 });
      p.grooves = [
        [
          [7.0, 3.3],
          [7.0, 4.2],
          [7.5, 4.2],
        ],
        [
          [8.6, 3.7],
          [8.6, 2.5],
        ],
        [
          [9.7, 4.2],
          [12.8, 4.2],
        ],
        [
          [7.9, 7.1],
          [5.0, 7.1],
          [5.0, 3.3],
        ],
      ];
      p.s = {
        phase: 0.9,
        signed: false,
        asked: false,
        tried: false,
        shut: 0,
        answerAt: -1,
        signinAt: -1,
        q1: wordLine(11, 2.9),
        a1: [wordLine(12, 5.2), wordLine(13, 4.5), wordLine(14, 2.7)],
        q2: wordLine(15, 2.0),
      };
    },
    step(p, dt) {
      const s = p.s;
      s.shut = Math.max(0, s.shut - dt * 0.9);
      if (still) {
        s.phase = 8.4;
        s.answerAt = 4.0;
        s.signinAt = 1.0;
        return;
      }
      const prev = s.phase;
      s.phase = (s.phase + dt) % 11;
      if (s.phase < prev) {
        s.signed = false;
        s.asked = false;
        s.tried = false;
        s.answerAt = -1;
        s.signinAt = -1;
      }
      if (!s.tried && s.phase > 7.0) {
        s.tried = true;
        blocked(p);
      }
      if (!s.signed && s.phase > 0.15) {
        s.signed = true;
        p.by.badge.glow = 1;
        ping(p, "badge", 9.4, 7.1, 0.08, 0.3);
        identity(p);
      }
      if (!s.asked && s.phase > 1.2) {
        s.asked = true;
        agentCall(p);
      }
    },
    print() {
      label("Company sign-in", 7.9, 8.78, 0, 0.32, rgb(C.ink, 0.6));
      label("Frontier", 10.05, 5.5, 0, 0.32, rgb(C.ink, 0.55));
    },
    decorate(p, b, top) {
      const s = p.s;
      if (b.id === "panel") {
        const f = s.phase;
        const fade = 1 - smoothstep(10.0, 10.6, f);
        onWallY(b.x, b.y + b.d, top, () => {
          wallText("Company agent", 0.32, 0.48, 0.32, rgb(C.ink, 0.62), 600);
          ctx.fillStyle = "rgba(70, 66, 60, 0.12)";
          ctx.fillRect(0.3, 0.66, 5.6, 0.012);
          // once signed in, the person shows in the corner
          if (s.signinAt >= 0 && f >= s.signinAt) {
            ctx.fillStyle = rgb(C.ink, 0.38 * fade);
            ctx.fillRect(4.75, 0.31, 0.8, 0.1);
            ctx.fillStyle = rgb(C.ink, 0.6 * fade);
            ctx.fillRect(5.66, 0.27, 0.17, 0.17);
          }
          ctx.save();
          ctx.globalAlpha *= fade;
          const r1 = clamp((f - 0.55) / 0.5);
          if (r1 > 0) bubble(5.9, 0.95, 3.25, 0.52, s.q1, r1, rgb(C.ink, 0.55));
          for (let k = 0; k < 3; k++) {
            const r = s.answerAt >= 0 ? clamp((f - s.answerAt - k * 0.45) / 0.45) : 0;
            if (r > 0) words(s.a1[k], 0.36, 1.78 + k * 0.36, 0.13, 5.2 * r, rgb(C.blue, 0.82));
          }
          const r2 = s.answerAt >= 0 ? clamp((f - s.answerAt - 1.8) / 0.45) : 0;
          if (r2 > 0) bubble(5.9, 2.95, 2.35, 0.52, s.q2, r2, rgb(C.ink, 0.55));
          ctx.restore();
          // the box where the next question is typed, its caret blinking
          ctx.strokeStyle = "rgba(70, 66, 60, 0.2)";
          ctx.lineWidth = 1 / cam.s;
          ctx.strokeRect(0.3, 3.55, 5.6, 0.32);
          if (still || Math.floor(p.t * 1.6) % 2 === 0) {
            ctx.fillStyle = rgb(C.ink, 0.55);
            ctx.fillRect(0.45, 3.62, 0.02, 0.18);
          }
        });
      } else if (b.id === "badge") {
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          ctx.fillStyle = "rgba(70, 66, 60, 0.16)";
          ctx.fillRect(0.25, 0.3, 0.9, 1.0);
          ctx.fillStyle = rgb(C.ink, 0.5);
          ctx.fillRect(1.4, 0.52, 1.2, 0.13);
          ctx.fillStyle = rgb(C.ink, 0.28);
          ctx.fillRect(1.4, 0.82, 0.8, 0.1);
          ctx.fillStyle = "rgba(70, 66, 60, 0.18)";
          ctx.fillRect(0.25, 1.48, 2.5, 0.12);
        });
      } else if (b.id === "rules") {
        label("Data rules", b.x + 0.22, b.y + 0.7, top, 0.32, C.label, 600);
      } else if (b.id === "models") {
        label("Your models", b.x + 0.3, b.y + b.d - 0.36, top, 0.34, BLUE.text);
      } else if (b.id === "gate") {
        // the closed gate: a cross on its top, which flares as a call is turned away
        mark("no", b.x + b.w / 2, b.y + b.d / 2, top, 1.3, rgb(SCREEN_INK, 0.45 + 0.5 * s.shut));
      }
    },
  };

  // 3. Coding agents: three developer laptops running OpenCode. Managed settings roll out to each from
  // your device management, a doctor checks each machine, and every call goes to your gateway.
  const LAP = [0.9, 4.5, 8.1];

  function settings(p, i) {
    const x = LANES[i];
    p.movers.push(
      mover(
        [
          [6.0, 2.46, 0.02],
          [6.0, 3.4, 0.02],
          [x, 3.4, 0.02],
          [x, 5.5, 0.02],
        ],
        ["ground", "ground", "ground"],
        {
          speed: 2.6,
          delay: i * 0.35,
          look: "card",
          data: { w: 0.5, d: 0.34, lines: true },
          onEnd: (m) => {
            m.dead = true;
            p.s.sweep[i] = 0;
          },
        }
      )
    );
  }

  function coderCall(p, i) {
    const x = LANES[i];
    p.movers.push(
      mover(
        [
          [x, 5.5, 0.02],
          [x, 3.4, 0.02],
          [0.6, 3.4, 0.02],
          [0.6, -0.9, 0.02],
        ],
        ["ground", "ground", "ground"],
        {
          speed: 3.4,
          onEnd: (m) => {
            m.dir = -1;
            m.ink = true;
            m.wait = 0.5;
          },
          onStart: () => {
            const c = p.s.code[i];
            if (c.sugg === 0) c.sugg = 0.001;
          },
          fade: (pt) => (pt.y + 0.5) / 0.9,
        }
      )
    );
  }

  const coderDef = {
    setup(p, add) {
      LAP.forEach((x, i) => {
        add(`base${i}`, x, 5.6, 3.0, 2.2, 0.14);
        add(`screen${i}`, x + 0.15, 5.62, 2.7, 0.15, 1.9, COAL, { r: 0.03, z0: 0.14 });
      });
      add("mdm", 4.4, 1.0, 3.2, 1.4, 0.4);
      p.grooves = [
        [
          [0.6, -0.9],
          [0.6, 3.4],
          [9.6, 3.4],
        ],
        [
          [6.0, 2.4],
          [6.0, 3.4],
        ],
        ...LANES.map((x) => [
          [x, 3.4],
          [x, 5.6],
        ]),
      ];
      p.s = {
        code: LAP.map((_, i) => ({ t: 1.5 + i * 2.7, sugg: 0 })),
        sweep: [-1, -1, -1],
        ok: [1, 1, 1],
        roll: 4,
        next: 0.4,
        lines: LAP.map((_, i) => [2.0, 1.6, 1.8, 1.1, 1.7, 1.3].map((w, k) => wordLine(100 + i * 10 + k, w))),
        sugLine: LAP.map((_, i) => wordLine(200 + i, 1.5)),
      };
    },
    step(p, dt) {
      const s = p.s;
      for (let i = 0; i < 3; i++) {
        const c = s.code[i];
        const before = c.t;
        c.t = (c.t + dt * (0.85 + i * 0.07)) % 9;
        if (c.t < before) c.sugg = 0;
        if (c.sugg > 0) c.sugg = Math.min(1, c.sugg + dt / 0.7);
        if (s.sweep[i] >= 0) {
          s.sweep[i] += dt / 0.9;
          if (s.sweep[i] >= 1) {
            s.sweep[i] = -1;
            s.ok[i] = 1;
          }
        }
      }
      if (still) {
        for (const c of s.code) {
          c.t = 6;
          c.sugg = 1;
        }
        return;
      }
      s.roll -= dt;
      if (s.roll <= 0) {
        s.roll = 14;
        LAP.forEach((_, i) => {
          s.ok[i] = 0;
          settings(p, i);
        });
      }
      s.next -= dt;
      if (s.next <= 0) {
        s.next = 0.7 + Math.random() * 0.8;
        if (p.movers.filter((m) => m.look === "dot").length < 4) coderCall(p, (Math.random() * 3) | 0);
      }
    },
    print() {
      label("To your gateway", 0.95, 1.55, 0, 0.32, rgb(C.ink, 0.6));
    },
    decorate(p, b, top) {
      const s = p.s;
      if (b.id.startsWith("screen")) {
        const i = Number(b.id.slice(6));
        const c = s.code[i];
        const wipe = 1 - smoothstep(8.2, 8.9, c.t);
        onWallY(b.x, b.y + b.d, top, () => {
          ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
          ctx.fillRect(0.1, 0.1, 2.5, 1.62);
          ctx.fillStyle = rgb(SCREEN_INK, 0.3);
          ctx.fillRect(0.2, 0.22, 0.42, 0.06);
          const IND = [0, 0.22, 0.22, 0.44, 0.22, 0];
          for (let k = 0; k < 6; k++) {
            const r = clamp((c.t - k * 0.55) / 0.45) * wipe;
            if (r > 0) words(s.lines[i][k], 0.22 + IND[k], 0.42 + k * 0.16, 0.06, 2.1 * r, rgb(SCREEN_INK, 0.55));
          }
          // the agent's suggestion, typed in blue once its answer comes back from the gateway
          if (c.sugg > 0) words(s.sugLine[i], 0.44, 1.38, 0.06, 1.6 * c.sugg * wipe, rgb(SCREEN_BLUE, 0.95));
          // the doctor's pass over the machine, then its result
          if (s.sweep[i] >= 0) {
            ctx.fillStyle = rgb(SCREEN_INK, 0.13);
            ctx.fillRect(0.1, 0.1 + s.sweep[i] * 1.5, 2.5, 0.12);
          }
          ctx.fillStyle = s.ok[i] ? rgb(C.ok, 0.95) : rgb(SCREEN_INK, 0.22);
          ctx.fillRect(2.3, 1.56, 0.16, 0.08);
        });
      } else if (b.id.startsWith("base")) {
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          ctx.fillStyle = "rgba(70, 66, 60, 0.085)";
          for (let r = 0; r < 4; r++) for (let k = 0; k < 11; k++) ctx.fillRect(0.24 + k * 0.235, 0.36 + r * 0.24, 0.18, 0.16);
          ctx.strokeStyle = "rgba(70, 66, 60, 0.13)";
          ctx.lineWidth = 1.2 / cam.s;
          ctx.strokeRect(1.0, 1.4, 1.0, 0.6);
        });
      } else if (b.id === "mdm") {
        label("Managed settings", b.x + 0.22, b.y + 0.58, top, 0.32, C.label, 600);
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          ctx.fillStyle = "rgba(70, 66, 60, 0.2)";
          [1.6, 1.15, 1.9].forEach((w, k) => ctx.fillRect(0.25, 0.78 + k * 0.17, w, 0.07));
        });
      }
    },
  };

  // 4. Company portal: the gateway's records and read-only Git figures feed a paper dashboard: weekly
  // active developers by team as a row of blue columns at the back, delivery charted on a card in front,
  // and members and keys beside it.
  const BAR_X = (k) => 3.45 + k * 1.6;

  function pickTeam() {
    const sum = TEAMS.reduce((a, t) => a + t[1], 0);
    let r = Math.random() * sum;
    for (let k = 0; k < TEAMS.length; k++) {
      r -= TEAMS[k][1];
      if (r <= 0) return k;
    }
    return 0;
  }

  function recordIn(p) {
    const R = p.s.stacks.records;
    p.movers.push(
      mover(
        [
          [-0.9, 4.05, 0.02],
          [0.42, 4.05, 0.02],
        ],
        ["ground"],
        {
          speed: 3.2,
          fade: (pt) => (pt.x + 0.6) / 0.9,
          onEnd: (m) => {
            m.dead = true;
            R.n += 1;
            R.land = 0;
          },
        }
      )
    );
  }

  function recordOut(p) {
    const R = p.s.stacks.records;
    R.n -= 1;
    const z = R.n * 0.07 + 0.05;
    const k = pickTeam();
    const bx = BAR_X(k) + 0.425;
    p.movers.push(
      mover(
        [
          [1.4, 4.05, z],
          [2.3, 4.05, z],
          [2.38, 4.05, 0.02],
          [2.94, 4.05, 0.02],
          [3.06, 4.05, 0.22],
          [bx, 4.05, 0.22],
        ],
        ["records", "records", "ground", "ground", "table"],
        {
          speed: 2.6,
          look: "card",
          data: { w: 0.42, d: 0.3, lines: true },
          onEnd: (m) => {
            m.dead = true;
            p.s.bump[k] = Math.min(0.5, p.s.bump[k] + 0.22);
            ping(p, "table", bx, 4.05, 0.22, 0.18);
          },
        }
      )
    );
  }

  function gitDot(p) {
    p.movers.push(
      mover(
        [
          [1.9, 6.6, 0.1],
          [2.3, 6.6, 0.1],
          [2.38, 6.6, 0.02],
          [2.94, 6.6, 0.02],
          [3.06, 6.6, 0.22],
          [3.36, 6.6, 0.22],
          [3.52, 6.6, 0.27],
        ],
        ["git", "git", "ground", "ground", "table", "chart"],
        {
          speed: 2.8,
          ink: true,
          onEnd: (m) => {
            m.dead = true;
            const c = p.s.chart;
            c.push(clamp(c[c.length - 1] + (Math.random() - 0.5) * 0.12, 0.42, 0.72));
            c.shift();
            ping(p, "chart", 3.62, 6.6, 0.27, 0.16, C.ink);
          },
        }
      )
    );
  }

  const portalDef = {
    setup(p, add) {
      add("table", 3.0, 0.9, 8.3, 7.3, 0.22);
      add("records", 0.5, 3.35, 1.8, 1.4, 0, CARD, { kind: "stack" });
      add("git", 0.5, 5.9, 1.8, 1.4, 0.1);
      TEAMS.forEach(([, v], k) => add(`bar${k}`, BAR_X(k), 1.35, 0.85, 0.8, 0.35 + 2.0 * v, BLUE, { z0: 0.22, r: 0.04 }));
      add("chart", 3.4, 4.7, 4.0, 3.0, 0.05, CARD, { z0: 0.22, r: 0.05 });
      add("members", 7.8, 4.7, 3.2, 3.0, 0.05, CARD, { z0: 0.22, r: 0.05 });
      p.grooves = [
        [
          [-0.9, 4.05],
          [0.5, 4.05],
        ],
        [
          [2.3, 4.05],
          [3.0, 4.05],
        ],
        [
          [2.3, 6.6],
          [3.0, 6.6],
        ],
      ];
      p.s = {
        bump: TEAMS.map(() => 0),
        chart: [0.52, 0.58, 0.55, 0.62, 0.57, 0.64, 0.6, 0.66, 0.61, 0.63, 0.67, 0.64],
        stacks: { records: { n: 6, land: 1, file: 0, keep: 6 } },
        inNext: 0.3,
        outNext: 0.9,
        gitNext: 1.8,
      };
    },
    step(p, dt) {
      const s = p.s;
      TEAMS.forEach(([, v], k) => {
        s.bump[k] = Math.max(0, s.bump[k] - dt * 0.22);
        p.by[`bar${k}`].h = 0.35 + 2.0 * v + s.bump[k];
      });
      if (still) return;
      const R = s.stacks.records;
      s.inNext -= dt;
      if (s.inNext <= 0) {
        s.inNext = 0.8 + Math.random() * 0.6;
        if (R.n < 9) recordIn(p);
      }
      s.outNext -= dt;
      if (s.outNext <= 0) {
        s.outNext = 1.0 + Math.random() * 0.6;
        if (R.n > 3) recordOut(p);
      }
      s.gitNext -= dt;
      if (s.gitNext <= 0) {
        s.gitNext = 2.8 + Math.random() * 1.8;
        gitDot(p);
      }
    },
    print() {
      label("Gateway", 0.3, 5.18, 0, 0.32, rgb(C.ink, 0.6));
      label("records", 0.3, 5.52, 0, 0.32, rgb(C.ink, 0.6));
    },
    decorate(p, b, top) {
      const s = p.s;
      if (b.id === "table") {
        TEAMS.forEach(([name], k) => label(name, BAR_X(k) + 0.425, 2.85, top, 0.32, rgb(C.ink, 0.62), 500, minPx(), "center"));
        label("Weekly active, by team", 3.45, 3.5, top, 0.32, C.label, 600);
        groove(
          [
            [3.0, 4.05],
            [10.4, 4.05],
          ],
          top + 0.002
        );
        groove(
          [
            [3.0, 6.6],
            [3.4, 6.6],
          ],
          top + 0.002
        );
      } else if (b.id === "chart") {
        label("Delivery, from Git", b.x + 0.25, b.y + 0.58, top, 0.32, C.label, 600);
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          const c = s.chart;
          const at = (v, k) => [0.35 + (k / (c.length - 1)) * 3.3, 2.7 - v * 1.6];
          ctx.fillStyle = "rgba(70, 66, 60, 0.14)";
          ctx.fillRect(0.35, 2.74, 3.3, 0.02);
          ctx.strokeStyle = rgb(C.ink, 0.62);
          ctx.lineWidth = 1.3 / cam.s;
          ctx.beginPath();
          c.forEach((v, k) => {
            const [x, y] = at(v, k);
            if (k) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          });
          ctx.stroke();
          ctx.fillStyle = rgb(C.ink, 0.7);
          c.forEach((v, k) => {
            const [x, y] = at(v, k);
            ctx.fillRect(x - 0.04, y - 0.04, 0.08, 0.08);
          });
        });
      } else if (b.id === "members") {
        label("Members and keys", b.x + 0.2, b.y + 0.58, top, 0.32, C.label, 600);
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          ctx.fillStyle = PRINT;
          [1.3, 1.7, 1.1, 1.5, 1.2].forEach((w, k) => ctx.fillRect(0.2, 0.9 + k * 0.4, w, 0.1));
        });
        for (let k = 0; k < 5; k++) keyGlyph(b.x + 2.3, b.y + 0.95 + k * 0.4, top, 0.5, rgb(C.ink, 0.45));
      } else if (b.id === "git") {
        // a branch leaving the main line and joining it again: commits as small squares
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          ctx.strokeStyle = rgb(C.ink, 0.5);
          ctx.lineWidth = 0.06;
          ctx.beginPath();
          ctx.moveTo(0.3, 0.6);
          ctx.lineTo(1.45, 0.6);
          ctx.moveTo(0.6, 0.6);
          ctx.lineTo(0.92, 0.28);
          ctx.lineTo(1.28, 0.28);
          ctx.lineTo(1.4, 0.6);
          ctx.stroke();
          ctx.fillStyle = rgb(C.ink, 0.62);
          for (const [x, y] of [
            [0.36, 0.6],
            [0.82, 0.6],
            [1.4, 0.6],
            [1.04, 0.28],
          ])
            ctx.fillRect(x - 0.07, y - 0.07, 0.14, 0.14);
        });
        label("Git", b.x + 0.15, b.y + 1.0, top, 0.32, C.label, 600);
        label("read-only", b.x + 0.15, b.y + 1.33, top, 0.32, rgb(C.ink, 0.6));
      } else if (b.id === "records") {
        cardLines(b.x + 0.22, b.y + 0.3, top, b.w);
      }
    },
  };

  // 5. Evaluations: tasks from your repositories go onto a deck; each is dealt twice and run side by side,
  // on today's model and on a candidate. Accepted runs stack up; failed ones are crossed out but still paid
  // for. The board shows each model's cost per accepted task over its last twelve attempts. The runs are
  // samples from overlapping ranges, so either model can lead, and the board says so.
  const RUN_COST = [
    [0.14, 0.22],
    [0.08, 0.2],
  ];
  const RUN_OK = [0.7, 0.62];

  function attempt(k, r = Math.random) {
    const [lo, hi] = RUN_COST[k];
    return { cost: lo + r() * (hi - lo), ok: r() < RUN_OK[k] };
  }

  function taskIn(p) {
    const D = p.s.stacks.deck;
    p.movers.push(
      mover(
        [
          [1.7, 1.7, 0.3],
          [1.7, 2.5, 0.3],
          [1.7, 2.58, 0.02],
          [1.7, 4.5, 0.02],
        ],
        ["repo", "repo", "ground"],
        {
          speed: 2.4,
          look: "card",
          data: { w: 0.62, d: 0.44, lines: true },
          onEnd: (m) => {
            m.dead = true;
            D.n = Math.min(8, D.n + 1);
            D.land = 0;
          },
        }
      )
    );
  }

  function evalCard(p, k, z) {
    const s = p.s;
    const y = k ? 6.8 : 4.0;
    const y0 = k ? 5.8 : 5.0;
    const run = k ? "runB" : "runA";
    const tray = k ? "trayB" : "trayA";
    const runTime = k ? 0.9 : 1.1;
    const nodes = [
      [1.5, y0, z],
      [2.4, y0, z],
      [2.5, y0, 0.02],
      [2.9, y0, 0.02],
      [2.9, y, 0.02],
      [4.02, y, 0.02],
      [4.16, y, 0.5],
      [5.35, y, 0.5],
      [6.6, y, 0.5],
      [6.7, y, 0.02],
      [9.3, y, 0.05 + s.trays[k] * 0.05],
    ];
    const rides = ["deck", "deck", "ground", "ground", "ground", "ground", run, run, run, tray];
    p.movers.push(
      mover(nodes, rides, {
        speed: 2.6,
        look: "card",
        data: { w: 0.62, d: 0.44, lines: true },
        fwd: {
          7: (m) => {
            s.busy[k] = true;
            m.wait = runTime;
            p.by[run].glow = 0.6;
          },
          8: () => (s.busy[k] = false),
        },
        onEnd: (m) => {
          if (m.data.done) {
            m.dead = true;
            return;
          }
          m.data.done = true;
          const a = attempt(k);
          const h = s.hist[k];
          h.push(a);
          if (h.length > 12) h.shift();
          if (a.ok) {
            s.trays[k] = s.trays[k] >= 5 ? 1 : s.trays[k] + 1;
            m.dead = true;
          } else {
            m.data.mark = "fail";
            m.wait = 0.7;
          }
        },
        fade: (pt, m) => (m.data.mark === "fail" ? m.wait / 0.5 : 1),
      })
    );
  }

  const evalDef = {
    setup(p, add) {
      add("repo", 0.5, 0.9, 2.6, 1.6, 0.3);
      add("deck", 0.6, 4.6, 1.8, 1.6, 0, CARD, { kind: "stack" });
      add("runA", 4.1, 3.4, 2.5, 1.2, 0.5);
      add("runB", 4.1, 6.2, 2.5, 1.2, 0.5, BLUE);
      add("trayA", 8.3, 3.5, 2.0, 1.0, 0.05);
      add("trayB", 8.3, 6.3, 2.0, 1.0, 0.05);
      add("board", 6.9, 0.9, 4.5, 0.18, 2.35, CARD, { r: 0.03 });
      p.grooves = [
        [
          [1.7, 2.5],
          [1.7, 4.6],
        ],
        [
          [2.4, 5.0],
          [2.9, 5.0],
          [2.9, 4.0],
          [8.3, 4.0],
        ],
        [
          [2.4, 5.8],
          [2.9, 5.8],
          [2.9, 6.8],
          [8.3, 6.8],
        ],
      ];
      const r = rng(4242);
      p.s = {
        stacks: { deck: { n: 6, land: 1, file: 0, keep: 6 } },
        next: 0.4,
        feed: 1.0,
        prog: [0, 0],
        busy: [false, false],
        trays: [2, 1],
        hist: [0, 1].map((k) => Array.from({ length: 12 }, () => attempt(k, r))),
        bars: [0.9, 0.8],
      };
    },
    step(p, dt) {
      const s = p.s;
      const cpa = s.hist.map((h) => h.reduce((a, x) => a + x.cost, 0) / Math.max(1, h.filter((x) => x.ok).length));
      const most = Math.max(...cpa);
      for (let k = 0; k < 2; k++) {
        s.bars[k] += (cpa[k] / most - s.bars[k]) * (1 - Math.exp(-dt * 3));
        if (s.busy[k]) s.prog[k] = Math.min(1, s.prog[k] + dt / (k ? 0.9 : 1.1));
        else s.prog[k] = Math.max(0, s.prog[k] - dt * 3);
      }
      if (still) return;
      const D = s.stacks.deck;
      s.feed -= dt;
      if (s.feed <= 0) {
        s.feed = 2.0;
        if (D.n < 8) taskIn(p);
      }
      s.next -= dt;
      if (s.next <= 0) {
        s.next = 2.2;
        if (D.n > 1) {
          D.n -= 1;
          const z = D.n * 0.07 + 0.05;
          evalCard(p, 0, z);
          evalCard(p, 1, z);
        }
      }
    },
    print() {
      label("Your tasks", 0.5, 6.95, 0, 0.32, rgb(C.ink, 0.6));
    },
    decorate(p, b, top) {
      const s = p.s;
      if (b.id === "repo") {
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          ctx.strokeStyle = rgb(C.ink, 0.5);
          ctx.lineWidth = 0.06;
          ctx.beginPath();
          ctx.moveTo(0.3, 0.62);
          ctx.lineTo(1.6, 0.62);
          ctx.moveTo(0.62, 0.62);
          ctx.lineTo(0.95, 0.3);
          ctx.lineTo(1.4, 0.3);
          ctx.stroke();
          ctx.fillStyle = rgb(C.ink, 0.62);
          for (const [x, y] of [
            [0.36, 0.62],
            [0.9, 0.62],
            [1.55, 0.62],
            [1.12, 0.3],
            [1.4, 0.3],
          ])
            ctx.fillRect(x - 0.07, y - 0.07, 0.14, 0.14);
        });
        label("Repositories", b.x + 0.22, b.y + 1.3, top, 0.32, C.label, 600);
      } else if (b.id === "runA" || b.id === "runB") {
        const k = b.id === "runB" ? 1 : 0;
        // the name on the block's face, where the cards riding over it cannot cover it
        onWallY(b.x, b.y + b.d, top, () => wallText(k ? "Candidate" : "Today's model", 0.2, 0.38, 0.32, k ? BLUE.text : C.label, 600));
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          ctx.fillStyle = k ? "rgba(255, 255, 255, 0.22)" : FAINT;
          ctx.fillRect(0.22, 0.18, 2.06, 0.1);
          ctx.fillStyle = k ? "rgba(255, 255, 255, 0.85)" : rgb(C.blue, 0.75);
          ctx.fillRect(0.22, 0.18, 2.06 * clamp(s.prog[k]), 0.1);
        });
      } else if (b.id === "trayA" || b.id === "trayB") {
        const k = b.id === "trayB" ? 1 : 0;
        const n = s.trays[k];
        for (let i = 0; i < n; i++) cardAt(9.3, b.y + 0.5, top + i * 0.05, { w: 0.62, d: 0.44, lines: true, mark: i === n - 1 ? "ok" : null });
      } else if (b.id === "board") {
        // the face slopes down to the right, so each bar sits directly under its own name, never beside it
        onWallY(b.x, b.y + b.d, top, () => {
          wallText("Cost per accepted task", 0.25, 0.48, 0.32, C.label, 600);
          // the runs are samples, as the page's other synthetic material is marked
          ctx.fillStyle = rgb(C.blue, 0.9);
          ctx.fillRect(0.27, 0.72, 0.11, 0.11);
          wallText("Sample runs", 0.48, 0.86, 0.32, rgb(C.ink, 0.55));
          [
            ["Today's model", 1.34, C.ink, 0.6],
            ["Candidate", 1.92, C.blue, 0.85],
          ].forEach(([name, y, col, a], k) => {
            wallText(name, 0.25, y, 0.32, rgb(C.ink, 0.62));
            ctx.fillStyle = FAINT;
            ctx.fillRect(0.25, y + 0.07, 3.9, 0.15);
            ctx.fillStyle = rgb(col, a);
            ctx.fillRect(0.25, y + 0.07, 3.9 * clamp(s.bars[k]), 0.15);
          });
        });
      } else if (b.id === "deck") {
        cardLines(b.x + 0.22, b.y + 0.3, top, b.w);
      }
    },
  };

  // 6. Serving and monitoring: a vLLM rack of GPUs answers requests while a screen charts GPU use and
  // requests; now and then a new open-weight release passes its tests and is rolled into the rack.
  function serveCall(p) {
    const s = p.s;
    p.movers.push(
      mover(
        [
          [-0.9, 4.8, 0.02],
          [1.7, 4.8, 0.02],
          [1.7, 4.06, 0.02],
        ],
        ["ground", "ground"],
        {
          speed: 3.4,
          onEnd: (m) => {
            m.dir = -1;
            m.ink = true;
            m.wait = 0.35;
            const k = (Math.random() * 4) | 0;
            s.led[k] = 1;
            s.load[k] = Math.min(0.95, s.load[k] + 0.12);
            s.recent += 1;
          },
          fade: (pt) => (pt.x + 0.6) / 0.9,
        }
      )
    );
  }

  function release(p) {
    const s = p.s;
    const k = (Math.random() * 4) | 0;
    const zu = 2.5 - 0.68 * k;
    const nodes = [
      [12.9, 6.4, 0.02],
      [9.26, 6.4, 0.02],
      [9.12, 6.4, 0.32],
      [8.2, 6.4, 0.32],
      [7.25, 6.4, 0.32],
      [7.12, 6.4, 0.02],
      [3.0, 6.4, 0.02],
      [3.0, 4.1, 0.02],
      [3.0, 4.1, zu],
      [3.0, 3.75, zu],
    ];
    const rides = ["ground", "tests", "tests", "tests", "ground", "ground", "ground", "rack", "rack"];
    p.movers.push(
      mover(nodes, rides, {
        speed: 2.2,
        look: "card",
        data: { w: 1.0, d: 0.7, h: 0.1, paper: BLUE, lines: true, clipY: 4.0 },
        fwd: {
          3: (m) => {
            s.testing = true;
            m.wait = 1.7;
          },
          4: () => {
            s.testing = false;
            s.passed = 1;
          },
        },
        onEnd: (m) => {
          m.dead = true;
          s.led[k] = 1;
          s.fresh[k] = 1;
          s.load[k] = 0.2;
        },
        fade: (pt) => (12.5 - pt.x) / 0.9,
      })
    );
  }

  // a small chart on the monitoring screen: faint rules, then the series, filled below when asked
  function chart(series, x, y, w, h, color, area) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    for (let k = 0; k < 3; k++) ctx.fillRect(x, y + (h * k) / 2, w, 0.01);
    const n = series.length;
    const at = (k) => [x + (k / (n - 1)) * w, y + h - series[k] * h];
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const [px, py] = at(k);
      if (k) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    if (area) {
      ctx.save();
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fillStyle = rgb(color, 0.16);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const [px, py] = at(k);
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
    }
    ctx.strokeStyle = rgb(color, 0.95);
    ctx.lineWidth = 1.4 / cam.s;
    ctx.stroke();
  }

  const servingDef = {
    setup(p, add) {
      add("rack", 1.0, 1.6, 2.8, 2.4, 3.4, COAL, { r: 0.05 });
      add("monitor", 5.0, 1.0, 6.2, 0.2, 2.8, COAL, { r: 0.03 });
      add("tests", 7.2, 5.6, 2.0, 1.8, 0.32);
      add("tf", 0.8, 7.2, 2.8, 1.8, 0.05);
      p.grooves = [
        [
          [-0.9, 4.8],
          [1.7, 4.8],
          [1.7, 4.0],
        ],
        [
          [12.9, 6.4],
          [9.2, 6.4],
        ],
        [
          [7.2, 6.4],
          [3.0, 6.4],
          [3.0, 4.0],
        ],
      ];
      p.s = {
        load: [0.62, 0.7, 0.55, 0.66],
        led: [0, 0, 0, 0],
        fresh: [0, 0, 0, 0],
        util: Array.from({ length: 48 }, (_, k) => 0.58 + 0.08 * Math.sin(k * 0.5)),
        reqs: Array.from({ length: 48 }, (_, k) => 0.45 + 0.1 * Math.sin(k * 0.8 + 1)),
        sample: 0,
        recent: 0,
        release: 3.5,
        test: 0,
        testing: false,
        passed: 0,
        next: 0.3,
      };
    },
    step(p, dt) {
      const s = p.s;
      for (let k = 0; k < 4; k++) {
        s.led[k] = Math.max(0, s.led[k] - dt * 3);
        s.fresh[k] = Math.max(0, s.fresh[k] - dt * 0.8);
        const wave = 0.6 + 0.14 * Math.sin(p.t * 0.7 + k * 1.7) + 0.06 * Math.sin(p.t * 1.9 + k);
        s.load[k] += (wave - s.load[k]) * (1 - Math.exp(-dt * 1.5));
      }
      s.passed = Math.max(0, s.passed - dt * 0.5);
      if (s.testing) s.test = Math.min(1, s.test + dt / 1.6);
      else s.test = Math.max(0, s.test - dt * 2);
      if (still) return;
      s.sample -= dt;
      if (s.sample <= 0) {
        s.sample = 0.22;
        const mean = s.load.reduce((a, b) => a + b, 0) / 4;
        const lastU = s.util[s.util.length - 1];
        const lastR = s.reqs[s.reqs.length - 1];
        s.util.push(clamp(lerp(lastU, mean + (Math.random() - 0.5) * 0.08, 0.35), 0.1, 0.95));
        s.util.shift();
        s.reqs.push(clamp(lerp(lastR, 0.3 + s.recent * 0.12 + (Math.random() - 0.5) * 0.06, 0.3), 0.08, 0.95));
        s.reqs.shift();
        s.recent *= 0.75;
      }
      s.next -= dt;
      if (s.next <= 0) {
        s.next = 0.5 + Math.random() * 0.5;
        if (p.movers.length < 6) serveCall(p);
      }
      s.release -= dt;
      if (s.release <= 0) {
        s.release = 13;
        release(p);
      }
    },
    print() {
      label("New releases", 9.4, 5.95, 0, 0.32, rgb(C.ink, 0.6));
    },
    decorate(p, b, top) {
      const s = p.s;
      if (b.id === "rack") {
        // vents across the top
        const fins = new Path2D();
        for (let fx = b.x + 0.3; fx < b.x + b.w - 0.2; fx += 0.3) {
          const a = proj(fx, b.y + 0.3, top);
          const c = proj(fx, b.y + b.d - 0.3, top);
          fins.moveTo(a[0], a[1]);
          fins.lineTo(c[0], c[1]);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.34)";
        ctx.stroke(fins);
        ctx.save();
        ctx.translate(0.9, 0.3);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.stroke(fins);
        ctx.restore();
        // four GPU servers, each with its light and its load
        onWallY(b.x, b.y + b.d, top, () => {
          wallText("vLLM", 0.22, 0.46, 0.32, rgb(SCREEN_INK, 0.85), 600);
          for (let k = 0; k < 4; k++) {
            const uy = 0.6 + k * 0.68;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
            ctx.lineWidth = 1 / cam.s;
            ctx.strokeRect(0.12, uy, 2.56, 0.6);
            const light = mix(mix(C.ok, C.blueTint, s.fresh[k]), [255, 255, 255], s.led[k] * 0.45);
            ctx.fillStyle = rgb(light);
            ctx.fillRect(0.26, uy + 0.25, 0.13, 0.1);
            ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            ctx.fillRect(0.55, uy + 0.27, 1.95, 0.07);
            ctx.fillStyle = rgb(C.blueTint, 0.85);
            ctx.fillRect(0.55, uy + 0.27, 1.95 * clamp(s.load[k]), 0.07);
          }
        });
      } else if (b.id === "monitor") {
        onWallY(b.x, b.y + b.d, top, () => {
          ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
          ctx.fillRect(0.14, 0.14, 5.92, 2.52);
          wallText("GPU use", 0.42, 0.56, 0.32, rgb(SCREEN_INK, 0.75), 600);
          wallText("Requests", 3.36, 0.56, 0.32, rgb(SCREEN_INK, 0.75), 600);
          chart(s.util, 0.42, 0.82, 2.6, 1.55, SCREEN_BLUE, true);
          chart(s.reqs, 3.36, 0.82, 2.5, 1.55, SCREEN_INK, false);
        });
      } else if (b.id === "tests") {
        label("Tests", b.x + 0.25, b.y + 1.62, top, 0.32, C.label, 600);
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          ctx.fillStyle = FAINT;
          ctx.fillRect(0.25, 0.15, 1.5, 0.1);
          ctx.fillStyle = rgb(C.blue, 0.75);
          ctx.fillRect(0.25, 0.15, 1.5 * s.test, 0.1);
        });
        if (s.passed > 0.02) mark("ok", b.x + 1.65, b.y + 1.45, top, 1.1, rgb(C.ink, 0.85 * Math.min(1, s.passed * 2)));
      } else if (b.id === "tf") {
        label("Terraform", b.x + 0.22, b.y + 0.48, top, 0.32, C.label, 600);
        onPlane(b.x, b.y, top + 0.004, 1, () => {
          [
            [0.5, 0.9],
            [0.3, 1.2],
            [0.6, 0.7],
            [0.4, 1.0],
            [0.5, 0.6],
          ].forEach(([a, w], k) => {
            const x = 0.22 + (k % 2) * 0.2;
            const y = 0.72 + k * 0.2;
            ctx.fillStyle = "rgba(70, 66, 60, 0.3)";
            ctx.fillRect(x, y, a, 0.07);
            ctx.fillStyle = rgb(C.blue, 0.55);
            ctx.fillRect(x + a + 0.1, y, w, 0.07);
          });
        });
      }
    },
  };

  // ---------------------------------------------------------------- building, posing, drawing

  const DEFS = { gateway: gatewayDef, agent: agentDef, coders: coderDef, portal: portalDef, evals: evalDef, serving: servingDef };
  const pieces = ORDER.map((id, index) => {
    if (mode === "solo" && index !== soloIndex) return null;
    const p = { id, index, name: NAMES[id], tile: tornTile(1709 + index * 977, TW, TD), parts: [], grooves: [], movers: [], pings: [], s: {}, t: 0, seen: -9, def: DEFS[id] };
    p.def.setup(p, (...a) => {
      const b = cut(id, ...a);
      b.order = p.parts.length;
      p.parts.push(b);
      return b;
    });
    p.by = Object.fromEntries(p.parts.map((b) => [b.id, b]));
    p.drawOrder = [...p.parts].sort(paintOrder);
    return p;
  });

  const ONE = () => 1;
  const ZERO = () => 0;

  // Where each piece stands this frame, how far it is lifted, how faded, and how far its parts have
  // risen: the opening's tiles dropping in; the others lifting away as the first is read; then, from
  // one piece to the next, the old one lifting away while the new one's tile drops in and its parts rise.
  function poses() {
    if (mode === "solo") return [{ p: pieces[soloIndex], ox: 0, oy: 0, dz: 0, alpha: 1, grow: ONE, lift: ZERO, name: 0.6 }];
    const list = [];
    const sp = mode === "lineup" ? -1 : st.pos;
    if (sp < 0) {
      const t = sp + 1;
      pieces.forEach((p, i) => {
        const e = clamp((st.intro - 0.15 - i * 0.13) / 0.9);
        const n = p.parts.length;
        let dz = (1 - easeOutExpo(e)) * 4;
        let alpha = clamp(e * 2.2);
        if (i > 0) {
          const L = clamp((t - 0.03 * i) / 0.45);
          dz += easeInCubic(L) * 6;
          alpha *= 1 - smoothstep(0, 1, L);
        }
        const grow = st.intro >= 9 ? ONE : (j) => easeOutCubic((st.intro - 0.8 - i * 0.13 - j * (0.4 / n)) / 0.5);
        list.push({ p, ox: HOME[i][0], oy: HOME[i][1], dz, alpha, grow, lift: ZERO, name: lerp(0.8, 0.5, smooth(t)) });
      });
      return list;
    }
    const k = Math.min(Math.floor(sp), ORDER.length - 1);
    const t = sp - k;
    const out = pieces[k];
    const inc = pieces[k + 1];
    const [hx, hy] = HOME[0];
    if (!inc || t < 0.5) {
      const n = out.parts.length;
      list.push({
        p: out,
        ox: hx,
        oy: hy,
        dz: easeInCubic((t - 0.12) / 0.33) * 5.5,
        alpha: 1 - smoothstep(0.12, 0.45, t),
        grow: ONE,
        lift: (j) => easeInCubic((t - 0.02 * (n - 1 - j)) / 0.3) * 2.2,
        name: 0.5,
      });
    }
    if (inc && t > 0.3) {
      const n = inc.parts.length;
      list.push({
        p: inc,
        ox: hx,
        oy: hy,
        dz: (1 - easeOutCubic((t - 0.3) / 0.38)) * 5.5,
        alpha: smoothstep(0.3, 0.55, t),
        grow: (j) => easeOutCubic((t - 0.52 - j * (0.24 / n)) / 0.22),
        lift: ZERO,
        name: 0.5,
      });
    }
    return list;
  }

  function stepPiece(p, dt) {
    p.t += dt;
    for (let i = p.pings.length - 1; i >= 0; i--) {
      p.pings[i].t -= dt * 2;
      if (p.pings[i].t <= 0) p.pings.splice(i, 1);
    }
    for (const b of p.parts) b.glow = Math.max(0, b.glow - dt * 2);
    for (const S of Object.values(p.s.stacks || {})) {
      S.land = Math.min(1, S.land + dt / 0.35);
      if (S.file > 0) {
        S.file = Math.max(0, S.file - dt / 0.6);
        if (S.file === 0) S.n = S.keep;
      }
    }
    p.def.step(p, dt);
    if (!still) moveAll(p.movers, dt);
  }

  function step(dt) {
    st.time += dt;
    st.intro += dt;
    const ease = (rate) => 1 - Math.exp(-dt * rate);
    const goal = softLock(st.posTarget + 1) - 1;
    st.pos += (goal - st.pos) * ease(7);
    if (Math.abs(goal - st.pos) < 0.0004) st.pos = goal;
    st.yaw += (st.yawT - st.yaw) * ease(3);
    st.pitch += (st.pitchT - st.pitch) * ease(3);
    current = poses();
    for (const pose of current) {
      if (pose.alpha <= 0.01) continue;
      const p = pose.p;
      // a piece coming into view is already busy: a few seconds of its work have run before it shows
      if (!still && st.time - p.seen > 0.6) for (let i = 0; i < 50; i++) stepPiece(p, 0.05);
      p.seen = st.time;
      stepPiece(p, dt);
    }
  }

  // the screen rectangle a piece can reach, so a fading piece is composited only where it is
  function pieceRect(pose) {
    const saved = [T.ox, T.oy, T.oz];
    T.ox = pose.ox;
    T.oy = pose.oy;
    T.oz = pose.dz;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of [
      [0, 0],
      [TW, 0],
      [0, TD],
      [TW, TD],
    ]) {
      for (const z of [-PLATE_T - 0.6, TALLEST + 2.6]) {
        const q = proj(x, y, z);
        x0 = Math.min(x0, q[0]);
        y0 = Math.min(y0, q[1]);
        x1 = Math.max(x1, q[0]);
        y1 = Math.max(y1, q[1]);
      }
    }
    [T.ox, T.oy, T.oz] = saved;
    const m = 48;
    return [Math.max(0, x0 - m), Math.max(0, y0 - m), Math.min(st.w, x1 + m), Math.min(st.h, y1 + m)];
  }

  // Draw one piece. A piece that is fading is drawn whole into a buffer and laid down at its opacity,
  // so its paper parts never show through one another.
  function layer(alpha, rect, fn) {
    if (alpha <= 0.01) return;
    if (alpha >= 0.995) {
      fn();
      return;
    }
    if (!buf) {
      buf = document.createElement("canvas");
      bctx = buf.getContext("2d");
      bufGrain = bctx.createPattern(grainTile, "repeat");
    }
    if (buf.width !== canvas.width || buf.height !== canvas.height) {
      buf.width = canvas.width;
      buf.height = canvas.height;
    }
    const d = st.dpr;
    const sx = Math.floor(rect[0] * d);
    const sy = Math.floor(rect[1] * d);
    const sw = Math.min(canvas.width - sx, Math.ceil((rect[2] - rect[0]) * d));
    const sh = Math.min(canvas.height - sy, Math.ceil((rect[3] - rect[1]) * d));
    if (sw <= 0 || sh <= 0) return;
    ctx = bctx;
    grainFill = bufGrain;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(sx, sy, sw, sh);
    set();
    fn();
    ctx = main;
    grainFill = mainGrain;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(buf, sx, sy, sw, sh, sx, sy, sw, sh);
    ctx.restore();
  }

  function drawPiece(pose) {
    const p = pose.p;
    layer(pose.alpha, pieceRect(pose), () => {
      T.ox = pose.ox;
      T.oy = pose.oy;
      T.oz = pose.dz;
      drawTile(p, pose.dz);
      for (const g of p.grooves) groove(g, 0.002);
      if (p.def.print) p.def.print(p);
      if (pose.name) label(p.name, 0.9, TD - 0.22, 0, pose.name, rgb(C.ink, 0.5), 600);
      drawPings(p, "ground");
      drawMovers(p, "ground");
      for (const b of p.drawOrder) {
        const g = pose.grow(b.order);
        const lift = pose.lift(b.order);
        T.oz = pose.dz + lift + b.z0;
        const top = b.kind === "stack" ? drawStack(p, b, g) : drawBlock(b, g);
        if (g > 0.97 && p.def.decorate) p.def.decorate(p, b, top);
        T.oz = pose.dz + lift;
        drawPings(p, b.id);
        drawMovers(p, b.id);
      }
      T.oz = pose.dz;
    });
  }

  function draw() {
    layout();
    aim();
    if (!current.length) current = poses();
    ctx = main;
    grainFill = mainGrain;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    set();
    const list = [...current].sort((a, b) => a.ox + a.oy - (b.ox + b.oy) || a.dz - b.dz);
    for (const pose of list) drawPiece(pose);
  }

  function frame(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
    st.last = now;
    step(dt);
    draw();
    if (st.visible && !still) st.raf = requestAnimationFrame(frame);
  }

  // with reduced motion: every eased value settled, one frame drawn
  function settle() {
    st.pos = Math.round(st.posTarget);
    for (let i = 0; i < 30; i++) step(0.1);
    st.pos = Math.round(st.posTarget);
    current = poses();
  }

  function kick() {
    if (still) {
      settle();
      draw();
      return;
    }
    if (!st.raf && st.visible) {
      st.last = 0;
      st.raf = requestAnimationFrame(frame);
    }
  }

  // ---- wiring

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) st.visible = e.isIntersecting;
      if (st.visible) kick();
    },
    { rootMargin: "120px" }
  );
  io.observe(root);

  const ro = new ResizeObserver((entries) => {
    const r = entries[entries.length - 1].contentRect;
    size = { w: r.width, h: r.height };
    if (still) draw();
  });
  ro.observe(root);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => still && draw());

  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const area = opts.pointerArea || root;
  function onMove(ev) {
    const r = area.getBoundingClientRect();
    const nx = clamp((ev.clientX - r.left) / r.width) - 0.5;
    const ny = clamp((ev.clientY - r.top) / r.height) - 0.5;
    st.yawT = -nx * 0.08;
    st.pitchT = ny * 0.03;
  }
  function onLeave() {
    st.yawT = 0;
    st.pitchT = 0;
  }
  if (fine && !still && mode === "stage") {
    area.addEventListener("pointermove", onMove, { passive: true });
    area.addEventListener("pointerleave", onLeave, { passive: true });
  }

  root.classList.add("is-live");

  // a piece shown on its own is busy from its first frame
  if (!still && mode === "solo") {
    for (let i = 0; i < 60; i++) step(0.05);
    draw();
  }

  return {
    // The page's place, from the scroll: -1 the opening, 0 to 5 each piece.
    setPos(v) {
      st.posTarget = clamp(v, -1, ORDER.length - 1);
      if (still) {
        settle();
        draw();
      }
    },
    destroy() {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(st.raf);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerleave", onLeave);
    },
  };
}
