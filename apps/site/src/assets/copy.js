// A Copy button on every code block: the docs' and the site's terminal blocks. A terminal block
// copies only its commands, without the "$" prompt or the output (or its first line, without
// prompts). Each copy is announced as a `pxd:copied` event, which the analytics script
// (scripts/analytics.ts) reads for install commands, because a clipboard write raises no `copy`
// event of its own.
//
// And each docs page's "Copy page": the page as Markdown (/docs/<page>.md, scripts/llms.ts), to
// paste into an agent as context. Fetched ahead of time, so the click copies at once.
(() => {
  const textOf = (pre) => {
    const text = (pre.querySelector("code") ?? pre).innerText.replace(/\n+$/, "");
    if (!pre.classList.contains("term")) return text;
    const commands = text.split("\n").filter((l) => /^\$\s/.test(l)).map((l) => l.replace(/^\$\s+/, ""));
    // No prompts: the first line is the command and the rest its output.
    return commands.length ? commands.join("\n") : text.split("\n")[0];
  };
  for (const pre of document.querySelectorAll(".prose pre, pre.term")) {
    const wrap = document.createElement("div");
    wrap.className = "copy-wrap";
    pre.replaceWith(wrap);
    wrap.append(pre);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-btn";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code");
    let timer;
    const show = (label) => {
      button.textContent = label;
      clearTimeout(timer);
      timer = setTimeout(() => (button.textContent = "Copy"), 1800);
    };
    button.addEventListener("click", async () => {
      const text = textOf(pre);
      try {
        await navigator.clipboard.writeText(text);
        show("Copied");
        document.dispatchEvent(new CustomEvent("pxd:copied", { detail: text }));
      } catch {
        // No clipboard access (an old browser, or an insecure context): select it for ⌘C / Ctrl+C.
        const range = document.createRange();
        range.selectNodeContents(pre.querySelector("code") ?? pre);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        show("Selected");
      }
    });
    wrap.append(button);
  }

  const page = document.querySelector(".copy-page");
  if (page) {
    const url = page.getAttribute("data-md");
    let markdown = null;
    const load = () => (markdown ??= fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))));
    // Once the page is idle, so it never competes with what the reader came for.
    (window.requestIdleCallback ?? ((f) => setTimeout(f, 1500)))(() => load().catch(() => (markdown = null)));
    let timer;
    const show = (label) => {
      page.textContent = label;
      clearTimeout(timer);
      timer = setTimeout(() => (page.textContent = "Copy page"), 1800);
    };
    page.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(await load());
        show("Copied");
        window.pxdTrack?.("doc_page_copied", { page: location.pathname });
      } catch {
        markdown = null;
        // Clipboard blocked or the fetch failed: the Markdown is one click away instead.
        location.href = url;
      }
    });
  }
})();
