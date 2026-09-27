import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { ActionEvent, Data } from "@polyxd/react";
import type { Undo } from "../kit/store.ts";
import { matchAsk, suggestions } from "../kit/ask.ts";
import { JitSurface } from "../kit/jit.tsx";
import type { IntentFile } from "../kit/types.ts";
import { ASKABLE, REPORTS, intentById, live, resolveSlots, surfaceData } from "./intents.ts";
import { Ctx, store, useQuay, type SaveBar, type Session } from "./session.ts";
import { runAction, type Outcome } from "./actions.ts";
import { fullName, isLate, me } from "./seed.ts";
import { resolveMedia } from "./media.ts";
import { Avatar, Button, Icon, Kbd, NAV, NavList, useModal } from "./ui.tsx";
import { Home } from "./screens/home.tsx";
import { Orders, Order, Drafts, Draft, Checkouts } from "./screens/orders.tsx";
import { Products, Product, Collections, Collection, Inventory } from "./screens/products.tsx";
import { Customers, Customer } from "./screens/customers.tsx";
import { Discounts, Discount } from "./screens/discounts.tsx";
import { Marketing } from "./screens/marketing.tsx";
import { Analytics } from "./screens/analytics.tsx";
import { Settings } from "./screens/settings.tsx";

export { store, useQuay } from "./session.ts";

const PACKS = [
  ["polaris", "Polaris"],
  ["shadcn", "shadcn/ui"],
  ["material3", "Material 3"],
  ["carbon", "Carbon"],
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
  const mode = useMode(h.settings.appearance);
  const [palette, setPalette] = useState<{ text: string } | null>(null);
  const [surface, setSurface] = useState<{ intent: IntentFile; slots: Record<string, unknown>; data: Record<string, unknown> } | null>(null);
  const [snack, setSnack] = useState<{ text: string; undo?: Undo } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [bar, setBar] = useState<SaveBar | null>(null);

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
  // While a surface is open, its inputs re-derive what the store says (the low-stock list narrows,
  // the refund receipt follows the ticked items, the price preview follows the percent).
  const derive = useCallback((data: Data) => (surface ? { ...data, ...live(store.get(), surface.intent.id, data) } : undefined), [surface]);

  const say = useCallback((text: string, undo?: Undo) => setSnack({ text, undo }), []);
  const open = useCallback(
    (intentId: string, slots: Record<string, unknown> = {}) => {
      const intent = intentById(intentId);
      if (!intent) return say(`Quay hasn't learned "${intentId}" yet.`);
      setPalette(null);
      setDrawer(false);
      setSurface({ intent, slots, data: surfaceData(store.get(), intent, slots) });
    },
    [say],
  );
  const ask = useCallback((text = "") => setPalette({ text }), []);
  const saveBar = useCallback((b: SaveBar | null) => setBar(b), []);

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

  const session: Session = { h, store, mode, ask, open, say, saveBar };
  return (
    <Ctx.Provider value={session}>
      <div className="q">
        <TopBar onMenu={() => setDrawer(true)} onAsk={() => ask()} bar={bar} />
        <Sidebar />
        <main className="q-main" id="main">
          <Routes>
            <Route index element={<Home />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/drafts" element={<Drafts />} />
            <Route path="orders/drafts/:id" element={<Draft />} />
            <Route path="orders/checkouts" element={<Checkouts />} />
            <Route path="orders/:id" element={<Order />} />
            <Route path="products" element={<Products />} />
            <Route path="products/collections" element={<Collections />} />
            <Route path="products/collections/:id" element={<Collection />} />
            <Route path="products/inventory" element={<Inventory />} />
            <Route path="products/:id" element={<Product />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<Customer />} />
            <Route path="discounts" element={<Discounts />} />
            <Route path="discounts/:id" element={<Discount />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        {drawer && <Drawer onClose={() => setDrawer(false)} />}
      </div>
      {palette && <Palette initial={palette.text} onClose={() => setPalette(null)} onOpen={open} />}
      {surface && (
        <Sheet title={surface.intent.title} onClose={() => setSurface(null)}>
          <JitSurface intent={surface.intent} report={REPORTS[surface.intent.id]} data={surface.data} theme="polaris" mode={mode} density="compact" onAction={onAction} onDismiss={() => setSurface(null)} derive={derive} locale="en-US" resolveMedia={resolveMedia} origin="library" packs={PACKS} loadPack={loadPack} />
        </Sheet>
      )}
      {snack && (
        <div className="q-toast" role="status">
          <p>{snack.text}</p>
          {snack.undo && (
            <Button variant="tertiary" size="slim" onClick={undo}>
              Undo
            </Button>
          )}
          <button type="button" className="q-icon-btn" onClick={() => setSnack(null)} aria-label="Dismiss">
            <Icon name="close" />
          </button>
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

/* ---- Frame ---- */

function useNavCounts() {
  const { h } = useQuay();
  return useMemo(
    () => ({
      "/orders": h.orders.filter((o) => o.status === "open" && o.fulfillmentStatus !== "fulfilled").length,
      "/orders/drafts": h.drafts.filter((d) => d.status !== "completed").length,
      "/orders/checkouts": h.checkouts.filter((c) => c.emailStatus === "not_sent").length,
    }),
    [h],
  );
}

function SideContent({ onNavigate }: { onNavigate?: () => void }) {
  const counts = useNavCounts();
  return (
    <>
      <nav aria-label="Quay">
        <NavList counts={counts} onNavigate={onNavigate} />
      </nav>
      <div className="q-side-foot">
        <ul className="q-nav-list">
          <li>
            <Link to="/settings" className={`q-nav-item${location.pathname.endsWith("/settings") ? " is-active" : ""}`} onClick={onNavigate}>
              <Icon name="settings" size={18} />
              <span>Settings</span>
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}

function Sidebar() {
  return (
    <aside className="q-side">
      <SideContent />
    </aside>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { h } = useQuay();
  useModal(ref, onClose);
  return (
    <dialog ref={ref} className="q-drawer" aria-label="Navigation" onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="q-side">
        <div className="q-drawer-head">
          <span className="q-strong">{h.shop.name}</span>
          <button type="button" className="q-icon-btn" onClick={() => ref.current?.close()} aria-label="Close navigation">
            <Icon name="close" />
          </button>
        </div>
        <SideContent onNavigate={() => ref.current?.close()} />
      </div>
    </dialog>
  );
}

function TopBar({ onMenu, onAsk, bar }: { onMenu: () => void; onAsk: () => void; bar: SaveBar | null }) {
  const { h } = useQuay();
  const owner = me(h);
  return (
    <header className="q-top">
      <div className="q-top-left">
        <button type="button" className="q-icon-btn q-menu-btn" onClick={onMenu} aria-label="Open navigation">
          <Icon name="menu" size={20} />
        </button>
        <Link className="q-brand" to="/" aria-label="Quay home">
          <span className="q-mark" aria-hidden="true">
            q
          </span>
          <span className="q-brand-name">{h.shop.name}</span>
        </Link>
      </div>
      {bar ? (
        <div className="q-savebar" role="status">
          <span>{bar.label}</span>
          <span className="q-savebar-actions">
            <Button variant="tertiary" size="slim" onClick={bar.onDiscard}>
              Discard
            </Button>
            <Button variant="primary" size="slim" onClick={bar.onSave} disabled={bar.disabled}>
              Save
            </Button>
          </span>
        </div>
      ) : (
        <>
          <button type="button" className="q-askbox" onClick={onAsk} aria-label="Search or ask Quay">
            <Icon name="search" size={15} />
            <span>Search orders, products, customers, or ask a question</span>
            <Kbd>{MOD} K</Kbd>
          </button>
          <div className="q-top-right">
            <button type="button" className="q-icon-btn q-search-btn" onClick={onAsk} aria-label="Search or ask Quay">
              <Icon name="search" size={18} />
            </button>
            <Link to="/settings" className="q-user" aria-label={`${owner.name}, settings`}>
              <Avatar name={owner.name} size={26} />
              <span>{owner.name.split(" ")[0]}</span>
            </Link>
          </div>
        </>
      )}
    </header>
  );
}

/* ---- Command palette: the ask box, orders by number, products and customers by name, the screens. ---- */

interface Item {
  id: string;
  group: string;
  icon: string;
  label: string;
  hint?: string;
  run: () => void;
}

function Palette({ initial, onClose, onOpen }: { initial: string; onClose: () => void; onOpen: (id: string, slots: Record<string, unknown>) => void }) {
  const { h } = useQuay();
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
    if (!q) for (const t of tries) out.push({ id: `try:${t}`, group: "Try asking", icon: "spark", label: t, run: () => askIt(t) });
    const digits = ql.replace(/[^0-9]/g, "");
    if (digits.length >= 2 && /^#?\d+$/.test(ql)) {
      for (const o of h.orders.filter((o) => String(o.number).startsWith(digits)).slice(0, 6)) {
        const c = h.customers.find((x) => x.id === o.customerId);
        out.push({ id: `ord:${o.id}`, group: "Orders", icon: "orders", label: `#${o.number}`, hint: `${c ? fullName(c) : "Guest"} · $${o.total.toFixed(2)}${isLate(o) ? " · late" : ""}`, run: () => go(`/orders/${o.id}`) });
      }
    }
    if (ql.length >= 2) {
      for (const p of h.products.filter((p) => p.title.toLowerCase().includes(ql) || p.variants.some((v) => v.sku.toLowerCase().includes(ql))).slice(0, 5)) out.push({ id: `prd:${p.id}`, group: "Products", icon: "products", label: p.title, hint: `${p.variants.length === 1 ? "1 variant" : `${p.variants.length} variants`} · ${p.status}`, run: () => go(`/products/${p.id}`) });
      for (const c of h.customers.filter((c) => fullName(c).toLowerCase().includes(ql) || c.email.toLowerCase().includes(ql)).slice(0, 5)) out.push({ id: `cus:${c.id}`, group: "Customers", icon: "customers", label: fullName(c), hint: c.email, run: () => go(`/customers/${c.id}`) });
      const phrases = ASKABLE.flatMap((i) => i.ask.filter((p) => p.toLowerCase().includes(ql) && p.toLowerCase() !== ql)).slice(0, 4);
      for (const p of phrases) out.push({ id: `ask:${p}`, group: "Asks", icon: "spark", label: p, run: () => askIt(p) });
    }
    const screens = [...NAV.flatMap((n) => [{ to: n.to, label: n.label, icon: n.icon }, ...(n.children ?? []).map((c) => ({ to: c.to, label: c.label, icon: n.icon }))]), { to: "/settings", label: "Settings", icon: "settings" }].filter((n) => !ql || n.label.toLowerCase().includes(ql));
    for (const s of screens) out.push({ id: `go:${s.to}`, group: "Go to", icon: s.icon, label: s.label, run: () => go(s.to) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ql, h, tries]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const miss = q.length > 2 && !items.some((i) => i.group !== "Go to");
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
    <dialog ref={ref} className="q-palette" aria-label="Search or ask Quay" onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="q-palette-panel" onKeyDown={onKey}>
        <div className="q-palette-input">
          <Icon name="search" size={16} />
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Search orders, products, customers, or ask a question" aria-label="Search or ask Quay" autoComplete="off" spellCheck={false} role="combobox" aria-expanded="true" aria-controls="q-palette-list" aria-activedescendant={items[active] ? `q-pi-${active}` : undefined} />
          <Kbd>esc</Kbd>
        </div>
        <div className="q-palette-list" ref={listRef} id="q-palette-list" role="listbox">
          {miss && (
            <div className="q-palette-miss" role="status">
              <b>Quay can't do that one yet.</b> “{q}” isn't an order, a product, a customer, or something the store can act on. Try one of the asks, or say it another way.
            </div>
          )}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? <div className="q-palette-group">{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header}
                <button type="button" role="option" id={`q-pi-${i}`} data-index={i} aria-selected={i === active} className="q-palette-item" onMouseEnter={() => setActive(i)} onClick={it.run}>
                  <Icon name={it.icon} size={16} />
                  <span className="q-palette-item-text">
                    <span>{it.label}</span>
                    {it.hint && <small>{it.hint}</small>}
                  </span>
                  {it.group === "Ask" && <Kbd>↵</Kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="q-palette-foot">
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

/* ---- Sheet: a generated surface, beside the admin on wide screens and over it on phones. ---- */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref, onClose);
  return (
    <dialog ref={ref} className="q-sheet" aria-label={title} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="q-sheet-panel">
        <div className="q-sheet-head">
          <p>
            <Icon name="spark" size={14} />
            Quay wrote this screen for you · {title}
          </p>
          <button type="button" className="q-icon-btn" onClick={() => ref.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="q-sheet-body">{children}</div>
      </div>
    </dialog>
  );
}
