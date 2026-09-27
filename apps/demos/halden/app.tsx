import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { ActionEvent } from "@polyxd/react";
import type { Undo } from "../kit/store.ts";
import { matchAsk, suggestions } from "../kit/ask.ts";
import { JitSurface } from "../kit/jit.tsx";
import type { IntentFile } from "../kit/types.ts";
import { ASKABLE, REPORTS, intentById, resolveSlots, surfaceData } from "./intents.ts";
import { useHalden } from "./session.ts";
import { runAction, type Outcome } from "./actions.ts";
import { Button, Fab, Icon, Nav } from "./ui.tsx";
import { AuthoredScreen } from "./authored.tsx";
import { PACKS, loadPack } from "./packs.ts";
import { Home } from "./screens/home.tsx";
import { Payments, Payment } from "./screens/payments.tsx";
import { Payees, Payee } from "./screens/payees.tsx";
import { Settings } from "./screens/settings.tsx";
import { Welcome } from "./screens/welcome.tsx";
import { Ctx, type Session } from "./session.ts";

export { store, useHalden } from "./session.ts";
import { store } from "./session.ts";

export function App() {
  const h = store.useState();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useMode(h.settings.appearance);
  const [asking, setAsking] = useState<{ text: string } | null>(null);
  const [surface, setSurface] = useState<{ intent: IntentFile; slots: Record<string, unknown>; data: Record<string, unknown> } | null>(null);
  const [snack, setSnack] = useState<{ text: string; undo?: Undo } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.pxdMode = mode;
  }, [mode]);
  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(() => setSnack(null), snack.undo ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [snack]);

  const say = useCallback((text: string, undo?: Undo) => setSnack({ text, undo }), []);
  const open = useCallback(
    (intentId: string, slots: Record<string, unknown> = {}) => {
      const intent = intentById(intentId);
      if (!intent) return say(`Halden hasn't learned "${intentId}" yet.`);
      setAsking(null);
      setSurface({ intent, slots, data: surfaceData(store.get(), intent, slots) });
    },
    [say],
  );
  const ask = useCallback((text = "") => setAsking({ text }), []);

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
  if (!h.settings.onboarded && location.pathname !== "/welcome") return <Navigate to="/welcome" replace />;
  return (
    <Ctx.Provider value={session}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route
          path="*"
          element={
            <div className="hal">
              <Nav onAsk={() => ask()} />
              <main className="hal-main" id="main">
                <Routes>
                  <Route index element={<Home />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="payments/:id" element={<Payment />} />
                  <Route path="payees" element={<Payees />} />
                  <Route path="payees/:id" element={<Payee />} />
                  {/* Authored Polyxd documents (authored/*.json) inside the same shell; the routes other screens link to are unchanged. */}
                  <Route
                    path="budgets"
                    element={
                      <AuthoredScreen
                        id="screen.budgets"
                        trailing={
                          <Button tone="text" icon="add" onClick={() => open("budget.set")}>
                            New
                          </Button>
                        }
                      />
                    }
                  />
                  <Route path="cards" element={<AuthoredScreen id="screen.card" back="/" />} />
                  <Route path="insights" element={<AuthoredScreen id="screen.insights" />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              <Fab onClick={() => ask()} />
            </div>
          }
        />
      </Routes>
      {asking && <AskSheet initial={asking.text} onClose={() => setAsking(null)} onOpen={open} />}
      {surface && (
        <Sheet label={surface.intent.document.surface.title} onClose={() => setSurface(null)}>
          <JitSurface intent={surface.intent} report={REPORTS[surface.intent.id]} data={surface.data} theme="material3" mode={mode} density="comfortable" onAction={onAction} onDismiss={() => setSurface(null)} origin="library" packs={PACKS} loadPack={loadPack} />
        </Sheet>
      )}
      {snack && (
        <div className="hal-snackbar" role="status">
          <p>{snack.text}</p>
          {snack.undo && (
            <Button tone="text" onClick={undo}>
              Undo
            </Button>
          )}
          <button type="button" className="hal-icon-button" onClick={() => setSnack(null)} aria-label="Dismiss">
            <Icon name="close" size={20} />
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

/* ---- A modal sheet: bottom on phones, side on wide screens. Native dialog, so focus and Escape work. ---- */

/** Opens a native dialog once on mount and reports its close (Escape, the scrim, a Close button). */
function useModal(ref: React.RefObject<HTMLDialogElement | null>, onClose: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const close = () => latest.current();
    d.addEventListener("close", close);
    return () => d.removeEventListener("close", close);
  }, [ref]);
}

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref, onClose);
  return (
    <dialog ref={ref} className="hal-sheet" aria-label={label} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="hal-sheet-panel">
        <div className="hal-sheet-handle" aria-hidden="true" />
        <div className="hal-sheet-head">
          <p>Halden wrote this screen for you</p>
          <button type="button" className="hal-icon-button" onClick={() => ref.current?.close()} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="hal-sheet-body">{children}</div>
      </div>
    </dialog>
  );
}

/* ---- The ask screen ---- */

function AskSheet({ initial, onClose, onOpen }: { initial: string; onClose: () => void; onOpen: (id: string, slots: Record<string, unknown>) => void }) {
  const { h } = useHalden();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initial);
  const [miss, setMiss] = useState<string | null>(null);
  const tries = useMemo(() => suggestions(ASKABLE, 4), []);
  useModal(ref, onClose);
  useEffect(() => input.current?.focus(), []);
  const go = (t: string) => {
    const m = matchAsk(t, ASKABLE);
    if (!m) return setMiss(t);
    onOpen(m.intent.id, resolveSlots(h, m.slots));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) go(text.trim());
  };
  return (
    <dialog ref={ref} className="hal-sheet" aria-label="Ask Halden" onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="hal-sheet-panel">
        <div className="hal-sheet-handle" aria-hidden="true" />
        <div className="hal-askscreen">
          <form onSubmit={submit} role="search">
            <label className="hal-search">
              <Icon name="spark" />
              <input ref={input} value={text} onChange={(e) => (setText(e.target.value), setMiss(null))} placeholder="Ask Halden anything" aria-label="Ask Halden" autoComplete="off" enterKeyHint="go" />
              {text && (
                <button type="button" className="hal-icon-button" onClick={() => (setText(""), input.current?.focus())} aria-label="Clear">
                  <Icon name="close" size={20} />
                </button>
              )}
            </label>
            <button type="button" className="hal-icon-button" onClick={() => ref.current?.close()} aria-label="Close">
              <Icon name="close" />
            </button>
          </form>
          {miss && (
            <div className="hal-ask-miss" role="status">
              <b>Halden can't do that one yet.</b>
              <span>“{miss}” isn't something the account can act on. Try one of the things below, or ask in different words.</span>
            </div>
          )}
          <h2>Try asking</h2>
          <ul className="hal-ask-suggest">
            {tries.map((t) => (
              <li key={t}>
                <button type="button" onClick={() => go(t)}>
                  <span className="hal-ask-icon">
                    <Icon name="search" size={20} />
                  </span>
                  <span>{t}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </dialog>
  );
}
