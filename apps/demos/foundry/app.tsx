import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { ActionEvent, Data } from "@polyxd/react";
import type { Undo } from "../kit/store.ts";
import { matchAsk, suggestions } from "../kit/ask.ts";
import { JitSurface } from "../kit/jit.tsx";
import type { IntentFile } from "../kit/types.ts";
import { ASKABLE, REPORTS, intentById, live, resolveSlots, surfaceData } from "./intents.ts";
import { Ctx, store, useFoundry, type Session } from "./session.ts";
import { runAction, type Outcome } from "./actions.ts";
import { daysUntil, isOpen, me } from "./seed.ts";
import { Avatar, Button, Icon, Kbd, NAV, NavList, useModal } from "./ui.tsx";
import { SignIn } from "./screens/signin.tsx";
import { Overview } from "./screens/overview.tsx";
import { Accounts, Account } from "./screens/accounts.tsx";
import { Tickets, Ticket } from "./screens/tickets.tsx";
import { Renewals } from "./screens/renewals.tsx";
import { Team } from "./screens/team.tsx";
import { Settings } from "./screens/settings.tsx";

export { store, useFoundry } from "./session.ts";

const PACKS = [
  ["shadcn", "shadcn/ui"],
  ["material3", "Material 3"],
  ["carbon", "Carbon"],
  ["polaris", "Polaris"],
  ["antd", "Ant Design"],
  ["govuk", "GOV.UK"],
  ["fluent", "Fluent 2"],
  ["primer", "Primer"],
  ["spectrum", "Spectrum 2"],
  ["chakra", "Chakra"],
  ["mantine", "Mantine"],
  ["radix", "Radix Themes"],
  ["bootstrap", "Bootstrap"],
].map(([id, name]) => ({ id, name }));
const themeFiles = import.meta.glob("../../../packages/react/themes/*.css");
const loadPack = async (id: string) => {
  const load = themeFiles[`../../../packages/react/themes/${id}.css`];
  if (load) await load();
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? "⌘" : "Ctrl";

export function App() {
  const h = store.useState();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useMode(h.settings.appearance);
  const [palette, setPalette] = useState<{ text: string } | null>(null);
  const [surface, setSurface] = useState<{ intent: IntentFile; slots: Record<string, unknown>; data: Record<string, unknown> } | null>(null);
  const [snack, setSnack] = useState<{ text: string; undo?: Undo } | null>(null);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.pxdMode = mode;
  }, [mode]);
  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(() => setSnack(null), snack.undo ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [snack]);
  // ⌘K anywhere opens the palette; a second press closes it.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => (p ? null : { text: "" }));
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  // While a surface is open, its inputs re-derive what the store says (filters narrow the list, a
  // quote's receipt follows its fields).
  const derive = useCallback((data: Data) => (surface ? { ...data, ...live(store.get(), surface.intent.id, data) } : undefined), [surface]);

  const say = useCallback((text: string, undo?: Undo) => setSnack({ text, undo }), []);
  const open = useCallback(
    (intentId: string, slots: Record<string, unknown> = {}) => {
      const intent = intentById(intentId);
      if (!intent) return say(`Foundry hasn't learned "${intentId}" yet.`);
      setPalette(null);
      setDrawer(false);
      setSurface({ intent, slots, data: surfaceData(store.get(), intent, slots) });
    },
    [say],
  );
  const ask = useCallback((text = "") => setPalette({ text }), []);

  const onAction = (e: ActionEvent) => {
    const out: Outcome = runAction(store, e);
    if (out.say) say(out.say, out.undo);
    if (out.next) open(out.next.intent, { ...surface?.slots, ...out.next.slots });
    else if (out.close) setSurface(null);
    if (out.go) navigate(out.go);
  };
  const undo = () => {
    if (!snack?.undo) return;
    store.undo(snack.undo);
    setSnack({ text: "Undone." });
  };

  const session: Session = { h, store, mode, ask, open, say };
  if (!h.session.signedIn && location.pathname !== "/signin") return <Navigate to="/signin" replace />;
  if (h.session.signedIn && location.pathname === "/signin") return <Navigate to="/" replace />;
  return (
    <Ctx.Provider value={session}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route
          path="*"
          element={
            <div className="fd">
              <Sidebar />
              <TopBar onMenu={() => setDrawer(true)} onAsk={() => ask()} />
              <main className="fd-main" id="main">
                <Routes>
                  <Route index element={<Overview />} />
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="accounts/:id" element={<Account />} />
                  <Route path="accounts/:id/:tab" element={<Account />} />
                  <Route path="tickets" element={<Tickets />} />
                  <Route path="tickets/:id" element={<Ticket />} />
                  <Route path="renewals" element={<Renewals />} />
                  <Route path="team" element={<Team />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              {drawer && <Drawer onClose={() => setDrawer(false)} />}
            </div>
          }
        />
      </Routes>
      {palette && <Palette initial={palette.text} onClose={() => setPalette(null)} onOpen={open} />}
      {surface && (
        <Sheet title={surface.intent.title} onClose={() => setSurface(null)}>
          <JitSurface intent={surface.intent} report={REPORTS[surface.intent.id]} data={surface.data} theme="shadcn" mode={mode} density="compact" onAction={onAction} onDismiss={() => setSurface(null)} derive={derive} locale="en-US" origin="library" packs={PACKS} loadPack={loadPack} />
        </Sheet>
      )}
      {snack && (
        <div className="fd-toast" role="status">
          <p>{snack.text}</p>
          {snack.undo && (
            <Button variant="outline" size="sm" icon="undo" onClick={undo}>
              Undo
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setSnack(null)} aria-label="Dismiss">
            <Icon name="close" />
          </Button>
        </div>
      )}
    </Ctx.Provider>
  );
}

function useMode(pref: "system" | "light" | "dark"): "light" | "dark" {
  const [system, setSystem] = useState<"light" | "dark">(() => (typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return pref === "system" ? system : pref;
}

/* ---- Shell ---- */

function useNavCounts() {
  const { h } = useFoundry();
  return useMemo(
    () => ({
      "/tickets": h.tickets.filter((t) => t.status === "open").length,
      "/renewals": h.renewals.filter((r) => (r.stage === "upcoming" || r.stage === "quoted") && daysUntil(r.dueAt) <= 30 && daysUntil(r.dueAt) >= 0).length,
    }),
    [h],
  );
}

function SideContent({ onNavigate }: { onNavigate?: () => void }) {
  const { h } = useFoundry();
  const counts = useNavCounts();
  const user = me(h);
  return (
    <>
      <Link className="fd-brand" to="/" onClick={onNavigate}>
        <span className="fd-mark" aria-hidden="true">
          f
        </span>
        <span className="fd-brand-text">
          <span className="fd-brand-name">Foundry</span>
          <span className="fd-brand-ws">Basalt · Customer success</span>
        </span>
      </Link>
      <nav aria-label="Foundry">
        <NavList counts={counts} onNavigate={onNavigate} />
      </nav>
      <div className="fd-side-foot">
        <ul className="fd-nav-list">
          <li>
            <Link to="/settings" className={`fd-nav-item${location.pathname.endsWith("/settings") ? " is-active" : ""}`} onClick={onNavigate}>
              <Icon name="settings" size={16} />
              <span>Settings</span>
            </Link>
          </li>
        </ul>
        <Link to="/settings" className="fd-side-user" onClick={onNavigate}>
          <Avatar name={user.name} size={28} />
          <span className="fd-side-user-text">
            <b>{user.name}</b>
            <span>{user.title}</span>
          </span>
        </Link>
      </div>
    </>
  );
}

function Sidebar() {
  return (
    <aside className="fd-side">
      <SideContent />
    </aside>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref, onClose);
  return (
    <dialog ref={ref} className="fd-drawer" aria-label="Navigation" onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="fd-side">
        <SideContent onNavigate={() => ref.current?.close()} />
      </div>
    </dialog>
  );
}

function TopBar({ onMenu, onAsk }: { onMenu: () => void; onAsk: () => void }) {
  const { h } = useFoundry();
  const location = useLocation();
  const crumbs = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const out: { label: string; to?: string }[] = [];
    const first = NAV.find((n) => n.to === `/${parts[0] ?? ""}`) ?? (parts[0] === "settings" ? { label: "Settings", to: "/settings" } : { label: "Overview", to: "/" });
    out.push({ label: first.label, to: first.to });
    if (parts[0] === "accounts" && parts[1]) out.push({ label: h.accounts.find((a) => a.id === parts[1])?.name ?? "Account" });
    if (parts[0] === "tickets" && parts[1]) out.push({ label: `#${h.tickets.find((t) => t.id === parts[1])?.number ?? ""}` });
    return out;
  }, [location.pathname, h]);
  return (
    <header className="fd-top">
      <Button variant="ghost" size="icon" className="fd-menu-btn" onClick={onMenu} aria-label="Open navigation">
        <Icon name="menu" />
      </Button>
      <Link className="fd-brand" to="/" aria-label="Foundry home">
        <span className="fd-mark" aria-hidden="true">
          f
        </span>
      </Link>
      <nav className="fd-crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <Icon name="chevronRight" size={12} />}
            {c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span className="is-current">{c.label}</span>}
          </span>
        ))}
      </nav>
      <button type="button" className="fd-askbox" onClick={onAsk} aria-label="Ask Foundry or jump anywhere">
        <Icon name="spark" size={15} />
        <span>Ask Foundry, or jump to an account…</span>
        <Kbd>{MOD} K</Kbd>
      </button>
    </header>
  );
}

/* ---- Command palette: screens, accounts by name, and the asks. ---- */

interface Item {
  id: string;
  group: string;
  icon: string;
  label: string;
  hint?: string;
  run: () => void;
}

function Palette({ initial, onClose, onOpen }: { initial: string; onClose: () => void; onOpen: (id: string, slots: Record<string, unknown>) => void }) {
  const { h } = useFoundry();
  const navigate = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(initial);
  const [active, setActive] = useState(0);
  const tries = useMemo(() => suggestions(ASKABLE, 4), []);
  useModal(ref, onClose);
  useEffect(() => input.current?.focus(), []);

  const q = text.trim();
  const ql = q.toLowerCase();
  const go = (to: string) => {
    ref.current?.close();
    navigate(to);
  };
  const askIt = (t: string) => {
    const m = matchAsk(t, ASKABLE);
    if (!m) return false;
    onOpen(m.intent.id, resolveSlots(h, m.slots));
    return true;
  };
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const m = q ? matchAsk(q, ASKABLE) : null;
    if (m) out.push({ id: "ask", group: "Ask", icon: "spark", label: q, hint: m.intent.title, run: () => askIt(q) });
    const screens = [...NAV, { to: "/settings", label: "Settings", icon: "settings" }].filter((n) => !ql || n.label.toLowerCase().includes(ql));
    if (!q) for (const t of tries) out.push({ id: `try:${t}`, group: "Try asking", icon: "spark", label: t, run: () => askIt(t) });
    if (ql.length >= 2) {
      const accounts = h.accounts.filter((a) => a.name.toLowerCase().includes(ql) || a.industry.toLowerCase().includes(ql)).slice(0, 6);
      for (const a of accounts) out.push({ id: `acc:${a.id}`, group: "Accounts", icon: "accounts", label: a.name, hint: `${a.industry}${a.status === "canceled" ? " · canceled" : ""}`, run: () => go(`/accounts/${a.id}`) });
      const phrases = ASKABLE.flatMap((i) => i.ask.filter((p) => p.toLowerCase().includes(ql) && p.toLowerCase() !== ql)).slice(0, 4);
      for (const p of phrases) out.push({ id: `ask:${p}`, group: "Asks", icon: "spark", label: p, run: () => askIt(p) });
    }
    for (const s of screens) out.push({ id: `go:${s.to}`, group: "Go to", icon: s.icon, label: s.label, run: () => go(s.to) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ql, h, tries]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const miss = q.length > 2 && !items.some((i) => i.group === "Ask" || i.group === "Accounts" || i.group === "Asks") && items.every((i) => i.group === "Go to" && !i.label.toLowerCase().includes(ql));
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(items.length - 1, a + 1)));
    else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
    else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[active];
      if (it) it.run();
      else if (q) askIt(q);
    }
  };
  let lastGroup = "";
  return (
    <dialog ref={ref} className="fd-palette" aria-label="Ask Foundry" onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="fd-palette-panel" onKeyDown={onKey}>
        <div className="fd-palette-input">
          <Icon name="spark" size={16} />
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Foundry, or jump to a screen or account" aria-label="Ask Foundry" autoComplete="off" spellCheck={false} role="combobox" aria-expanded="true" aria-controls="fd-palette-list" aria-activedescendant={items[active] ? `fd-pi-${active}` : undefined} />
          <Kbd>esc</Kbd>
        </div>
        <div className="fd-palette-list" ref={listRef} id="fd-palette-list" role="listbox">
          {miss && (
            <div className="fd-palette-miss" role="status">
              <b>Foundry can't do that one yet.</b> “{q}” isn't something the desk can act on. Try one of the asks below, or say it another way.
            </div>
          )}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? <div className="fd-palette-group">{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header}
                <button type="button" role="option" id={`fd-pi-${i}`} data-index={i} aria-selected={i === active} className="fd-palette-item" onMouseEnter={() => setActive(i)} onClick={it.run}>
                  <Icon name={it.icon} size={16} />
                  <span className="fd-palette-item-text">
                    <span>{it.label}</span>
                    {it.hint && <small>{it.hint}</small>}
                  </span>
                  {it.group === "Ask" && <Kbd>↵</Kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="fd-palette-foot">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span>
            <Kbd>↵</Kbd> open
          </span>
          <span>
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </div>
    </dialog>
  );
}

/* ---- Sheet: a generated surface, beside the desk on wide screens and over it on phones. ---- */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref, onClose);
  return (
    <dialog ref={ref} className="fd-sheet" aria-label={title} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="fd-sheet-panel">
        <div className="fd-sheet-head">
          <p>
            <Icon name="spark" size={14} />
            Foundry wrote this screen for you · {title}
          </p>
          <Button variant="ghost" size="icon" onClick={() => ref.current?.close()} aria-label="Close">
            <Icon name="close" />
          </Button>
        </div>
        <div className="fd-sheet-body">{children}</div>
      </div>
    </dialog>
  );
}
