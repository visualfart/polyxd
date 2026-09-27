import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ActionEvent, Data } from "@polyxd/react";
import { JitSurface } from "../kit/jit.tsx";
import { REPORTS, authoredById, live, surfaceData } from "./intents.ts";
import { runAction } from "./actions.ts";
import { store, useFoundry } from "./session.ts";
import { PACKS, loadPack } from "./packs.ts";
import { Button, Empty } from "./ui.tsx";

/**
 * A screen of the product that is a Polyxd document rather than hand-written React: the same
 * renderer, verifier and mark as a generated surface, inside the product's own shell (the
 * sidebar, the top bar and the palette stay React). The document lives in authored/<id>.json;
 * its data comes from views.ts like an intent's does, and its actions go through actions.ts.
 */
export function AuthoredScreen({ id, slots, className }: { id: string; slots?: Record<string, unknown>; className?: string }) {
  const { h, mode, open, say } = useFoundry();
  const navigate = useNavigate();
  const doc = authoredById(id);
  // Slots only change when their values do, so the surface isn't remounted on every render.
  const slotKey = JSON.stringify(slots ?? {});
  const stableSlots = useMemo(() => JSON.parse(slotKey) as Record<string, unknown>, [slotKey]);
  // The data follows the store: after an action the numbers on the page are the new numbers.
  const data = useMemo(() => (doc ? surfaceData(h, doc, stableSlots) : {}), [h, doc, stableSlots]);
  const derive = useCallback((d: Data) => ({ ...d, ...live(store.get(), id, d) }), [id]);
  const onAction = (e: ActionEvent) => {
    const out = runAction(store, e);
    if (out.say) say(out.say, out.undo);
    if (out.next) open(out.next.intent, { ...stableSlots, ...out.next.slots });
    if (out.go) navigate(out.go);
  };
  if (!doc) return <Empty icon="alert" title="That screen isn't here" body={`Foundry has no authored document called ${id}.`} action={<Button to="/">Overview</Button>} />;
  return (
    <div className={["fd-authored", className].filter(Boolean).join(" ")}>
      <JitSurface intent={doc} report={REPORTS[id]} data={data} theme="shadcn" mode={mode} density="compact" locale="en-US" onAction={onAction} onDismiss={() => navigate("/")} derive={derive} origin="authored" packs={PACKS} loadPack={loadPack} />
    </div>
  );
}
