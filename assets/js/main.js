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
    if (mode === "hero" || mode === "story") stacks[mode] = stack;
  }
}
ensureStacks();
window.matchMedia("(max-width: 1000px)").addEventListener("change", () => {
  ensureStacks();
  onScroll();
});

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

// ---------------------------------------------------------------- economics: the dial and the task chart

const econ = $("[data-econ]");
if (econ) {
  // one coding task at list prices, in dollars, tier against tier; the dial scales the open models
  const MAX = 8.5;
  const TASK = { opus: 5.64, kimi: 3.54, sonnet: 2.82, haiku: 0.885, deepseek: 0.343 };
  const OPEN = new Set(["kimi", "deepseek"]);
  const range = $("[data-factor]", econ);
  const out = $("[data-factor-out]", econ);
  const read = $("[data-chart-read]", econ);
  const usd = (v) => `$${v.toFixed(2)}`;
  const share = (a, b) => Math.round((a / b) * 100);

  const setFactor = (f) => {
    const times = `${f.toFixed(1)}×`;
    out.textContent = times;
    range.setAttribute("aria-valuetext", `${f.toFixed(1)} times the tokens`);
    range.style.setProperty("--fill", `${((f - 1) / 2) * 100}%`);
    for (const key of Object.keys(TASK)) {
      const v = TASK[key] * (OPEN.has(key) ? f : 1);
      $(`[data-bar="${key}"]`, econ).style.setProperty("--to", (Math.min(v, MAX) / MAX).toFixed(4));
      $(`[data-val="${key}"]`, econ).textContent = usd(v);
    }
    const top = share(TASK.kimi * f, TASK.opus);
    const small = share(TASK.deepseek * f, TASK.haiku);
    const lead = f === 1 ? "Token for token" : `At ${times} the tokens`;
    let line = `${lead}, the open model of the same tier costs ${top}% of Opus 5.5's price per task, and ${small}% of Haiku 5.5's.`;
    if (top >= 100 && small >= 100) line += " At this many tokens neither move pays.";
    else if (top >= 100) line += " At this many tokens the top-tier move does not pay.";
    read.textContent = line;
  };

  range.addEventListener("input", () => setFactor(Number(range.value)));
  setFactor(Number(range.value));
}
