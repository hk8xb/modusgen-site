// The tabbed terminal: real tool output, typed out the first time each tab is seen.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function initTerminal(root, { reduce = false } = {}) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panes = tabs.map((t) => root.querySelector(`#${t.getAttribute("aria-controls")}`));
  const what = root.querySelector("[data-term-what]");
  const played = new Set();
  let active = 0;
  let auto = !reduce;
  let inView = false;
  let hold = false;
  let timer = 0;

  function select(i, { focus = false, user = false } = {}) {
    active = i;
    tabs.forEach((tab, k) => {
      const on = k === i;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      panes[k].hidden = !on;
    });
    if (what) what.textContent = panes[i].dataset.what || "";
    if (focus) tabs[i].focus();
    if (user) {
      auto = false;
      clearTimeout(timer);
    }
    play(i);
  }

  async function play(i) {
    if (reduce || !inView || played.has(i)) return;
    played.add(i);
    await typeOut(panes[i]);
    if (played.size === tabs.length) auto = false;
    queue();
  }

  function queue() {
    clearTimeout(timer);
    if (!auto) return;
    timer = setTimeout(() => {
      if (!auto || !inView) return;
      if (hold) return queue();
      select((active + 1) % tabs.length);
    }, 4200);
  }

  async function typeOut(pane) {
    const cmd = pane.querySelector(".t-cmd");
    const body = pane.querySelector(".t-body");
    if (!cmd || !body) return;

    const prompt = cmd.querySelector(".t-ps");
    const text = cmd.textContent.slice(prompt ? prompt.textContent.length : 0);
    body.innerHTML = body.innerHTML
      .split("\n")
      .map((line) => `<span class="ln is-hid">${line}</span>`)
      .join("\n");
    const lines = [...body.querySelectorAll(".ln")];

    const typed = document.createTextNode("");
    const caret = document.createElement("span");
    caret.className = "caret";
    caret.setAttribute("aria-hidden", "true");
    cmd.textContent = "";
    if (prompt) cmd.append(prompt);
    cmd.append(typed, caret);

    await wait(260);
    for (let n = 0; n < text.length; n += 2) {
      typed.data = text.slice(0, n + 2);
      await wait(15);
    }
    typed.data = text;
    await wait(340);
    caret.remove();
    for (const line of lines) {
      line.classList.remove("is-hid");
      await wait(line.textContent.trim() ? 42 : 12);
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(i, { user: true }));
    tab.addEventListener("keydown", (ev) => {
      const last = tabs.length - 1;
      let next = null;
      if (ev.key === "ArrowRight") next = i === last ? 0 : i + 1;
      else if (ev.key === "ArrowLeft") next = i === 0 ? last : i - 1;
      else if (ev.key === "Home") next = 0;
      else if (ev.key === "End") next = last;
      if (next == null) return;
      ev.preventDefault();
      select(next, { focus: true, user: true });
    });
  });

  root.addEventListener("pointerenter", () => (hold = true));
  root.addEventListener("pointerleave", () => (hold = false));
  root.addEventListener("focusin", () => (hold = true));
  root.addEventListener("focusout", () => (hold = false));

  new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      if (inView) play(active);
      else clearTimeout(timer);
    },
    { threshold: 0.35 }
  ).observe(root);
}
