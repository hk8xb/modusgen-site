import { BOOKING_URL } from "./config.js";
import { createStack } from "./stack.js";
import { initTerminal } from "./term.js";

const html = document.documentElement;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ---------------------------------------------------------------- booking

if (BOOKING_URL) {
  for (const a of $$("a[data-book]")) {
    a.href = BOOKING_URL;
    a.target = "_blank";
    a.rel = "noopener";
  }
}

// ---------------------------------------------------------------- navigation

const nav = $("[data-nav]");
const navToggle = $("[data-nav-toggle]");

function closeMenu() {
  nav.classList.remove("is-open");
  html.classList.remove("is-menu");
  navToggle.setAttribute("aria-expanded", "false");
}
if (nav && navToggle) {
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    html.classList.toggle("is-menu", open);
    navToggle.setAttribute("aria-expanded", String(open));
  });
  for (const a of $$(".nav__links a", nav)) a.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && nav.classList.contains("is-open")) {
      closeMenu();
      navToggle.focus();
    }
  });
}

// ---------------------------------------------------------------- page entrance

// The page title rises line by line. Titles holding anything other than plain words
// and a .tone span are left whole, and simply fade in.
function intro() {
  const title = $("[data-lines]");
  const plain = title && [...title.children].every((el) => el.classList.contains("tone"));
  if (!title || reduce || !plain) {
    html.classList.add("is-in");
    return;
  }
  const original = title.innerHTML;
  const text = title.textContent.replace(/\s+/g, " ").trim();
  const words = [];
  for (const node of title.childNodes) {
    const tone = node.nodeType === 1;
    for (const w of node.textContent.split(/\s+/).filter(Boolean)) words.push({ w, tone });
  }
  title.innerHTML = words.map((x, i) => `<span class="w${x.tone ? " tone" : ""}" data-i="${i}">${x.w}</span>`).join(" ");
  const lines = [];
  let top = null;
  for (const el of $$(".w", title)) {
    if (el.offsetTop !== top) {
      lines.push([]);
      top = el.offsetTop;
    }
    lines[lines.length - 1].push(words[Number(el.dataset.i)]);
  }
  title.setAttribute("aria-label", text);
  title.innerHTML = lines
    .map((line, i) => {
      const inner = line.map((x) => (x.tone ? `<span class="tone">${x.w}</span>` : x.w)).join(" ");
      return `<span class="line" aria-hidden="true"><span class="line__in" style="--i:${i}">${inner}</span></span>`;
    })
    .join("");
  requestAnimationFrame(() => html.classList.add("is-in"));
  // once it has played, put the original markup back so the heading reflows freely
  setTimeout(() => {
    title.innerHTML = original;
    title.removeAttribute("aria-label");
  }, 2200);
}

const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 900))]).then(intro);

// ---------------------------------------------------------------- the stack figures

const stacks = {};
function ensureStacks() {
  for (const el of $$("[data-stack]")) {
    if (el.dataset.live) continue;
    if (getComputedStyle(el).display === "none") continue;
    const host = el.closest(".story__stage");
    if (host && getComputedStyle(host).display === "none") continue;
    const mode = el.dataset.stack;
    const stack = createStack(el, {
      mode,
      focus: el.dataset.focus || null,
      reduceMotion: reduce,
      pointerArea: mode === "story" ? el.closest("[data-story]") : mode === "hero" ? el.closest(".hero") : el,
    });
    if (!stack) continue;
    el.dataset.live = "1";
    if (mode === "hero" || mode === "story" || mode === "page") stacks[mode] = stack;
  }
}
ensureStacks();
window.matchMedia("(max-width: 1000px)").addEventListener("change", () => {
  ensureStacks();
  ensureKits();
  onScroll();
});

// ---------------------------------------------------------------- the platform page's paper objects

// Loaded only where the page has them, carrying this script's version so a new build is fetched fresh.
const kitEls = $$("[data-kit]");
const kits = {};
let createKit = null;
if (kitEls.length) {
  import(`./kit.js${new URL(import.meta.url).search}`).then((m) => {
    createKit = m.createKit;
    ensureKits();
    onScroll();
  });
}
function ensureKits() {
  if (!createKit) return;
  for (const el of kitEls) {
    if (el.dataset.live) continue;
    if (getComputedStyle(el).display === "none") continue;
    const host = el.closest(".story__stage");
    if (host && getComputedStyle(host).display === "none") continue;
    const mode = el.dataset.kit;
    const kit = createKit(el, {
      mode,
      piece: el.dataset.kitPiece || null,
      reduceMotion: reduce,
      pointerArea: mode === "stage" ? el.closest("[data-spotlight]") : el,
    });
    if (!kit) continue;
    el.dataset.live = "1";
    if (mode === "stage") kits.stage = kit;
  }
}

// ---------------------------------------------------------------- the story: one figure from the hero through the tour

// Each beat (the hero, the overview, the three chapters) is an anchor. The story position is where
// the middle of the screen falls among their centres: 0 at the hero, 1 at the overview, 2 to 4 at
// the chapters. The figure eases toward it and holds each beat for a while: a soft lock.
const story = $("[data-story]");
const stage = $("[data-stage]");
const anchors = story ? $$("[data-anchor]", story) : [];
const dots = $$("[data-dot]");
const LAYERS = ["hardware", "software", "organisation"];
let storyLayer;
function updateStory(vh) {
  if (!anchors.length) return;
  const mid = vh / 2;
  const centres = anchors.map((el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  });
  const last = centres.length - 1;
  let pos = mid >= centres[last] ? last : 0;
  for (let k = 0; k < last; k++) {
    if (mid < centres[k + 1]) {
      pos = k + clamp((mid - centres[k]) / (centres[k + 1] - centres[k]));
      break;
    }
  }
  if (stacks.story) stacks.story.setStory(reduce ? Math.round(pos) : pos);
  const touring = pos >= 1.5;
  if (stage) stage.classList.toggle("is-tour", touring);
  const layer = touring ? LAYERS[clamp(Math.round(pos) - 2, 0, 2)] : null;
  if (layer === storyLayer) return;
  storyLayer = layer;
  for (const d of dots) {
    const on = d.dataset.dot === layer;
    d.classList.toggle("is-on", on);
    if (on) d.setAttribute("aria-current", "true");
    else d.removeAttribute("aria-current");
  }
}

// ---------------------------------------------------------------- process line

const steps = $(".steps");
const stepItems = steps ? $$(".step", steps) : [];
function updateProcess(vh) {
  if (!steps) return;
  const r = steps.getBoundingClientRect();
  const p = reduce ? 1 : clamp((vh * 0.82 - r.top) / (vh * 0.5 + r.height * 0.35));
  steps.style.setProperty("--prog", p.toFixed(3));
  stepItems.forEach((s, i) => s.classList.toggle("is-on", p > i / stepItems.length + 0.015));
}

// ---------------------------------------------------------------- the platform page: one object per piece

// Each piece of software is a beat. The pinned figure follows the reading line, a little above the
// middle of the screen, as it passes from the opening to each piece's middle: -1 shows all six objects,
// 0 to 5 one object each, and in between the old one lifts away as the next drops in (the figure holds
// each beat for a while: a soft lock). The piece nearest the line is marked in the list under the
// figure; the one already marked keeps a margin before the next takes over, so it settles, not flickers.
const spotlight = $("[data-spotlight]");
const pieces = spotlight ? $$("[data-spot]", spotlight) : [];
const spotMarks = $$("[data-spot-mark]");
const spotStage = spotlight ? $("[data-spot-stage]", spotlight) : null;
const spotOpening = spotlight ? $(".soft-hero", spotlight) : null;
let spotIndex = -1;
function updateSpot(vh) {
  if (!pieces.length) return;
  const line = vh * 0.46;
  if (kits.stage) {
    const beats = [spotOpening, ...pieces].filter(Boolean);
    const centres = beats.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    const last = centres.length - 1;
    let pos = line >= centres[last] ? last : 0;
    for (let k = 0; k < last; k++) {
      if (line < centres[k + 1]) {
        pos = k + clamp((line - centres[k]) / (centres[k + 1] - centres[k]));
        break;
      }
    }
    const shift = spotOpening ? 1 : 0;
    kits.stage.setPos((reduce ? Math.round(pos) : pos) - shift);
  }
  let best = -1;
  let bestD = Infinity;
  pieces.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const d = Math.abs(r.top + r.height / 2 - line) - (i === spotIndex ? r.height * 0.2 : 0);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (pieces[0].getBoundingClientRect().top > vh * 0.78) best = -1;
  if (best === spotIndex) return;
  spotIndex = best;
  const el = best >= 0 ? pieces[best] : null;
  pieces.forEach((p, i) => p.classList.toggle("is-on", i === best));
  for (const m of spotMarks) {
    const on = el != null && m.dataset.spotMark === el.id;
    m.classList.toggle("is-on", on);
    if (on) m.setAttribute("aria-current", "true");
    else m.removeAttribute("aria-current");
  }
  if (spotStage) spotStage.classList.toggle("is-tour", best >= 0);
}

// pieces rise into place the first time they are seen; their ticks follow one by one
for (const el of $$("[data-reveal]")) whenSeenLater(el);
function whenSeenLater(el) {
  if (reduce || !("IntersectionObserver" in window)) {
    el.classList.add("is-in");
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      el.classList.add("is-in");
    },
    { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
  );
  io.observe(el);
}

// ---------------------------------------------------------------- the platform page: one call, end to end

// Played once when first seen. The playhead holds at the start while the call hops from the agent to
// the gateway to vLLM, sweeps to the last token, then holds while the answer goes back up and the
// team's totals tick over. Each moment's label and its record lines come up as the call reaches them.
const trace = $("[data-trace]");
if (trace) {
  const call = trace.closest(".call") || document;
  const evs = Object.fromEntries($$("[data-ev]", trace).map((el) => [el.dataset.ev, el]));
  const lines = $$(".jl", call);
  const nums = $$(".tn", call);
  const laneEls = $$(".lane__track", trace);
  const nowEl = $(".trace__now", trace);
  const END = 6120;
  // [seconds into the play, the lane the call is on, the moments that come up]
  const BEATS = [
    [0.05, 0, ["sent"]],
    [0.4, 1, ["check"]],
    [0.72, 2, ["out"]],
    [3.5, 1, ["record"]],
    [3.8, 0, ["shown"]],
    [4.1, 3, ["totals", "back"]],
  ];
  const SWEEP = [0.8, 3.35];
  const laneY = (k) => laneEls[k].offsetTop + (window.matchMedia("(max-width: 760px)").matches ? 38 : 47);

  // the call's path, drawn down the lanes it crosses: at the start agent to vLLM, at the end all four
  const hops = Object.fromEntries($$("[data-hop]", trace).map((el) => [el.dataset.hop, el]));
  const placeHops = () => {
    for (const [name, el] of Object.entries(hops)) {
      const ys = (name === "out" ? [0, 1, 2] : [0, 1, 2, 3]).map(laneY);
      const top = Math.min(...ys);
      el.style.top = top + "px";
      el.style.height = Math.max(...ys) - top + "px";
      el.innerHTML = ys.map((y) => '<i style="top: ' + (y - top) + 'px"></i>').join("");
    }
  };
  placeHops();
  window.addEventListener("resize", placeHops, { passive: true });

  const countUp = () => {
    for (const n of nums) {
      const from = Number(n.textContent);
      const to = Number(n.dataset.to);
      const start = performance.now();
      n.classList.add("is-hit");
      const tick = (now) => {
        const t = clamp((now - start) / 700);
        n.textContent = String(Math.round(from + (to - from) * easeOutExpo(t)));
        if (t < 1) requestAnimationFrame(tick);
        else setTimeout(() => n.classList.remove("is-hit"), 900);
      };
      requestAnimationFrame(tick);
    }
  };
  const moment = (id) => {
    if (evs[id]) evs[id].classList.add("is-on");
    if (hops[id]) hops[id].classList.add("is-on");
    for (const l of lines) {
      if (l.dataset.at !== id) continue;
      l.classList.add("is-on", "is-hit");
      setTimeout(() => l.classList.remove("is-hit"), 650);
    }
    if (id === "totals") countUp();
  };

  whenSeen(
    trace,
    () => {
      if (reduce) {
        trace.style.setProperty("--now", END);
        Object.keys(evs).forEach((id) => evs[id].classList.add("is-on"));
        Object.values(hops).forEach((el) => el.classList.add("is-on"));
        lines.forEach((l) => l.classList.add("is-on"));
        nums.forEach((n) => (n.textContent = n.dataset.to));
        return;
      }
      trace.style.setProperty("--dot-y", `${laneY(0)}px`);
      trace.classList.add("is-playing");
      const t0 = performance.now();
      let beat = 0;
      let first = false;
      const frame = (now) => {
        const t = (now - t0) / 1000;
        const u = clamp((t - SWEEP[0]) / (SWEEP[1] - SWEEP[0]));
        const ms = END * (u < 0.5 ? 2 * u * u : 1 - Math.pow(2 - 2 * u, 2) / 2);
        trace.style.setProperty("--now", ms.toFixed(1));
        nowEl.textContent = `${(ms / 1000).toFixed(2)} s`;
        if (!first && ms >= 380) {
          first = true;
          moment("first");
        }
        while (beat < BEATS.length && t >= BEATS[beat][0]) {
          const [, lane, ids] = BEATS[beat];
          trace.style.setProperty("--dot-y", `${laneY(lane)}px`);
          ids.forEach(moment);
          beat++;
        }
        if (t < 5) requestAnimationFrame(frame);
        else trace.classList.remove("is-playing");
      };
      requestAnimationFrame(frame);
    },
    0.45
  );
}

// ---------------------------------------------------------------- one scroll loop

const hero = $(".hero");
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (nav) nav.classList.toggle("is-stuck", y > 12);
    if (stacks.hero && hero) stacks.hero.setExplode(clamp(y / (hero.offsetHeight * 0.75)));
    updateStory(vh);
    updateProcess(vh);
    updateSpot(vh);
  });
}
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll, { passive: true });
onScroll();

// ---------------------------------------------------------------- things that start when seen

function whenSeen(el, fn, threshold = 0.35) {
  if (!el) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      fn(el);
    },
    { threshold }
  );
  io.observe(el);
}

// console: meters fill, costs count up
whenSeen($("[data-console]"), (el) => {
  el.classList.add("is-in");
  if (reduce) return;
  const money = new Intl.NumberFormat("en-US");
  $$("tbody td:last-child, tfoot td:last-child", el).forEach((cell, i) => {
    const target = Number(cell.textContent.replace(/[^0-9.]/g, ""));
    const start = performance.now() + i * 60;
    const tick = (now) => {
      const t = clamp((now - start) / 1100);
      cell.textContent = `$${money.format(Math.round(target * easeOutExpo(t)))}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    cell.textContent = "$0";
    requestAnimationFrame(tick);
  });
});

const term = $("[data-term]");
if (term) initTerminal(term, { reduce });

// ---------------------------------------------------------------- economics: one workflow's bill, three ways

// The same model as docs/research/sales-2026-11-12/workflow_tiers.py. Prices per million tokens:
// new input, cache write, cached read, output (list prices read Nov 12-13, 2026). Claude bills new
// input in agent work as cache writes; open-weight hosts charge no cache-write premium.
const calc = $("[data-calc]");
if (calc) {
  const PRICE = {
    opus: [4, 5, 0.2, 20],
    sonnet: [2, 2.5, 0.1, 10],
    kimi: [2, 2, 0.2, 10],
    dsflash: [0.3, 0.3, 0.006, 1.2],
    glmflash: [0.15, 0.15, 0.03, 0.5],
  };
  // tokens per unit of work: new input, cached input, output; true when Claude bills new input as cache writes
  const UNIT = {
    coding: [480_000, 7_520_000, 50_000, true],
    agent: [400_000, 1_600_000, 60_000, true],
    page: [3_000, 0, 300, false],
  };
  // street prices (business/gpu-sourcing.md) and power at full load
  const SERVER = {
    b300: { name: "8-GPU B300", capex: 537_196, kw: 14.5 },
    h200: { name: "8-GPU H200", capex: 318_117, kw: 10.2 },
    rtx: { name: "8-card RTX PRO 6000", capex: 170_000, kw: 9.1 },
  };
  const TIER = {
    coding: {
      unit: "coding", claude: "opus", open: "kimi", server: "b300", rate: null, shape: "office", bill: 115_000,
      claudeName: "Claude Opus 5.5", openName: "Kimi K3.1 Pro, hosted",
      fine: "On Claude Sonnet 5.5, hosted Kimi costs about a fifth more per coding task; the saving there comes from owned servers or routine tasks on the workhorse tier. At 1.65 times Opus's tokens, the hosted saving is gone. Developer time at $120 an hour.",
    },
    agents: {
      unit: "agent", claude: "sonnet", open: "dsflash", server: "h200", rate: 2524, shape: "office", bill: 40_000,
      claudeName: "Claude Sonnet 5.5", openName: "DeepSeek V4.1 Flash, hosted",
      speed: "Server speed: about 2,500 output tokens a second for each 8-GPU H200 server, as NVIDIA measured it.",
      fine: "Priced on an employee agent's working day. Support conversations save 88% hosted, and knowledge queries 86%.",
    },
    docs: {
      unit: "page", claude: "sonnet", open: "glmflash", server: "rtx", rate: 3000, shape: "round", bill: 10_000,
      claudeName: "Claude Sonnet 5.5", openName: "GLM-5.3-Flash, hosted",
      speed: "Server speed: about 3,000 output tokens a second for each 8-card RTX PRO 6000 server, our estimate. This work runs around the clock.",
      fine: "On Claude Haiku 5.5's price for short prompts, hosted open models cost a quarter to a third more. Haiku work moves for better agent results, data control, or prompts over 100,000 tokens, where its price rises fivefold.",
    },
  };
  const HOURS = 730;
  const WORK_SEC = 10 * 22 * 3600; // office hours in a month; 80% of interactive work falls in them
  const MONTH_SEC = HOURS * 3600;
  const OPUS_USER = 577; // a heavy coding-agent user's month on Opus 5.5 (117.7 tasks)
  const DEV_MONTH = 120 * 160; // developer time, $120 an hour

  const unitTokens = (u) => UNIT[u][0] + UNIT[u][1] + UNIT[u][2];
  const unitCost = (p, u) => {
    const [fresh, cached, out, writes] = UNIT[u];
    const [pIn, pWrite, pCached, pOut] = PRICE[p];
    return (fresh * (writes ? pWrite : pIn) + cached * pCached + out * pOut) / 1e6;
  };
  const perMillion = (p, u) => unitCost(p, u) / (unitTokens(u) / 1e6);
  // power at PUE 1.3 and $0.10 a kWh, colocation at $210 a kW-month, support at 5% of the price a year
  const running = (s) => s.kw * 1.3 * 0.1 * HOURS + s.kw * 210 + (s.capex * 0.05) / 12;
  const round100 = (v) => Math.round(v / 100) * 100;

  function scenario(t, bill, rate) {
    const T = TIER[t];
    const S = SERVER[T.server];
    const tokens = (bill / perMillion(T.claude, T.unit)) * 1e6;
    const out = (tokens * UNIT[T.unit][2]) / unitTokens(T.unit);
    const peak = T.shape === "office" ? (out * 0.8) / WORK_SEC : (out / MONTH_SEC) * 1.5;
    const n = Math.max(1, Math.ceil((peak * 1.5) / rate)); // the busiest hour at two-thirds of capacity
    // one server's month, rounded to $100 as the Infrastructure page prints it, so the totals match it
    const perServer = round100(running(S) + S.capex / 48);
    const perRun = round100(running(S));
    const owned = n * perServer;
    const run = n * perRun;
    return {
      tokens, n, run, owned,
      hw: owned - run,
      hosted: (tokens / 1e6) * perMillion(T.open, T.unit),
      payback: bill > run ? (n * S.capex) / (bill - run) : Infinity, // months for the price to be earned back
      oneServer: perServer,
    };
  }

  // the dial runs from $5,000 to $1,000,000 a month on a log scale; bills round to a tidy figure
  const LO = Math.log(5_000);
  const HI = Math.log(1_000_000);
  const tidy = (b) => {
    const step = Math.pow(10, Math.floor(Math.log10(b)) - 1) / 2;
    return Math.round(b / step) * step;
  };
  const toBill = (v) => tidy(Math.exp(LO + ((HI - LO) * v) / 1000));
  const toPos = (b) => Math.round(((Math.log(b) - LO) / (HI - LO)) * 1000);
  const money = new Intl.NumberFormat("en-US");
  const usd = (v) => `$${money.format(v >= 1000 ? Math.round(v / 100) * 100 : Math.round(v / 10) * 10)}`;
  const change = (x, bill) => {
    const s = Math.round((1 - x / bill) * 100);
    return s > 0 ? `${s}% less` : s < 0 ? `${-s}% more` : "the same";
  };
  const WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const count = (n) => WORDS[n] || String(n);
  const about = (n) => (n >= 100 ? Math.round(n / 10) * 10 : n >= 20 ? Math.round(n / 5) * 5 : Math.max(1, Math.round(n)));
  const billions = (t) => {
    const b = t / 1e9;
    return b >= 10 ? money.format(Math.round(b)) : b.toFixed(1);
  };

  const range = $("[data-bill]", calc);
  // each workflow keeps its own dial position, so switching back finds the bill where it was left
  const pos = Object.fromEntries(Object.entries(TIER).map(([k, T]) => [k, toPos(T.bill)]));
  let tier = "coding";
  let speed = 1120;

  const set = (sel, text) => {
    const el = $(sel, calc);
    if (el) el.textContent = text;
  };
  const bar = (key, w, x = 0) => {
    const el = $(`[data-bar="${key}"]`, calc);
    el.style.setProperty("--w", w.toFixed(4));
    el.style.setProperty("--x", x.toFixed(4));
  };

  function render() {
    const T = TIER[tier];
    const S = SERVER[T.server];
    const bill = toBill(pos[tier]);
    const r = scenario(tier, bill, T.rate || speed);

    set("[data-bill-out]", usd(bill));
    if (range.value !== String(pos[tier])) range.value = String(pos[tier]);
    range.setAttribute("aria-valuetext", `${money.format(bill)} dollars a month`);
    range.style.setProperty("--fill", `${(pos[tier] / 10).toFixed(1)}%`);
    set(
      "[data-basis]",
      tier === "coding"
        ? `On ${T.claudeName}: about ${money.format(about(bill / OPUS_USER))} heavy coding-agent users.`
        : `On ${T.claudeName}: about ${billions(r.tokens)} billion tokens a month.`
    );

    const pick = $("[data-speed-pick]", calc);
    const fixed = $("[data-speed-fixed]", calc);
    pick.hidden = tier !== "coding";
    fixed.hidden = tier === "coding";
    if (T.speed) fixed.textContent = T.speed;

    set('[data-name="claude"]', T.claudeName);
    set('[data-name="hosted"]', T.openName);
    set("[data-count]", `(${r.n} × ${S.name})`);
    set('[data-v="claude"]', usd(bill));
    for (const k of ["hosted", "owned", "after"]) {
      const v = k === "after" ? r.run : r[k];
      set(`[data-v="${k}"]`, usd(v));
      set(`[data-p="${k}"]`, change(v, bill));
    }

    const max = Math.max(bill, r.owned);
    bar("claude", bill / max);
    bar("hosted", r.hosted / max);
    bar("owned-run", r.run / max);
    bar("owned-hw", r.hw / max, r.run / max);
    bar("after", r.run / max);

    const lines = [`Hosted saves ${usd(bill - r.hosted)} a month.`];
    if (r.owned < bill) {
      const one = r.n === 1;
      lines.push(
        `${count(r.n)} ${one ? "server saves" : "servers save"} ${usd(bill - r.owned)} a month during ${one ? "its" : "their"} four-year write-off and ${usd(bill - r.run)} a month after; ${one ? "its" : "their"} price is earned back in ${Math.round(r.payback)} months.`
      );
    } else if (r.n === 1) {
      lines.push(`One server would cost more than this bill; owning pays from about ${usd(r.oneServer)} a month.`);
    } else {
      lines.push("At this size the servers would cost more than the bill, so the hosted route wins.");
    }
    if (tier === "coding") {
      const minutes = Math.ceil((((bill - r.hosted) / (bill / OPUS_USER)) / DEV_MONTH) * 8 * 60);
      lines.push(`The hosted move pays as long as switching costs each developer under ${minutes} minutes a day.`);
    }
    set("[data-read]", lines.join(" "));
    set("[data-fine]", T.fine);
  }

  range.addEventListener("input", () => {
    pos[tier] = Number(range.value);
    render();
  });
  for (const input of $$('input[name="calc-tier"]', calc)) {
    input.addEventListener("change", () => {
      tier = input.value;
      render();
    });
  }
  for (const input of $$('input[name="calc-speed"]', calc)) {
    input.addEventListener("change", () => {
      speed = Number(input.value);
      render();
    });
  }
  render();
}
