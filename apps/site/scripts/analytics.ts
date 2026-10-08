/**
 * polyxd.com's analytics script, built into the pages only when the build has a PostHog key:
 *
 *   POSTHOG_KEY=phc_… npm run build -w @polyxd/site    (or put POSTHOG_KEY=phc_… in apps/site/.env)
 *
 * (POSTHOG_HOST picks the region's app for PostHog's own links; default the US cloud.) Without
 * the key the build writes no script, no vendor file and no tag: the pages are byte for byte what
 * they were. The Worker's /ingest/* proxy (worker/analytics.ts) must have POSTHOG_KEY too.
 *
 * On the page:
 * - A visitor whose browser sends Do Not Track or Global Privacy Control gets nothing: the
 *   script isn't even fetched, and `pxdTrack` doesn't exist.
 * - posthog-js, pinned (the version in package-lock.json) and served from polyxd.com, keeps
 *   everything in memory: no cookies, no local storage, a new anonymous id on every page load. No
 *   autocapture, no session replay, no surveys, no feature flags, no other script loaded.
 * - Page views, and page leaves, with URLs cut to origin and path: no query string, no fragment,
 *   and no ad-click ids. PostHog works out the country from the IP address and is set to drop
 *   the address (docs/analytics.md).
 * - Named events only: cta_clicked, install_command_copied, and what the gallery, the docs' "Copy
 *   page" button and the demos send through `pxdTrack` (gallery_pack_changed, doc_page_copied,
 *   demo_ask).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

/** posthog-js's slim ES module: the core with no extensions, and nothing it loads from elsewhere. */
export const POSTHOG_JS = "node_modules/posthog-js/dist/module.slim.no-external.js";
export const POSTHOG_JS_VERSION: string = JSON.parse(readFileSync(`${REPO}node_modules/posthog-js/package.json`, "utf8")).version;
export const VENDOR_PATH = `/assets/vendor/posthog-${POSTHOG_JS_VERSION}.js`;
export const SCRIPT_PATH = "/assets/analytics.js";

/**
 * The key from the build's environment (or apps/site/.env, which `npm run build` and `deploy`
 * read), or null. A value that isn't a project key fails the build. `POSTHOG_KEY=off` builds
 * without analytics on purpose; a deploy build (`deploy`) with no key at all stops, because pages
 * shipped without the tag silently zero every site chart in PostHog.
 */
export function analyticsKey(env: NodeJS.ProcessEnv = process.env, deploy = false): string | null {
  const key = env.POSTHOG_KEY?.trim();
  if (key === "off") return null;
  if (!key) {
    if (deploy) throw new Error("No POSTHOG_KEY for a deploy: the pages would ship with no analytics. Put POSTHOG_KEY=phc_… in apps/site/.env, or set POSTHOG_KEY=off to deploy without analytics on purpose.");
    return null;
  }
  if (!/^phc_[A-Za-z0-9_-]{8,}$/.test(key)) throw new Error("POSTHOG_KEY should be a PostHog project key (phc_…), the public one.");
  return key;
}

/** PostHog's app for the region the ingest host is in: us.i.posthog.com → us.posthog.com. */
export function uiHost(env: NodeJS.ProcessEnv = process.env): string {
  const host = (env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com").replace(/\/+$/, "");
  return /^https:\/\/eu\.i\.posthog\.com$/.test(host) ? "https://eu.posthog.com" : "https://us.posthog.com";
}

/**
 * What goes before </head> on every page: a stub that respects DNT and GPC, queues events until the
 * script is ready, and only then asks for the script.
 */
export const HEAD_TAG = `<script>(function(){try{var n=navigator,w=window;if(n.doNotTrack==="1"||w.doNotTrack==="1"||n.msDoNotTrack==="1"||n.globalPrivacyControl===true)return;var q=w.__pxdq=[];w.pxdTrack=function(e,p){q.push([e,p])};var s=document.createElement("script");s.type="module";s.src="${SCRIPT_PATH}";document.head.appendChild(s)}catch(e){}})();</script>`;

/** The module at /assets/analytics.js. */
export function analyticsScript(key: string, ui: string): string {
  return `// polyxd.com analytics: apps/site/scripts/analytics.ts says what this sends and why.
import posthog from "${VENDOR_PATH}";

const w = window;
// Ad-click ids identify a click on an ad, so they never leave the page.
const CLICK_IDS = new Set(["gclid", "gclsrc", "dclid", "gbraid", "wbraid", "fbclid", "msclkid", "twclid", "li_fat_id", "igshid", "ttclid", "rdt_cid", "epik", "qclid", "sccid", "irclid", "_kx", "mc_cid", "gad_source"]);
const clean = (u) => {
  if (typeof u !== "string" || !/^https?:/i.test(u)) return u;
  try {
    const x = new URL(u);
    return x.origin + x.pathname;
  } catch {
    return u.split(/[?#]/)[0];
  }
};
const scrub = (o) => {
  if (!o || typeof o !== "object") return;
  for (const k of Object.keys(o)) {
    if (CLICK_IDS.has(k.replace(/^\\$(initial|session_entry)_/, ""))) delete o[k];
    else if (/(url|referrer)$/i.test(k)) o[k] = clean(o[k]);
  }
};

if (w.pxdTrack) {
  posthog.init(${JSON.stringify(key)}, {
    api_host: "/ingest",
    ui_host: ${JSON.stringify(ui)},
    // Cookieless: nothing is stored in the browser; PostHog counts unique visitors with a daily
    // server-side hash that it discards (the project has cookieless server hash mode on).
    cookieless_mode: "always",
    // Plain JSON, so the /ingest proxy can add the visitor's country (worker/analytics.ts withCountry).
    disable_compression: true,
    persistence: "memory",
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: "history_change",
    capture_pageleave: true,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    rageclick: false,
    mask_personal_data_properties: true,
    before_send: (event) => {
      if (!event) return event;
      scrub(event.properties);
      scrub(event.$set);
      scrub(event.$set_once);
      return event;
    },
  });

  const track = (name, props = {}, beacon = false) => posthog.capture(name, { ...props, page: location.pathname }, beacon ? { transport: "sendBeacon", send_instantly: true } : undefined);
  const queued = w.__pxdq || [];
  w.pxdTrack = (name, props) => track(name, props);
  for (const [name, props] of queued.splice(0)) track(name, props);

  // The site's own calls to action: which one, and where it goes. Its words are the site's, never a visitor's.
  const CTAS = "[data-cta], .site-header a.btn, .site-footer .footer-actions a, main a.btn, a.hero-link, .paths a, .cta-row a, .hs-actions a";
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target instanceof Element ? e.target.closest(CTAS) : null;
      if (!a) return;
      const label = (a.getAttribute("data-cta") || a.querySelector("b")?.textContent || a.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 60);
      track("cta_clicked", { cta: label, target: a instanceof HTMLAnchorElement ? clean(a.href) : "" }, true);
    },
    { capture: true },
  );

  // An install command copied from the docs or the site: which package, nothing else.
  const INSTALL = /\\b(?:npm\\s+(?:i|install|add)|npx|pnpm\\s+(?:add|dlx)|yarn\\s+(?:add|dlx)|bunx|bun\\s+add|pip\\s+install|uvx|uv\\s+add)(?:\\s+-{1,2}[\\w-]+)*\\s+(@polyxd\\/[a-z0-9-]+|polyxd[a-z0-9-]*)\\b/i;
  // Either a selection copied by hand, or a code block's Copy button (assets/copy.js), which writes
  // to the clipboard directly and announces it as pxd:copied.
  const installed = (text, via) => {
    const m = INSTALL.exec(String(text ?? "").slice(0, 2000));
    if (m) track("install_command_copied", { package: m[1].toLowerCase(), via });
  };
  document.addEventListener("copy", () => installed(document.getSelection(), "selection"));
  document.addEventListener("pxd:copied", (e) => installed(e.detail, "button"));
}
`;
}

/** The page with the tag before its </head>. */
export function withTag(html: string): string {
  return html.includes(HEAD_TAG) ? html : html.replace(/<\/head>/i, `${HEAD_TAG}\n</head>`);
}
