import { useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ActionEvent, Data } from "@polyxd/react";
import { JitSurface } from "../kit/jit.tsx";
import { REPORTS, authoredById, live, surfaceData } from "./intents.ts";
import { runAction } from "./actions.ts";
import { store, useQuay } from "./session.ts";
import { resolveMedia } from "./media.ts";
import { PACKS, loadPack } from "./packs.ts";
import { Button, Empty } from "./ui.tsx";

/**
 * A screen of the admin that is a Polyxd document rather than hand-written React: the same
 * renderer, verifier and mark as a generated surface, inside the admin's own shell (the top bar,
 * the sidebar and the palette stay React). The document lives in authored/<id>.json; its data
 * comes from views.ts like an intent's does, and its buttons go through actions.ts.
 */
export function AuthoredScreen({ id, slots, onData, className }: { id: string; slots?: Record<string, unknown>; onData?: (data: Data, act: (e: ActionEvent) => void) => void; className?: string }) {
  const { h, mode, open, say } = useQuay();
  const navigate = useNavigate();
  const doc = authoredById(id);
  // Slots only change when their values do, so the surface isn't remounted on every render.
  const slotKey = JSON.stringify(slots ?? {});
  const stableSlots = useMemo(() => JSON.parse(slotKey) as Record<string, unknown>, [slotKey]);
  // The data follows the store: after an action the numbers on the page are the new numbers.
  const data = useMemo(() => (doc ? surfaceData(h, doc, stableSlots) : {}), [h, doc, stableSlots]);
  // Inputs on the page (a date range, the stock filters, a saved view) re-derive the rest from the store.
  const derive = useCallback((d: Data) => ({ ...d, ...live(store.get(), id, d) }), [id]);
  const act = useCallback(
    (e: ActionEvent) => {
      const out = runAction(store, e);
      if (out.say) say(out.say, out.undo);
      if (out.next) open(out.next.intent, { ...stableSlots, ...out.next.slots });
      if (out.go) navigate(out.go);
    },
    [say, open, navigate, stableSlots],
  );
  // The renderer reports a change from inside its own state update; anything that navigates waits a tick.
  const onDataChange = useMemo(() => (onData ? (d: Data) => queueMicrotask(() => onData(d, act)) : undefined), [onData, act]);
  if (!doc) return <Empty icon="alert" title="That screen isn't here" body={`Quay has no authored document called ${id}.`} action={<Button to="/">Home</Button>} />;
  return (
    <div className={["q-authored", className].filter(Boolean).join(" ")}>
      <JitSurface intent={doc} report={REPORTS[id]} data={data} theme="polaris" mode={mode} density="compact" locale="en-US" onAction={act} onDismiss={() => navigate("/")} onDataChange={onDataChange} derive={derive} resolveMedia={resolveMedia} origin="authored" packs={PACKS} loadPack={loadPack} />
    </div>
  );
}

/**
 * Analytics keeps its date range in the URL, as the React screen did (?range=7), so a range can be
 * linked to. The document's own Choice changes the range; the shell hears it and calls the
 * analytics.range capability, which is what moves the URL.
 */
export function AnalyticsScreen() {
  const [params] = useSearchParams();
  const range = params.get("range") ?? "30";
  const slots = useMemo(() => (range === "30" ? {} : { range }), [range]);
  const onData = useCallback(
    (d: Data, act: (e: ActionEvent) => void) => {
      const next = (d.analytics as { range?: string } | undefined)?.range;
      if (next && next !== range) act({ name: "analytics.range", context: { range: next }, source: "range" });
    },
    [range],
  );
  return <AuthoredScreen id="screen.analytics" slots={slots} onData={onData} />;
}
