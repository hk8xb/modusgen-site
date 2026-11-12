// The three-layer figure: organisation over software over hardware.
// Drawn on a 2D canvas with a small isometric engine, as sheets of thick, clean
// handmade paper with torn, fuzzy edges, lit from the upper left. No dependencies.
//
// World units: each sheet is P wide and P + BAND deep, lying in the x/y plane; z points up.
// The front BAND of every sheet is kept clear for the layer's name.
// The camera looks from the +x/+y side, so larger x + y is nearer the viewer.

const P = 12;
const BAND = 1.0;
const CX = P / 2;
const CY = (P + BAND) / 2;
const PLATE_T = 0.3;
const SEAT = 0.62;
const SEAT_PITCH = 0.84;
const SANS = '"Mona Sans", ui-sans-serif, system-ui, sans-serif';

// A request drops through the organisation sheet at a port, lands on the Model API bar
// (which runs along GATE_Y), rides it to a GPU's column and drops through a hole to that GPU.
const GATE_Y = 10.1;
const SLED_X = [2.2, 4.8, 7.4, 10.0];

// The Model API also serves frontier models: about a third of requests ride it to its end and leave
// the sheet along a groove, fading out past the torn edge (OFF_X), and their answers come back that way.
const FRONTIER_SHARE = 0.35;
const OFF_X = 12.7;

const INDEX = { hardware: 0, software: 1, organisation: 2, infrastructure: 0, platform: 1, organization: 2 };

// ---------------------------------------------------------------- palette

const C = {
  // the three sheets, bottom to top: clean white stock, each a shade brighter nearer the light
  sheet: [
    [240, 238, 232],
    [246, 245, 240],
    [251, 250, 247],
  ],
  fringe: [255, 255, 255],
  fiber: "rgba(255, 255, 255, 0.9)",
  fuzz: "rgba(255, 255, 255, 0.8)",
  edgeLit: [238, 236, 230],
  edgeShade: [196, 191, 181],
  shadow: [36, 30, 22],
  card: [254, 253, 250],
  cardLit: [241, 239, 234],
  cardShade: [200, 195, 186],
  seat: [234, 232, 226],
  coal: [44, 44, 46],
  coalLit: [72, 72, 75],
  coalShade: [27, 27, 29],
  blue: [44, 82, 196],
  blueLit: [70, 106, 214],
  blueShade: [27, 54, 146],
  blueTint: [128, 156, 228],
  ink: [33, 28, 21],
  groove: "rgba(70, 66, 60, 0.17)",
  grooveLit: "rgba(255, 255, 255, 0.85)",
  label: "rgba(33, 28, 21, 0.86)",
  title: "rgba(33, 28, 21, 0.56)",
  thread: "rgba(50, 46, 40, 0.32)",
  holeWall: [198, 193, 184],
  hole: [52, 48, 44],
  ok: [46, 160, 106],
};

// how each kind of block is cut: from white card, graphite card or blue card
const CARD = { top: C.card, lit: C.cardLit, shade: C.cardShade, edge: "rgba(255, 255, 255, 0.9)", fuzz: "rgba(255, 255, 255, 0.9)", grain: 0.8, text: C.label };
const COAL = { top: C.coal, lit: C.coalLit, shade: C.coalShade, edge: "rgba(255, 255, 255, 0.16)", fuzz: "rgba(150, 150, 156, 0.55)", grain: 0.1, text: "rgba(246, 241, 232, 0.9)" };
const BLUE = { top: C.blue, lit: C.blueLit, shade: C.blueShade, edge: "rgba(255, 255, 255, 0.32)", fuzz: "rgba(156, 180, 240, 0.65)", grain: 0.14, text: "rgba(248, 245, 238, 0.95)" };

const rgb = (c, a = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
const smooth = (t) => t * t * (3 - 2 * t);
const smoothstep = (a, b, x) => smooth(clamp((x - a) / (b - a)));

// The home page's story: 0 the hero, 1 the overview, 2 to 4 each layer in turn. Scrolling moves it
// live, but each beat holds still for the first and last fifth of the way to the next: a soft lock.
const softLock = (s) => {
  const k = Math.floor(s);
  return k + smoothstep(0.2, 0.8, s - k);
};
function storyState(s) {
  if (s <= 1) return { focusW: 0, fPos: 0, over: s, explode: s };
  if (s <= 2) return { focusW: s - 1, fPos: 0, over: 1 - smoothstep(0, 0.6, s - 1), explode: 2 - s };
  return { focusW: 1, fPos: clamp(s - 2, 0, 2), over: 0, explode: 0 };
}

// what the overview says beside each sheet; "|" marks where a note prefers to break
const CALLOUTS = [
  ["Infrastructure", "GPUs in your cloud|or on-prem"],
  ["Platform", "Model API, coding agents|and the SEI dashboard"],
  ["Organization", "Rollout, policy|and training"],
];

// A seeded random source, so every visit tears the paper the same way.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Smooth noise around a loop (t from 0 to 1), so a torn edge closes on itself.
function loop(r, n) {
  const v = Array.from({ length: n }, () => r() * 2 - 1);
  return (t) => {
    const x = (((t % 1) + 1) % 1) * n;
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    return v[i % n] + (v[(i + 1) % n] - v[i % n]) * s;
  };
}

// ---------------------------------------------------------------- paper grain

// One tile of pulp and fibres, laid over every sheet and block. Made once per page.
const GRAIN_N = 512;
const GRAIN_WORLD = 13; // world units one tile covers
let grainTile = null;

function paperGrain() {
  if (grainTile) return grainTile;
  const N = GRAIN_N;
  const tile = document.createElement("canvas");
  tile.width = tile.height = N;
  const g = tile.getContext("2d");
  const r = rng(20261111);

  // pulp: soft clouds where the sheet is a little thicker or thinner
  const img = g.createImageData(N, N);
  const octaves = [
    [6, 0.6],
    [14, 0.28],
    [48, 0.12],
  ].map(([n, w]) => ({ n, w, v: Float32Array.from({ length: n * n }, () => r() * 2 - 1) }));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (const o of octaves) {
        const fx = (x / N) * o.n;
        const fy = (y / N) * o.n;
        const ix = fx | 0;
        const iy = fy | 0;
        let tx = fx - ix;
        let ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx);
        ty = ty * ty * (3 - 2 * ty);
        const x1 = (ix + 1) % o.n;
        const y1 = (iy + 1) % o.n;
        const a = o.v[iy * o.n + ix];
        const b = o.v[iy * o.n + x1];
        const c = o.v[y1 * o.n + ix];
        const d = o.v[y1 * o.n + x1];
        s += o.w * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
      }
      const k = (y * N + x) * 4;
      if (s > 0) {
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
        img.data[k + 3] = Math.min(255, s * 95);
      } else {
        img.data[k] = 122;
        img.data[k + 1] = 119;
        img.data[k + 2] = 114;
        img.data[k + 3] = Math.min(255, -s * 22);
      }
    }
  }
  g.putImageData(img, 0, 0);

  // Draws f at each of the nine tile offsets whose copy can reach the tile, so the grain repeats without a seam.
  const wrap = (x, y, reach, f) => {
    for (const ox of [-N, 0, N]) {
      for (const oy of [-N, 0, N]) {
        if (x + ox < -reach || x + ox > N + reach || y + oy < -reach || y + oy > N + reach) continue;
        f(x + ox, y + oy);
      }
    }
  };

  // clumps of pulp
  for (let i = 0; i < 170; i++) {
    const x = r() * N;
    const y = r() * N;
    const rad = 3 + r() * 7;
    const a = 0.05 + r() * 0.08;
    wrap(x, y, rad, (cx, cy) => {
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, `rgba(255, 255, 255, ${a})`);
      rg.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.fillStyle = rg;
      g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    });
  }

  // fibres: pale strands, each with a faint shadow so it reads on white stock, and a few faint grey ones
  g.lineCap = "round";
  for (let i = 0; i < 1700; i++) {
    const x = r() * N;
    const y = r() * N;
    const len = 4 + r() * r() * 24;
    const ang = r() * Math.PI * 2;
    const bend = (r() - 0.5) * 0.8 * len;
    const pale = r() < 0.82;
    const width = 0.5 + r() * 0.8;
    const a = 0.16 + r() * 0.3;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    const mx = dx * 0.5 - Math.sin(ang) * bend * 0.4;
    const my = dy * 0.5 + Math.cos(ang) * bend * 0.4;
    wrap(x, y, len + 2, (sx, sy) => {
      g.lineWidth = width;
      if (pale) {
        g.strokeStyle = `rgba(120, 117, 112, ${a * 0.16})`;
        g.beginPath();
        g.moveTo(sx + 0.7, sy + 0.9);
        g.quadraticCurveTo(sx + mx + 0.7, sy + my + 0.9, sx + dx + 0.7, sy + dy + 0.9);
        g.stroke();
      }
      g.strokeStyle = pale ? `rgba(255, 255, 255, ${a})` : `rgba(128, 124, 118, ${0.025 + a * 0.08})`;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + mx, sy + my, sx + dx, sy + dy);
      g.stroke();
    });
  }

  grainTile = tile;
  return tile;
}

// ---------------------------------------------------------------- the world

function roundedRect(x, y, w, d, r, n = 4) {
  r = Math.min(r, w / 2, d / 2);
  const corners = [
    [x + w - r, y + r, -Math.PI / 2],
    [x + w - r, y + d - r, 0],
    [x + r, y + d - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  const pts = [];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

// Evenly spaced points around a convex outline, each with its outward normal.
function resample(pts, ds) {
  const n = pts.length;
  const seg = [];
  let per = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push(l);
    per += l;
  }
  const count = Math.max(12, Math.round(per / ds));
  const out = [];
  let i = 0;
  let acc = 0;
  for (let k = 0; k < count; k++) {
    const s = (k / count) * per;
    while (i < n - 1 && acc + seg[i] < s) acc += seg[i++];
    const t = seg[i] ? (s - acc) / seg[i] : 0;
    const a = pts[i];
    const b = pts[(i + 1) % n];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  let cx = 0;
  let cy = 0;
  for (const p of out) {
    cx += p[0];
    cy += p[1];
  }
  cx /= count;
  cy /= count;
  return out.map((p, k) => {
    const a = out[(k - 1 + count) % count];
    const b = out[(k + 1) % count];
    let nx = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    if (nx * (p[0] - cx) + ny * (p[1] - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return [p[0], p[1], nx, ny];
  });
}

// A strand standing off an edge point (x, y) with outward normal (nx, ny): [x0, y0, x1, y1].
function strand(r, x, y, nx, ny, spread, len, root) {
  const ang = (r() - 0.5) * spread;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const sx = x - nx * root;
  const sy = y - ny * root;
  return [sx, sy, sx + (nx * ca - ny * sa) * len, sy + (nx * sa + ny * ca) * len];
}

// A sheet torn from a larger one: the outer line of the tear (A), the inner line where the
// white torn fringe gives way to the sheet's face (B), loose fibres and a dense short fuzz.
function tornSheet(seed) {
  const r = rng(seed);
  const base = resample(roundedRect(0, 0, P, P + BAND, 0.5, 6), 0.06);
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
    const inA = 0.13 + 0.085 * wander(t) + 0.034 * ripple(t) + 0.02 * tooth(t) + 0.016 * fray(t) + 0.06 * Math.max(0, bite(t) - 0.5);
    const fw = 0.028 + 0.09 * Math.pow(0.5 + 0.5 * width(t), 2.2) + 0.018 * Math.abs(shred(t));
    A.push([x - nx * inA, y - ny * inA]);
    B.push([x - nx * (inA + fw), y - ny * (inA + fw)]);
  }
  const fibers = [];
  for (let k = 0; k < 640; k++) {
    const i = (r() * count) | 0;
    const nx = base[i][2];
    const ny = base[i][3];
    const len = 0.03 + r() * r() * 0.2;
    const [sx, sy, ex, ey] = strand(r, A[i][0], A[i][1], nx, ny, 1.9, len, 0.04);
    const bend = (r() - 0.5) * 0.7 * len;
    const mx = (sx + ex) / 2 - (ey - sy) * (bend / len);
    const my = (sy + ey) / 2 + (ex - sx) * (bend / len);
    fibers.push([sx, sy, mx, my, ex, ey]);
  }
  const fuzz = [];
  for (let k = 0; k < 1100; k++) {
    const i = (r() * count) | 0;
    fuzz.push(strand(r, A[i][0], A[i][1], base[i][2], base[i][3], 2.2, 0.012 + r() * 0.045, 0.02));
  }
  return { A, B, fibers, fuzz };
}

// Short loose fibres standing off the cut edge of a block.
function edgeFuzz(outline, seed, count) {
  const r = rng(seed);
  const pts = resample(outline, 0.04);
  const out = [];
  for (let k = 0; k < count; k++) {
    const [x, y, nx, ny] = pts[(r() * pts.length) | 0];
    out.push(strand(r, x, y, nx, ny, 2.0, 0.012 + r() * r() * 0.07, 0.015));
  }
  return out;
}

function seatCluster(name, x0, y0, cols, rows, laneX) {
  const seats = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * SEAT_PITCH;
      const y = y0 + r * SEAT_PITCH;
      seats.push({
        cluster: name,
        x,
        y,
        cx: x + SEAT / 2,
        cy: y + SEAT / 2,
        gapY: y + SEAT + (SEAT_PITCH - SEAT) / 2,
        laneX,
        flash: 0,
        on: 1,
        order: 0,
        outline: roundedRect(x, y, SEAT, SEAT, 0.04, 1),
      });
    }
  }
  return { name, x0, y0, cols, rows, laneX, seats };
}

function buildWorld() {
  const box = (id, label, x, y, w, d, h, kind = "tile", paper = CARD) => {
    const outline = roundedRect(x, y, w, d, kind === "sled" ? 0.06 : 0.08, 2);
    return { id, label, x, y, w, d, h, kind, paper, glow: 0, outline, fuzz: edgeFuzz(outline, hash(id), Math.round((w + d) * 28)) };
  };

  const hardware = {
    title: "Infrastructure",
    boxes: [
      box("weights", "Open-weight models", 5.9, 1.5, 5.1, 2.6, 0.5, "tile", BLUE),
      box("gpu0", "", 1.2, 5.4, 2.0, 5.6, 1.0, "sled", COAL),
      box("gpu1", "", 3.8, 5.4, 2.0, 5.6, 1.0, "sled", COAL),
      box("gpu2", "", 6.4, 5.4, 2.0, 5.6, 1.0, "sled", COAL),
      box("gpu3", "", 9.0, 5.4, 2.0, 5.6, 1.0, "sled", COAL),
    ],
    traces: [
      [[2.2, 5.4], [2.2, 4.75], [7.4, 4.75]],
      [[4.8, 5.4], [4.8, 4.75]],
      [[7.4, 5.4], [7.4, 4.1]],
      [[10.0, 5.4], [10.0, 4.1]],
    ],
  };
  hardware.sleds = hardware.boxes.filter((b) => b.kind === "sled");
  hardware.sleds.forEach((s, i) => {
    s.load = 0.6 + 0.08 * i;
    s.seed = i * 1.7 + 0.4;
  });

  const software = {
    title: "Platform",
    boxes: [
      box("agents", "Coding agents", 1.0, 3.6, 4.6, 4.0, 0.45),
      box("sei", "SEI dashboard", 6.4, 3.6, 4.6, 4.0, 0.45),
      box("gateway", "Model API", 1.0, 9.2, 10.0, 1.8, 0.5, "bar"),
    ],
    // the agents call the Model API; its usage records feed the dashboard; frontier calls leave at its end
    traces: [
      [[2.3, 7.6], [2.3, 9.2]],
      [[4.3, 7.6], [4.3, 9.2]],
      [[7.7, 9.2], [7.7, 7.6]],
      [[9.7, 9.2], [9.7, 7.6]],
      [[11.05, GATE_Y], [11.85, GATE_Y]],
    ],
    // holes through the Model API bar and the sheet, one over each GPU
    holes: SLED_X.map((x) => ({ x, y: GATE_Y, ping: 0 })),
    meter: [0.35, 0.55, 0.42, 0.7, 0.5, 0.62],
    code: new Array(5).fill(0),
  };
  software.by = Object.fromEntries(software.boxes.map((b) => [b.id, b]));

  const clusters = [
    seatCluster("a", 1.0, 1.0, 5, 3, 5.3),
    seatCluster("b", 6.63, 1.0, 5, 3, 8.2),
    seatCluster("c", 1.0, 4.6, 3, 4, 2.57),
  ];
  const seats = clusters.flatMap((c) => c.seats);
  // A stable order for the rollout rings: nearest the lane first within each team, teams interleaved.
  const byTeam = clusters.map((c) => [...c.seats].sort((p, q) => Math.abs(p.cx - c.laneX) + p.cy * 0.2 - (Math.abs(q.cx - c.laneX) + q.cy * 0.2)));
  let n = 0;
  for (let i = 0; i < 16; i++) for (const team of byTeam) if (team[i]) team[i].order = n++;

  const organisation = {
    title: "Organization",
    clusters,
    seats,
    boxes: [
      box("policy", "Policy", 5.6, 4.6, 2.4, 1.9, 0.22),
      box("limits", "Limits", 8.4, 4.6, 2.4, 1.9, 0.22),
      box("runbooks", "Runbooks", 5.6, 6.9, 2.4, 1.9, 0.22),
      box("training", "Training", 8.4, 6.9, 2.4, 1.9, 0.22),
    ],
    ports: [
      { x: 2.57, y: GATE_Y, ping: 0 },
      { x: 5.3, y: GATE_Y, ping: 0 },
      { x: 8.2, y: GATE_Y, ping: 0 },
    ],
    traces: [
      [[5.3, 1.73], [5.3, GATE_Y]],
      [[8.2, 1.73], [8.2, GATE_Y]],
      [[2.57, 5.33], [2.57, GATE_Y]],
      [[1.0, 1.73], [5.3, 1.73]],
      [[1.0, 2.57], [5.3, 2.57]],
      [[1.0, 3.41], [5.3, 3.41]],
      [[6.63, 1.73], [10.61, 1.73]],
      [[6.63, 2.57], [10.61, 2.57]],
      [[6.63, 3.41], [10.61, 3.41]],
      [[1.0, 5.33], [3.3, 5.33]],
      [[1.0, 6.17], [3.3, 6.17]],
      [[1.0, 7.01], [3.3, 7.01]],
      [[1.0, 7.85], [3.3, 7.85]],
    ],
  };

  return { hardware, software, organisation, sheets: [tornSheet(1103), tornSheet(2207), tornSheet(3301)] };
}

// Painter's order for blocks that do not overlap: a block wholly behind another along y, or
// else along x, is drawn first. (Ordering by centre fails for long bars beside short blocks.)
function behindFirst(a, b) {
  if (a.y + a.d <= b.y + 1e-6) return -1;
  if (b.y + b.d <= a.y + 1e-6) return 1;
  if (a.x + a.w <= b.x + 1e-6) return -1;
  if (b.x + b.w <= a.x + 1e-6) return 1;
  return a.x + a.w / 2 + a.y + a.d / 2 - (b.x + b.w / 2 + b.y + b.d / 2);
}

// ---------------------------------------------------------------- the figure

export function createStack(root, opts = {}) {
  const canvas = root.querySelector("canvas");
  if (!canvas) return null;
  const main = canvas.getContext("2d");
  if (!main) return null;
  const mode = opts.mode || "hero";
  const still = !!opts.reduceMotion;
  const world = buildWorld();
  for (const layer of [world.hardware, world.software, world.organisation]) layer.boxes.sort(behindFirst);

  // Drawing goes to `ctx`: the canvas itself, or a buffer when a whole layer has to fade as one sheet.
  let ctx = main;
  const tile = paperGrain();
  const mainGrain = main.createPattern(tile, "repeat");
  let grainFill = mainGrain;
  let buf = null;
  let bctx = null;
  let bufGrain = null;
  let size = null;

  const tight = mode === "inline" || mode === "page";
  const isStory = mode === "story";
  const big = mode === "hero" || isStory;
  const baseGap = tight ? 5.4 : big ? 4.6 : 5.0;
  const speed = big ? 9 : 8; // world units a second
  const st = {
    w: 0,
    h: 0,
    dpr: 1,
    time: 0,
    last: 0,
    visible: false,
    raf: 0,
    gap: baseGap,
    explode: 0,
    focus: opts.focus ? INDEX[opts.focus] : null,
    focusW: opts.focus ? 1 : 0,
    fPos: opts.focus ? INDEX[opts.focus] : 0,
    // the story's position: where scrolling points, and where the figure has eased to
    storyTarget: 0,
    story: 0,
    over: 0,
    alpha: [1, 1, 1],
    yaw: 0,
    pitch: 0,
    yawT: 0,
    pitchT: 0,
    // figures in view on arrival assemble themselves; the small chapter figures are already built
    intro: still || mode === "inline" ? 9 : 0,
    spawnIn: 0.2,
    ring: 0,
    ringLabel: "",
  };
  const cam = { s: 30, ox: 0, oy: 0, cos: Math.SQRT1_2, sin: Math.SQRT1_2, pitch: 0.42 };
  const pulses = [];

  // ---- projection

  function proj(x, y, z) {
    const dx = x - CX;
    const dy = y - CY;
    const xr = dx * cam.cos - dy * cam.sin;
    const yr = dx * cam.sin + dy * cam.cos;
    return [cam.ox + xr * cam.s, cam.oy + yr * cam.pitch * cam.s - z * cam.s];
  }
  const depth = (x, y) => (x - CX) * cam.sin + (y - CY) * cam.cos;

  function plateZ(i) {
    const e = introOf(i);
    const drop = (1 - e) * (3.2 + i * 1.6);
    return i * st.gap + drop;
  }
  function introOf(i) {
    return easeOutExpo(clamp((st.intro - 0.15 - i * 0.28) / 1.25));
  }
  function growOf(i) {
    return easeOutCubic((st.intro - 0.75 - i * 0.28) / 0.8);
  }
  // how much layer i is the one in focus, from 0 to 1
  function nearness(i) {
    if (isStory) return smooth(st.focusW) * clamp(1 - Math.abs(i - st.fPos));
    return st.focus === i ? smooth(st.focusW) : 0;
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
    }
  }

  function aim() {
    // Camera angles (with a little pointer parallax), scale and origin for this frame.
    const yaw = Math.PI / 4 + st.yaw;
    cam.cos = Math.cos(yaw);
    cam.sin = Math.sin(yaw);
    cam.pitch = 0.42 + st.pitch;

    const fitGap = isStory ? 5.6 : tight ? 5.4 : 5.0;
    const diag = (2 * P + BAND) * Math.SQRT1_2;
    const spanX = diag + 0.8;
    const spanY = diag * 0.42 + 2 * fitGap + 1.7;
    const padX = mode === "cta" ? 0 : 24;
    const padY = mode === "cta" ? 0 : 28;
    const s0 = Math.min((st.w - padX) / spanX, (st.h - padY) / spanY);

    const f = smooth(st.focusW);
    const zoomTo = mode === "inline" ? 1.72 : mode === "page" ? 1.32 : 1.22;
    // Zoom in on the focused sheet, but never past the width of the frame, so its torn edges stay in view.
    const fitWidth = (st.w - padX) / (diag + 0.5);
    // the story's overview steps back and to the right, leaving room for its notes on the left
    const base = s0 * (1 - 0.34 * st.over);
    cam.s = Math.min(base * (1 + (zoomTo - 1) * f), Math.max(base, fitWidth));
    cam.ox = st.w / 2 + st.over * st.w * 0.16;

    const top = 2 * st.gap + 1.2;
    const whole = st.h / 2 + ((top - PLATE_T) * cam.s) / 2;
    const fi = isStory ? st.fPos : st.focus == null ? st.lastFocus || 0 : st.focus;
    const focused = st.h / 2 + fi * st.gap * cam.s + 0.3 * cam.s;
    cam.oy = whole + (focused - whole) * f;
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

  // The cut edge of a sheet or block: a quad for every segment of its outline that faces the camera,
  // shaded by the way it faces. Quads of one shade share a path, so a torn edge costs a few fills.
  // `soft` averages the light over that many neighbours each side, so a ragged edge does not stripe.
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
  // The outline itself is filled too, but whatever stands on it covers that.
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

  // Short strands [x0, y0, x1, y1] at height z, stroked as one path.
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

  // Run fn with the canvas mapped onto the horizontal plane at height z,
  // in world units scaled by k (so text can be set at a sane pixel size).
  function onPlane(x, y, z, k, fn) {
    const o = proj(x, y, z);
    const d = st.dpr;
    const s = cam.s * k;
    ctx.save();
    ctx.setTransform(d * cam.cos * s, d * cam.sin * cam.pitch * s, -d * cam.sin * s, d * cam.cos * cam.pitch * s, d * o[0], d * o[1]);
    fn();
    ctx.restore();
  }

  // The vertical wall that faces +y (spanned by world x and z).
  function onWallY(x, y, z, fn) {
    const o = proj(x, y, z);
    const d = st.dpr;
    ctx.save();
    ctx.setTransform(d * cam.cos * cam.s, d * cam.sin * cam.pitch * cam.s, 0, -d * cam.s, d * o[0], d * o[1]);
    fn();
    ctx.restore();
  }

  // Text printed on a plane, in the page's sans. It is drawn only when it will be large enough to read.
  // In the whole-stack views small labels need 13px to be legible; in the magnified views 10px will do.
  function label(text, x, y, z, size, color, weight = 500, minPx = mode === "hero" || mode === "cta" || (isStory && st.focusW < 0.5) ? 13 : 10) {
    if (size * cam.s < minPx) return;
    onPlane(x, y, z, size / 100, () => {
      ctx.font = `${weight} 100px ${SANS}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.fillStyle = color;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, 0, 0);
    });
  }

  // A layer's name, printed in the clear band along the sheet's front edge.
  // In the story's overview the notes beside the sheets name them instead.
  function layerName(text, z) {
    const a = 0.56 * (1 - st.over);
    if (a > 0.02) label(text, 0.9, P + 0.24, z + 0.004, 0.62, rgb(C.ink, a), 600, 9);
  }

  // The overview's notes: each sheet named beside its left corner, with a short leader line.
  function drawCallouts(zs) {
    const a = clamp((st.over - 0.45) / 0.4);
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    for (let i = 0; i < 3; i++) {
      const [name, note] = CALLOUTS[i];
      const p = proj(0.35, P + BAND - 0.35, zs[i]);
      const end = p[0] - 30;
      ctx.fillStyle = rgb(C.ink, 0.8);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgb(C.ink, 0.32);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p[0] - 5, p[1]);
      ctx.lineTo(end, p[1]);
      ctx.stroke();
      const x = end - 8;
      ctx.font = `600 15px ${SANS}`;
      ctx.fillStyle = rgb(C.ink, 0.92);
      ctx.fillText(name, x, p[1] - 4);
      // The note breaks where it prefers if that fits the room left of the line, else wraps word by
      // word, and is left out if even one word will not fit.
      ctx.font = `400 12.5px ${SANS}`;
      ctx.fillStyle = rgb(C.ink, 0.62);
      const room = x - 12;
      const fits = (t) => ctx.measureText(t).width <= room;
      let lines = note.split("|");
      if (!lines.every(fits)) {
        const plain = note.replace(/\|/g, " ");
        lines = [];
        let line = "";
        for (const word of plain.split(" ")) {
          const next = line ? `${line} ${word}` : word;
          if (fits(next)) line = next;
          else {
            if (line) lines.push(line);
            line = fits(word) ? word : null;
            if (line === null) break;
          }
        }
        if (line === null) lines = [];
        else if (line) lines.push(line);
      }
      lines.forEach((l, k) => ctx.fillText(l, x, p[1] + 14 + k * 16));
    }
    ctx.restore();
  }

  // A ring that spreads and fades on the plane, where a request has just passed.
  function ripple(x, y, z, r, color, alpha) {
    const ring = [];
    for (let k = 0; k <= 24; k++) ring.push([x + Math.cos((k / 24) * Math.PI * 2) * r, y + Math.sin((k / 24) * Math.PI * 2) * r]);
    polyline(ring, z, rgb(color, alpha), 1.2);
  }

  // A hole punched through the paper: dark inside, its far wall catching the light.
  function hole(x, y, z, rad, ping) {
    onPlane(x, y, z + 0.004, 1, () => {
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.fillStyle = rgb(C.holeWall);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.arc(rad * 0.26, rad * 0.26, rad, 0, Math.PI * 2);
      ctx.fillStyle = rgb(C.hole);
      ctx.fill();
      ctx.restore();
    });
    if (ping > 0.02) ripple(x, y, z + 0.004, rad + 0.1 + 0.55 * (1 - ping), C.blue, 0.75 * ping);
  }

  // ---- plates and what stands on them

  function drawPlate(i, z) {
    const sheet = world.sheets[i];
    const k = cam.s / 30;
    // the sheet in focus lifts a little: its shadow spreads and drops
    const lift = nearness(i);
    castShadow(sheet.A, z - PLATE_T, (16 + 12 * lift) * k, (5 + 3 * lift) * k, (11 + 8 * lift) * k, 0.2 + 0.06 * lift);
    slab(sheet.A, z - PLATE_T, z, C.edgeShade, C.edgeLit, 3);

    // the white torn fringe, then the face of the sheet inside it, lit from the left
    pathAt(sheet.A, z);
    ctx.fillStyle = rgb(C.fringe);
    ctx.fill();
    const l = proj(0, P + BAND, z);
    const r = proj(P, 0, z);
    const g = ctx.createLinearGradient(l[0], l[1], r[0], r[1]);
    g.addColorStop(0, rgb(mix(C.sheet[i], [255, 255, 255], 0.22)));
    g.addColorStop(1, rgb(mix(C.sheet[i], C.edgeShade, 0.1)));
    pathAt(sheet.B, z);
    ctx.fillStyle = g;
    ctx.fill();
    grain(sheet.A, z, 1.7 + i * 4.3, 2.9 + i * 3.1, 1);

    // loose fibres and a short fuzz along the tear
    ctx.beginPath();
    for (const f of sheet.fibers) {
      const a = proj(f[0], f[1], z);
      const m = proj(f[2], f[3], z);
      const b = proj(f[4], f[5], z);
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
    }
    ctx.strokeStyle = C.fiber;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    strands(sheet.fuzz, z, C.fuzz, 0.45);
  }

  function drawBox(b, z, grow) {
    const h = b.h * grow;
    if (h <= 0.001) return;
    const paper = b.paper;
    const glow = clamp(b.glow);
    const k = cam.s / 30;
    castShadow(b.outline, z, 8 * k, 2.4 * k, 3.8 * k, 0.24);
    slab(b.outline, z, z + h, paper.shade, paper.lit);
    pathAt(b.outline, z + h);
    ctx.fillStyle = rgb(mix(paper.top, C.blueTint, glow * 0.6));
    ctx.fill();
    grain(b.outline, z + h, b.x * 1.31, b.y * 0.77, paper.grain);
    // the cut edge catches the light, and its fibres stand off it
    pathAt(b.outline, z + h);
    ctx.strokeStyle = paper.edge;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    strands(b.fuzz, z + h, paper.fuzz, 0.45);
  }

  function drawHardware(z, grow) {
    const hw = world.hardware;
    for (const t of hw.traces) groove(t, z);
    layerName(hw.title, z);

    const focused = nearness(0);
    for (const b of hw.boxes) {
      drawBox(b, z, grow);
      const top = z + b.h * grow;
      if (grow < 0.98) continue;
      if (b.kind === "sled") {
        // cooling fins pressed into the sled
        const fins = new Path2D();
        for (let fx = b.x + 0.32; fx < b.x + b.w - 0.2; fx += 0.34) {
          const a = proj(fx, b.y + 0.5, top);
          const c = proj(fx, b.y + b.d - 1.5, top);
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
        // a status light and a load bar on the wall that faces the viewer
        onWallY(b.x, b.y + b.d, z, () => {
          const load = clamp(b.load);
          ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
          ctx.fillRect(0.28, 0.4, b.w - 0.56, 0.16);
          ctx.fillStyle = rgb(C.blueTint, 0.6 + 0.4 * Math.max(focused, clamp(b.glow)));
          ctx.fillRect(0.28, 0.4, (b.w - 0.56) * load, 0.16);
          ctx.fillStyle = rgb(C.ok, 0.95);
          ctx.fillRect(0.28, 0.7, 0.14, 0.1);
        });
        label(`GPU ${b.id.slice(3) * 1 + 1}`, b.x + 0.4, b.y + b.d - 0.42, top + 0.004, 0.34, b.paper.text);
      } else {
        label(b.label, b.x + 0.3, b.y + b.d - 0.38, top + 0.004, 0.34, b.paper.text);
      }
    }
  }

  function drawSoftware(z, grow) {
    const sw = world.software;
    for (const t of sw.traces) groove(t, z);
    layerName(sw.title, z);
    const off = 0.5 * (1 - st.over);
    if (off > 0.02) label("To frontier models", 7.5, P + 0.24, z + 0.004, 0.4, rgb(C.ink, off), 500, 9);

    const focused = nearness(1);
    for (const b of sw.boxes) {
      drawBox(b, z, grow);
      const top = z + b.h * grow;
      if (grow < 0.98) continue;
      label(b.label, b.x + 0.3, b.y + b.d - 0.36, top + 0.004, b.kind === "bar" ? 0.4 : 0.38, b.paper.text);

      if (b.id === "agents") {
        // the agent writing code: five lines typed one after another, its suggestion in blue
        const lens = [2.8, 2.0, 2.4, 1.4, 2.2];
        const indent = [0, 0.35, 0.35, 0.7, 0];
        onPlane(b.x + 0.36, b.y + 0.45, top + 0.004, 1, () => {
          for (let k = 0; k < lens.length; k++) {
            const v = clamp(sw.code[k]);
            ctx.fillStyle = "rgba(70, 66, 60, 0.1)";
            ctx.fillRect(indent[k], k * 0.42, lens[k], 0.13);
            ctx.fillStyle = rgb(k === 2 ? C.blue : C.ink, 0.5 + 0.35 * v);
            ctx.fillRect(indent[k], k * 0.42, lens[k] * v, 0.13);
          }
        });
      }
      if (b.id === "sei") {
        // the dashboard: six bars, one per team, rising as their calls are metered
        onPlane(b.x + 0.42, b.y + 0.4, top + 0.004, 1, () => {
          ctx.fillStyle = "rgba(70, 66, 60, 0.16)";
          ctx.fillRect(0, 2.02, 3.7, 0.04);
          for (let k = 0; k < sw.meter.length; k++) {
            const v = clamp(sw.meter[k]);
            ctx.fillStyle = rgb(C.blue, 0.42 + 0.5 * v);
            ctx.fillRect(k * 0.62, 2.0 - 1.8 * v, 0.3, 1.8 * v);
          }
        });
      }
      if (b.id === "gateway") {
        // flow marks along the gateway, and the holes it hands requests down through
        const flow = (st.time * 0.9) % 1;
        onPlane(b.x + 3.6, b.y + 0.36, top + 0.004, 1, () => {
          for (let k = 0; k < 9; k++) {
            const u = (k + flow) / 9;
            ctx.fillStyle = rgb(C.blue, (0.2 + 0.4 * focused) * Math.sin(u * Math.PI));
            ctx.fillRect(u * 5.6, 0, 0.28, 0.12);
          }
        });
        for (const ho of sw.holes) hole(ho.x, ho.y, top, 0.2, ho.ping);
      }
    }
  }

  function drawOrganisation(z, grow) {
    const org = world.organisation;
    for (const t of org.traces) groove(t, z);
    layerName(org.title, z);
    if (st.ringLabel) label(st.ringLabel, 6.4, P + 0.24, z + 0.004, 0.34, rgb(C.blue, 0.95), 500, 9);

    // holes punched through the sheet, where requests drop to the Model API
    for (const port of org.ports) hole(port.x, port.y, z, 0.27, port.ping);

    for (const b of org.boxes) {
      drawBox(b, z, grow);
      if (grow >= 0.98) label(b.label, b.x + 0.26, b.y + b.d - 0.34, z + b.h + 0.004, 0.32, b.paper.text);
    }

    // seats: small squares of card, tinted blue as each one is rolled out
    const seats = [...org.seats].sort((a, b) => depth(a.cx, a.cy) - depth(b.cx, b.cy));
    const h = 0.14 * grow;
    const k = cam.s / 30;
    for (const s of seats) {
      if (h <= 0.001) break;
      const on = clamp(s.on);
      const hot = clamp(s.flash);
      for (const [ox, oy, a] of [[1.2, 2, 0.06], [0.6, 1, 0.11]]) {
        ctx.save();
        ctx.translate(ox * k, oy * k);
        pathAt(s.outline, z);
        ctx.fillStyle = rgb(C.shadow, a);
        ctx.fill();
        ctx.restore();
      }
      slab(s.outline, z, z + h, mix(C.cardShade, C.blueShade, hot * 0.7), mix(C.cardLit, C.blueLit, hot * 0.7));
      pathAt(s.outline, z + h);
      ctx.fillStyle = rgb(mix(mix(C.seat, C.blueTint, on * 0.45), C.blue, hot * 0.85));
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.62)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  // threads that hold each sheet over the one below, running from each hole to where requests land
  function drawRisers(lower, zLow, zHigh, alpha) {
    if (alpha <= 0.01) return;
    const pts = lower === 0 ? SLED_X.map((x) => [x, GATE_Y, 1.0]) : world.organisation.ports.map((p) => [p.x, p.y, 0.5]);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.beginPath();
    for (const [x, y, hLow] of pts) {
      const a = proj(x, y, zHigh - PLATE_T);
      const b = proj(x, y, zLow + hLow);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.strokeStyle = C.thread;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = rgb(C.blue, 0.9);
    for (const [x, y, hLow] of pts) {
      const b = proj(x, y, zLow + hLow);
      ctx.beginPath();
      ctx.arc(b[0], b[1], 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- requests

  // A request's path as nodes: [x, y, layerIndex, heightAboveThatPlate]. Every leg runs along a
  // groove or across the top of a bar, and every drop is through a hole, so nothing passes behind
  // a block. Segments: 0 off the seat, 1 along the row, 2 down the lane to the port, 3 through the
  // port onto the Model API, 4 along the Model API, then either 5 through its hole down to a GPU,
  // or (frontier) 5 down the bar's end and 6 along the groove off the sheet.
  function requestPath(seat, sledIndex) {
    const port = world.organisation.ports.find((p) => Math.abs(p.x - seat.laneX) < 0.01);
    const start = [
      [seat.cx, seat.cy, 2, 0.14],
      [seat.cx, seat.gapY, 2, 0.02],
      [seat.laneX, seat.gapY, 2, 0.02],
      [port.x, port.y, 2, 0.02],
      [port.x, port.y, 1, 0.5],
    ];
    if (sledIndex < 0) {
      return { seat, port, frontier: true, nodes: [...start, [10.85, GATE_Y, 1, 0.5], [11.25, GATE_Y, 1, 0.02], [OFF_X, GATE_Y, 1, 0.02]] };
    }
    const xm = SLED_X[sledIndex];
    return {
      seat,
      port,
      sled: world.hardware.sleds[sledIndex],
      hole: world.software.holes[sledIndex],
      nodes: [...start, [xm, GATE_Y, 1, 0.5], [xm, GATE_Y, 0, 1.0]],
    };
  }

  function nodePoints(pulse, zs) {
    return pulse.nodes.map((q) => [q[0], q[1], zs[q[2]] + q[3], q[2]]);
  }

  function spawn() {
    const seats = world.organisation.seats.filter((s) => s.on > 0.6);
    if (!seats.length) return;
    const seat = seats[(Math.random() * seats.length) | 0];
    const path = requestPath(seat, Math.random() < FRONTIER_SHARE ? -1 : (Math.random() * 4) | 0);
    // every request moves at the same pace, however far its seat is from the lane
    const pts = nodePoints(path, [plateZ(0), plateZ(1), plateZ(2)]);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    seat.flash = 1;
    pulses.push({ ...path, u: 0, dir: 1, rate: speed / Math.max(len, 1), dwell: 0, trail: [], at: null, marks: 0 });
  }

  function pulsePoint(pulse, zs) {
    const pts = nodePoints(pulse, zs);
    let total = 0;
    const lens = [];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
      lens.push(l);
      total += l;
    }
    let at = clamp(pulse.u) * total;
    for (let i = 0; i < lens.length; i++) {
      if (at <= lens[i] || i === lens.length - 1) {
        const t = lens[i] ? clamp(at / lens[i]) : 0;
        const a = pts[i];
        const b = pts[i + 1];
        const phase = a[3] === b[3] ? `p${a[3]}` : `r${Math.min(a[3], b[3])}`;
        return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, phase, seg: i };
      }
      at -= lens[i];
    }
    return null;
  }

  // Requests are blue paper dots on their way down; answers come back up as dots of ink.
  function drawPulses(phase) {
    const r0 = clamp(cam.s * 0.09, 2.2, 3.6);
    const d = st.dpr;
    for (const pulse of pulses) {
      const pt = pulse.at;
      if (!pt || pt.phase !== phase) continue;
      const p = proj(pt.x, pt.y, pt.z);
      const col = pulse.dir < 0 ? C.ink : C.blue;
      // a frontier call fades out as it leaves the sheet, and back in as its answer returns
      const fade = pulse.frontier ? clamp((OFF_X + 0.05 - pt.x) / 0.9) : 1;
      if (fade <= 0.01) continue;
      const tr = pulse.trail;
      ctx.lineCap = "round";
      for (let i = 1; i < tr.length; i++) {
        if (tr[i].phase !== phase || tr[i - 1].phase !== phase) continue;
        const a = proj(tr[i - 1].x, tr[i - 1].y, tr[i - 1].z);
        const b = proj(tr[i].x, tr[i].y, tr[i].z);
        const k = i / tr.length;
        ctx.strokeStyle = rgb(col, (pulse.dir < 0 ? 0.24 : 0.34) * k * fade);
        ctx.lineWidth = 0.5 + 1.4 * k;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      ctx.save();
      ctx.shadowColor = rgb(C.shadow, 0.36 * fade);
      ctx.shadowBlur = 3 * d;
      ctx.shadowOffsetX = 1 * d;
      ctx.shadowOffsetY = 1.6 * d;
      ctx.fillStyle = rgb(col, fade);
      ctx.beginPath();
      ctx.arc(p[0], p[1], r0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- time

  // what a request sets off as it passes each point, on the way down (bits 1-3) and back up (bits 4-5)
  function cue(p, seg) {
    const sw = world.software;
    const once = (bit, fn) => {
      if (!(p.marks & bit)) {
        p.marks |= bit;
        fn();
      }
    };
    if (p.dir > 0) {
      if (seg >= 3) once(1, () => (p.port.ping = 1));
      if (seg >= 4)
        once(2, () => {
          // the Model API meters the call, and the dashboard counts it
          sw.by.gateway.glow = 0.5;
          const k = (Math.random() * sw.meter.length) | 0;
          sw.meter[k] = Math.min(1, sw.meter[k] + 0.22);
        });
      if (seg >= 5 && p.hole) once(4, () => (p.hole.ping = 1));
    } else if (p.dir < 0) {
      if (seg < 5)
        once(8, () => {
          // the answer comes back up through the Model API to the developer's coding agent
          if (p.hole) p.hole.ping = 0.8;
          sw.by.gateway.glow = 0.4;
          sw.by.agents.glow = 0.45;
        });
      if (seg < 3) once(16, () => (p.port.ping = 0.8));
    }
  }

  function step(dt) {
    st.time += dt;
    st.intro += dt;

    const ease = (rate) => 1 - Math.exp(-dt * rate);
    if (isStory) {
      // follow the scroll live, easing a little so each beat settles into place
      st.story += (softLock(st.storyTarget) - st.story) * ease(7);
      const q = storyState(st.story);
      st.focusW = q.focusW;
      st.fPos = q.fPos;
      st.over = q.over;
      st.focus = st.focusW > 0.5 ? Math.round(st.fPos) : null;
      if (st.focus != null) st.lastFocus = st.focus;
      st.gap = baseGap + q.explode + st.focusW;
      for (let i = 0; i < 3; i++) st.alpha[i] = 1 - 0.82 * st.focusW * clamp((Math.abs(i - st.fPos) - 0.35) * 2.2);
    } else {
      const focusTarget = st.focus == null ? 0 : 1;
      st.focusW += (focusTarget - st.focusW) * ease(4.2);
      if (st.focus != null) st.lastFocus = st.focus;

      const gapTarget = baseGap + st.explode * 0.4 + (st.focus == null ? 0 : tight ? 0.4 : 1.0);
      st.gap += (gapTarget - st.gap) * ease(4.2);
      for (let i = 0; i < 3; i++) {
        const target = st.focus == null || st.focus === i ? 1 : tight ? 0.14 : 0.18;
        st.alpha[i] += (target - st.alpha[i]) * ease(5);
      }
    }
    st.yaw += (st.yawT - st.yaw) * ease(3);
    st.pitch += (st.pitchT - st.pitch) * ease(3);

    // decay of flashes
    const org = world.organisation;
    const sw = world.software;
    for (const s of org.seats) s.flash = Math.max(0, s.flash - dt * 1.6);
    for (const p of org.ports) p.ping = Math.max(0, p.ping - dt * 2.2);
    for (const p of sw.holes) p.ping = Math.max(0, p.ping - dt * 2.2);
    for (const b of world.hardware.boxes) b.glow = Math.max(0, b.glow - dt * 1.5);
    for (const b of sw.boxes) b.glow = Math.max(0, b.glow - dt * 2.4);
    for (let k = 0; k < sw.meter.length; k++) sw.meter[k] = Math.max(0.22, sw.meter[k] - dt * 0.05);
    for (const sled of world.hardware.sleds) {
      const wave = 0.72 + 0.16 * Math.sin(st.time * 0.7 + sled.seed) + 0.07 * Math.sin(st.time * 1.9 + sled.seed * 3);
      sled.load += (wave - sled.load) * ease(2);
    }

    // the rollout rings, shown when the organisation is in focus
    if (st.focus === 2 && !still) {
      st.ring = (st.ring + dt) % 11;
      const r = st.ring;
      const count = r < 0.8 ? 0 : r < 3.2 ? 10 : r < 5.8 ? 20 : org.seats.length;
      st.ringLabel = r < 0.8 ? "" : r < 3.2 ? "Ring 1: 10 developers" : r < 5.8 ? "Ring 2: 20 developers" : "Ring 3: everyone";
      const fadeOut = r > 10.2 ? 1 : 0;
      for (const s of org.seats) {
        const target = fadeOut ? 0 : s.order < count ? 1 : 0;
        s.on += (target - s.on) * ease(s.order < count ? 3 + (s.order % 10) * 0.25 : 6);
      }
    } else {
      st.ringLabel = still && st.focus === 2 ? "Ring 3: everyone" : "";
      for (const s of org.seats) s.on += (1 - s.on) * ease(4);
    }

    if (still) return;

    // the agent's code is typed out, then starts again
    const cycle = (st.time * 0.5) % 14;
    for (let k = 0; k < sw.code.length; k++) {
      const target = cycle > 1 + k * 1.2 && cycle < 11.5 ? 1 : 0;
      sw.code[k] += (target - sw.code[k]) * ease(target ? 1.8 : 5);
    }

    // requests: a steady stream at one pace, each pausing on its GPU before the answer comes back
    if (st.intro > 2.1) {
      st.spawnIn -= dt;
      if (st.spawnIn <= 0 && pulses.length < (mode === "cta" ? 4 : big ? 6 : 5)) {
        spawn();
        st.spawnIn = big ? 0.45 + Math.random() * 0.4 : 0.6 + Math.random() * 0.45;
      }
    }
    const zs = [plateZ(0), plateZ(1), plateZ(2)];
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      if (p.dir === 0) {
        p.dwell -= dt;
        if (p.dwell <= 0) p.dir = -1;
      } else {
        p.u += p.dir * p.rate * dt;
      }
      if (p.dir > 0 && p.u >= 1) {
        p.u = 1;
        p.dir = 0;
        p.dwell = p.frontier ? 0.6 : 0.42;
        p.trail.length = 0;
        if (p.sled) p.sled.glow = 1;
      } else if (p.dir < 0 && p.u <= 0) {
        p.seat.flash = 1;
        pulses.splice(i, 1);
        continue;
      }
      p.at = pulsePoint(p, zs);
      if (!p.at) continue;
      cue(p, p.at.seg);
      p.trail.push(p.at);
      if (p.trail.length > 12) p.trail.shift();
    }
  }

  function frame(now) {
    st.raf = 0;
    const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
    st.last = now;
    step(dt);
    draw();
    if (st.visible && !still) st.raf = requestAnimationFrame(frame);
  }

  // Draw one layer. A layer that is fading is drawn whole into a buffer first and laid down at
  // its opacity, so the parts of an opaque paper sheet never show through one another.
  function layer(alpha, fn) {
    if (alpha <= 0.01) return;
    if (alpha >= 0.995) {
      fn();
      return;
    }
    if (!buf) {
      buf = document.createElement("canvas");
      bctx = buf.getContext("2d");
      bufGrain = bctx.createPattern(tile, "repeat");
    }
    if (buf.width !== canvas.width || buf.height !== canvas.height) {
      buf.width = canvas.width;
      buf.height = canvas.height;
    }
    ctx = bctx;
    grainFill = bufGrain;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, buf.width, buf.height);
    set();
    fn();
    ctx = main;
    grainFill = mainGrain;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(buf, 0, 0);
    ctx.restore();
  }

  function draw() {
    layout();
    aim();
    ctx = main;
    grainFill = mainGrain;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    set();

    const zs = [plateZ(0), plateZ(1), plateZ(2)];
    const solo = mode === "inline";
    const riserIn = solo ? 0 : clamp((st.intro - 1.7) / 0.6);
    const layerAlpha = (i) => (solo && i !== st.focus ? 0 : clamp(introOf(i) * 1.5) * st.alpha[i]);

    layer(layerAlpha(0), () => {
      drawPlate(0, zs[0]);
      drawHardware(zs[0], growOf(0));
    });
    ctx.globalAlpha = layerAlpha(0);
    drawPulses("p0");

    ctx.globalAlpha = Math.min(layerAlpha(0), layerAlpha(1));
    drawRisers(0, zs[0], zs[1], riserIn);
    ctx.globalAlpha = Math.max(layerAlpha(0), layerAlpha(1));
    if (!solo) drawPulses("r0");
    ctx.globalAlpha = 1;

    layer(layerAlpha(1), () => {
      drawPlate(1, zs[1]);
      drawSoftware(zs[1], growOf(1));
    });
    ctx.globalAlpha = layerAlpha(1);
    drawPulses("p1");

    ctx.globalAlpha = Math.min(layerAlpha(1), layerAlpha(2));
    drawRisers(1, zs[1], zs[2], riserIn);
    ctx.globalAlpha = Math.max(layerAlpha(1), layerAlpha(2));
    if (!solo) drawPulses("r1");
    ctx.globalAlpha = 1;

    layer(layerAlpha(2), () => {
      drawPlate(2, zs[2]);
      drawOrganisation(zs[2], growOf(2));
    });
    ctx.globalAlpha = layerAlpha(2);
    drawPulses("p2");
    ctx.globalAlpha = 1;
    if (isStory) drawCallouts(zs);
  }

  function kick() {
    if (still) {
      // settle every eased value, then draw once
      for (let i = 0; i < 40; i++) step(0.1);
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

  // Track the size here rather than measuring the element on every frame.
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
    st.yawT = -nx * 0.1;
    st.pitchT = ny * 0.035;
  }
  function onLeave() {
    st.yawT = 0;
    st.pitchT = 0;
  }
  if (fine && !still && mode !== "inline") {
    area.addEventListener("pointermove", onMove, { passive: true });
    area.addEventListener("pointerleave", onLeave, { passive: true });
  }

  root.classList.add("is-live");

  // A figure that starts already built also starts busy: a few seconds of requests are in flight
  // before its first frame, and that frame is drawn now so it is never blank when scrolled to.
  if (!still && st.intro >= 9) {
    for (let i = 0; i < 70; i++) step(0.05);
    draw();
  }

  return {
    setFocus(name) {
      const next = name == null ? null : INDEX[name];
      if (next === st.focus) return;
      st.focus = next;
      if (still) {
        for (let i = 0; i < 40; i++) step(0.1);
        draw();
      }
    },
    setExplode(v) {
      st.explode = clamp(v);
    },
    // The home page's story position, from the scroll: 0 hero, 1 overview, 2 to 4 the layers.
    setStory(pos) {
      st.storyTarget = clamp(pos, 0, 4);
      if (still) {
        st.story = softLock(st.storyTarget);
        for (let i = 0; i < 40; i++) step(0.1);
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
