import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import type { ActionEvent } from "@polyxd/react";
import type { Undo } from "../kit/store.ts";
import { matchAsk, suggestions } from "../kit/ask.ts";
import { JitPending, JitSurface } from "../kit/jit.tsx";
import { guardLiveActions, pendingStatus, useLive, type LiveScreen } from "../kit/live-ui.tsx";
import type { IntentFile } from "../kit/types.ts";
import { ASKABLE, REPORTS, intentById, intentBySlug, resolveSlots, slug, surfaceData } from "./intents.ts";
import { runAction, type Outcome } from "./actions.ts";
import { Ctx, store, useWexley, type Session } from "./session.ts";
import { LIVE } from "./live.ts";
import { Banner, BackLink, Breadcrumbs, Button, Footer, Header, Heading, LinkButton, PhaseBanner, TextField } from "./ui.tsx";
import { AuthoredScreen } from "./authored.tsx";
import { SignIn } from "./screens/signin.tsx";
import { Account } from "./screens/account.tsx";
import { Permits, PayFine } from "./screens/permits.tsx";
import { Repairs, Repair, ReportRepair } from "./screens/repairs.tsx";
import { RequestBin } from "./screens/request-bin.tsx";
import { Messages, Message } from "./screens/messages.tsx";
import { Settings } from "./screens/settings.tsx";

export { store } from "./session.ts";

const PACKS = [
  ["govuk", "GOV.UK"],
  ["material3", "Material 3"],
  ["shadcn", "shadcn/ui"],
  ["carbon", "Carbon"],
  ["polaris", "Polaris"],
  ["antd", "Ant Design"],
  ["fluent", "Fluent 2"],
  ["primer", "Primer"],
  ["spectrum", "Spectrum 2"],
  ["chakra", "Chakra"],
  ["mantine", "Mantine"],
  ["radix", "Radix Themes"],
  ["bootstrap", "Bootstrap"],
  // Templates: original Polyxd looks to start from, after the real systems. The drawer's select is flat, so the label carries the group.
  ["sketch", "Templates · Sketch"],
  ["wireframe", "Templates · Wireframe"],
  ["editorial", "Templates · Editorial"],
  ["brutalist", "Templates · Brutalist"],
  ["glass", "Templates · Glass"],
  ["terminal", "Templates · Terminal"],
  ["pastel", "Templates · Pastel"],
  ["civic", "Templates · Civic"],
  ["finance", "Templates · Finance"],
  ["health", "Templates · Health"],
  ["neon", "Templates · Neon"],
  ["mono", "Templates · Mono"],
].map(([id, name]) => ({ id, name }));
const themeFiles = import.meta.glob("../../../packages/react/themes/*.css");
const loadPack = async (id: string) => {
  const load = themeFiles[`../../../packages/react/themes/${id}.css`];
  if (load) await load();
};

/** A generated surface, opened as a page. Kept by key so Back returns to the same one. */
interface Opened {
  intent: IntentFile;
  slots: Record<string, unknown>;
  data: Record<string, unknown>;
  /** The product screen to return to when the surface closes. */
  from: string;
  /** Opened from another surface (a review, a confirmation): dismissing goes back a page, not home. */
  chained: boolean;
  /** A page written just now: the capabilities it was offered. Library pages have none. */
  live?: string[];
}
interface Notice {
  text: string;
  title?: string;
  undo?: Undo;
  /** The page it was first shown on; it goes when the person moves on from there. */
  shownAt: string | null;
}

export function App() {
  const w = store.useState();
  const navigate = useNavigate();
  const location = useLocation();
  const here = useRef(location);
  here.current = location;
  const surfaces = useRef(new Map<string, Opened>());
  const [notice, setNotice] = useState<Notice | null>(null);

  // GOV.UK moves focus to the page heading when the page changes, so screen readers hear where they are.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    const h1 = document.querySelector<HTMLElement>("main h1");
    if (h1) {
      if (!h1.hasAttribute("tabindex")) h1.setAttribute("tabindex", "-1");
      h1.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);
  // A notice stays on the page it appeared on and goes when the person leaves it.
  useEffect(() => {
    setNotice((n) => (!n ? n : n.shownAt === null ? { ...n, shownAt: location.pathname } : n.shownAt === location.pathname ? n : null));
  }, [location.pathname]);

  const say = useCallback((text: string, undo?: Undo, title?: string) => setNotice({ text, undo, title, shownAt: null }), []);
  const current = (): Opened | undefined => surfaces.current.get((here.current.state as { key?: string } | null)?.key ?? "");
  const open = useCallback(
    (intentId: string, slots: Record<string, unknown> = {}, replace = false) => {
      const intent = intentById(intentId);
      if (!intent) return say(`This account cannot do "${intentId}" yet.`, undefined, "Important");
      const key = Math.random().toString(36).slice(2, 10);
      const prev = current();
      const onSurface = here.current.pathname.startsWith("/ask/");
      const from = onSurface ? (prev?.from ?? "/") : here.current.pathname;
      const chained = onSurface && (replace ? (prev?.chained ?? false) : true);
      surfaces.current.set(key, { intent, slots, data: surfaceData(store.get(), intent, slots), from, chained });
      navigate(`/ask/${slug(intentId)}`, { state: { key }, replace });
    },
    [navigate, say],
  );
  const ask = useCallback((text = "") => navigate("/ask", { state: { text } }), [navigate]);

  const onAction = (opened: Opened, e: ActionEvent) => {
    const out: Outcome = runAction(store, e);
    if (out.say) say(out.say, out.undo, out.title);
    if (out.next) open(out.next.intent, { ...opened.slots, ...out.next.slots }, out.next.replace);
    else if (out.close) navigate(out.go ?? opened.from);
    else if (out.go) navigate(out.go);
    else if (out.undo) open(opened.intent.id, opened.slots, true);
  };
  // An authored screen's actions: the same handlers, but the screen stays where it is; the store
  // changing is what refreshes it, so "close" means nothing here and Undo needs no reopening.
  const onScreenAction = (e: ActionEvent) => {
    const out: Outcome = runAction(store, e);
    if (out.say) say(out.say, out.undo, out.title);
    if (out.next) open(out.next.intent, out.next.slots, out.next.replace);
    else if (out.go) navigate(out.go);
  };
  const undo = () => {
    if (!notice?.undo) return;
    store.undo(notice.undo);
    setNotice({ text: "Undone. Everything is as it was.", shownAt: location.pathname });
    const opened = current();
    if (opened) open(opened.intent.id, opened.slots, true);
  };
  const signOut = () => {
    store.commit("Sign out", (d) => {
      d.session.signedIn = false;
    });
    navigate("/signin");
  };

  const session: Session = { w, store, ask, open, say };
  const unread = w.messages.filter((m) => !m.read).length;
  if (!w.session.signedIn && location.pathname !== "/signin") return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return (
    <Ctx.Provider value={session}>
      <a href="#main" className="wx-skip">
        Skip to main content
      </a>
      <Header signedIn={w.session.signedIn} unread={unread} onSignOut={signOut} />
      <div className="wx-width">
        <PhaseBanner />
      </div>
      <main className="wx-width wx-main" id="main">
        {notice && (
          <Banner kind={notice.title === "There is a problem" ? "error" : notice.title && notice.title !== "Success" ? "important" : "success"} title={notice.title} onDismiss={() => setNotice(null)} action={notice.undo && <LinkButton onClick={undo}>Undo</LinkButton>}>
            {notice.text}
          </Banner>
        )}
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route index element={<Account />} />
          <Route path="permits" element={<Permits />} />
          <Route path="permits/fine/pay" element={<PayFine />} />
          <Route path="council-tax" element={<AuthoredScreen id="screen.council_tax" crumb="Council tax" onAction={onScreenAction} packs={PACKS} loadPack={loadPack} />} />
          <Route path="repairs" element={<Repairs />} />
          <Route path="repairs/new" element={<ReportRepair />} />
          <Route path="repairs/:id" element={<Repair />} />
          <Route path="bins" element={<AuthoredScreen id="screen.bins" crumb="Bins" onAction={onScreenAction} packs={PACKS} loadPack={loadPack} />} />
          <Route path="bins/request" element={<RequestBin />} />
          <Route path="benefits" element={<AuthoredScreen id="screen.benefits" crumb="Benefits" onAction={onScreenAction} packs={PACKS} loadPack={loadPack} />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:id" element={<Message />} />
          <Route path="settings" element={<Settings />} />
          <Route path="ask" element={<Ask />} />
          <Route path="ask/:id" element={<SurfacePage lookup={(key) => surfaces.current.get(key)} onAction={onAction} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </Ctx.Provider>
  );
}

/* ---- The ask page: free text in, a page out ---- */

function Ask() {
  const location = useLocation();
  const navigate = useNavigate();
  const initial = (location.state as { text?: string } | null)?.text ?? "";
  const [text, setText] = useState(initial);
  const [miss, setMiss] = useState<string | null>(null);
  const tried = useRef<string | null>(null);
  const tries = useMemo(() => suggestions(ASKABLE, 4), []);
  const live = useLive(LIVE);
  const { route } = live;
  const go = useCallback(
    (t: string) =>
      route(t, (x) => matchAsk(x, ASKABLE), {
        // Straight to the page: the ask box is a way in, not a place to stay.
        library: (m) => navigate(`/ask/${slug(m.intent.id)}`, { replace: true, state: { key: stash(m.intent, resolveSlots(store.get(), m.slots), "/") } }),
        // Nothing in the library: a page written now when the site has a model, checked before it is shown.
        live: ({ intent, capabilities }: LiveScreen) => navigate(`/ask/${slug(intent.id)}`, { state: { key: stash(intent, {}, "/ask", capabilities) } }),
        miss: () => setMiss(t),
      }),
    [navigate, route],
  );
  useEffect(() => {
    if (initial && tried.current !== initial) {
      tried.current = initial;
      go(initial);
    }
  }, [initial, go]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) go(text.trim());
  };
  if (live.pending)
    return (
      <>
        <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Ask for something" }]} />
        <Heading>We are writing this page for you</Heading>
        <p className="wx-body">“{live.pending.ask}” has no page yet. We check the new one against the rules for council pages before you see it.</p>
        <div className="wx-surface">
          <JitPending theme="govuk" mode="light" status={pendingStatus(live.pending)} />
        </div>
        <p className="wx-body">
          <LinkButton onClick={live.cancel}>Cancel and ask something else</LinkButton>
        </p>
      </>
    );
  return (
    <>
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Ask for something" }]} />
      <div className="wx-grid">
        <div>
          <Heading>What do you need to do?</Heading>
          <p className="wx-body">Say it in your own words. If the council can do it, we write the page for it and check it before you see it.</p>
          {miss && (
            <div className="wx-inset" role="status">
              <p className="wx-body">
                <strong>We cannot help with that yet.</strong> “{miss}” is not something this account can act on. Try one of the examples below, or ask in different words.
              </p>
            </div>
          )}
          <form onSubmit={submit} role="search">
            <TextField id="ask" label="What do you need?" hint='For example, "my bin wasn’t collected"' value={text} onChange={(v) => (setText(v), setMiss(null))} autoComplete="off" />
            <Button type="submit">Continue</Button>
          </form>
          <h2 className="wx-h2">Things you can ask for</h2>
          <ul className="wx-list wx-ask-page-list">
            {ASKABLE.map((i) => (
              <li key={i.id}>
                <LinkButton onClick={() => go(i.ask[0])}>{i.ask[0]}</LinkButton>
              </li>
            ))}
          </ul>
          <p className="wx-small wx-muted">Try: {tries.join(" · ")}</p>
        </div>
      </div>
    </>
  );
}

/** Surfaces opened from the ask page share the App's map through a module-level stash. */
const stashed = new Map<string, Opened>();
function stash(intent: IntentFile, slots: Record<string, unknown>, from: string, live?: string[]): string {
  const key = Math.random().toString(36).slice(2, 10);
  stashed.set(key, { intent, slots, data: surfaceData(store.get(), intent, slots), from, chained: false, live });
  return key;
}

/* ---- A generated surface as a page of the service ---- */

function SurfacePage({ lookup, onAction }: { lookup: (key: string) => Opened | undefined; onAction: (opened: Opened, e: ActionEvent) => void }) {
  const { id = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { say } = useWexley();
  const key = (location.state as { key?: string } | null)?.key ?? "";
  const opened = useMemo<Opened | undefined>(() => {
    const found = lookup(key) ?? stashed.get(key);
    if (found) return found;
    // Opened by its address (a refresh, a shared link): the surface with today's data and no slots.
    const intent = intentBySlug(id);
    return intent ? { intent, slots: {}, data: surfaceData(store.get(), intent, {}), from: "/", chained: false } : undefined;
  }, [key, id, lookup]);
  // Cancel on a review or a confirmation goes back to the form it came from; on the first page, to the screen.
  const leave = useCallback(() => (opened?.chained && window.history.length > 1 ? navigate(-1) : navigate(opened?.from ?? "/")), [navigate, opened]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      // A Confirm handles Escape itself, and an open picker closes on its own; otherwise Escape is Back.
      if (t.closest("[role='alertdialog'], [role='dialog'], [role='listbox']")) return;
      leave();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [leave]);
  useEffect(() => {
    const h1 = document.querySelector<HTMLElement>(".wx-surface h1");
    if (h1) {
      h1.setAttribute("tabindex", "-1");
      h1.focus({ preventScroll: true });
    }
  }, [key, id]);
  if (!opened) return <Navigate to="/" replace />;
  return (
    <>
      <BackLink onClick={() => (window.history.length > 1 ? navigate(-1) : leave())} />
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: opened.intent.title }]} />
      <div className="wx-surface">
        <JitSurface
          key={key || id}
          intent={opened.intent}
          report={opened.live ? undefined : REPORTS[opened.intent.id]}
          data={opened.data}
          theme="govuk"
          mode="light"
          density="comfortable"
          disclosure="progressive"
          onAction={opened.live ? guardLiveActions(opened.live, (e) => onAction(opened, e), () => say("This page cannot do that.", undefined, "Important")) : (e) => onAction(opened, e)}
          onDismiss={leave}
          origin={opened.live ? "live" : "library"}
          packs={PACKS}
          loadPack={loadPack}
        />
        <p className="wx-small wx-muted wx-surface-note">
          The council wrote this page for what you asked. <Link to="/ask">Ask for something else</Link>.
        </p>
      </div>
    </>
  );
}
