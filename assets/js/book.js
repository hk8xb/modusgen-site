import { BOOKING_URL, CONTACT_EMAIL } from "./config.js";

const calendar = document.querySelector("[data-calendar]");
const form = document.querySelector("[data-request]");

for (const a of document.querySelectorAll("[data-mail]")) {
  a.href = `mailto:${CONTACT_EMAIL}`;
  a.textContent = CONTACT_EMAIL;
}

if (BOOKING_URL && calendar) {
  // A scheduling link is set: offer it, and drop the email request.
  calendar.hidden = false;
  calendar.querySelector("[data-calendar-link]").href = BOOKING_URL;
  if (form) form.hidden = true;
} else if (form) {
  const status = form.querySelector(".form__status");
  const checks = [
    { id: "f-name", error: "e-name", test: (v) => v.length > 0, message: "Add your name." },
    { id: "f-email", error: "e-email", test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: "Add a work email, such as you@company.com." },
    { id: "f-company", error: "e-company", test: (v) => v.length > 0, message: "Add your company." },
  ];

  const check = (c) => {
    const input = document.getElementById(c.id);
    const ok = c.test(input.value.trim());
    input.setAttribute("aria-invalid", String(!ok));
    document.getElementById(c.error).textContent = ok ? "" : c.message;
    return ok;
  };

  for (const c of checks) {
    const input = document.getElementById(c.id);
    input.addEventListener("blur", () => input.value && check(c));
    input.addEventListener("input", () => input.getAttribute("aria-invalid") === "true" && check(c));
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const bad = checks.filter((c) => !check(c));
    if (bad.length) {
      document.getElementById(bad[0].id).focus();
      status.textContent = "";
      return;
    }
    const get = (id) => document.getElementById(id).value.trim();
    const lines = [
      "Hello ModusGen,",
      "",
      "I would like to book a thirty-minute call.",
      "",
      `Name: ${get("f-name")}`,
      `Email: ${get("f-email")}`,
      `Company: ${get("f-company")}`,
      `Developers using coding agents: ${get("f-devs") || "not given"}`,
      `Monthly inference spend: ${get("f-spend")}`,
    ];
    if (get("f-notes")) lines.push("", get("f-notes"));
    lines.push("", "Times that suit me:", "");
    const subject = `Call request from ${get("f-company")}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    status.textContent = `Your mail app should now be open with the request written out. If nothing opened, write to ${CONTACT_EMAIL}.`;
  });
}
