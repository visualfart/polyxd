// Landing page: design-system tabs in the demo (narrow screens) and the waitlist form.
(() => {
  const tabs = [...document.querySelectorAll('.demo-tabs [role="tab"]')];
  const narrow = window.matchMedia("(max-width: 1000px)");
  const select = (tab, focus) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = narrow.matches && !on;
    }
    if (focus) tab.focus();
  };
  const sync = () => select(tabs.find((t) => t.getAttribute("aria-selected") === "true") ?? tabs[0], false);
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab, false));
    tab.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) select(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });
  if (tabs.length) {
    narrow.addEventListener("change", sync);
    sync();
  }

  const form = document.querySelector("[data-waitlist]");
  if (!form) return;
  const status = form.querySelector(".waitlist-status");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Adding you…";
    try {
      const res = await fetch(form.action, { method: "POST", body: new FormData(form) });
      const body = await res.json().catch(() => ({}));
      status.textContent = res.ok ? "You're on the list. We'll be in touch." : body.error ?? "Something went wrong. Please try again.";
      if (res.ok) form.reset();
    } catch {
      status.textContent = "Couldn't reach the server. Please try again.";
    } finally {
      button.disabled = false;
    }
  });
})();
