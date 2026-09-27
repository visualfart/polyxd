import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { ActionEvent, Data } from "@polyxd/react";
import { JitSurface } from "../kit/jit.tsx";
import type { IntentFile } from "../kit/types.ts";
import { AUTHORED, REPORTS, surfaceData } from "./intents.ts";
import { runAction } from "./actions.ts";
import { PACKS, loadPack } from "./packs.ts";
import { useHalden } from "./session.ts";
import type { Halden } from "./seed.ts";
import { TopBar } from "./ui.tsx";

/**
 * A screen of the product that is an authored Polyxd document (authored/<id>.json) rather than
 * hand-written React. The shell around it (top bar, nav, FAB, snackbar) stays the product's; the
 * document binds to the same views the React screen computed, and its actions go through the same
 * `runAction` as the generated surfaces. Verified the same way, so the mark says "Authored · Checked".
 */
export function AuthoredScreen({ id, title, back, trailing }: { id: string; title?: string; back?: string; trailing?: ReactNode }) {
  const { h, store, mode, open, say } = useHalden();
  const navigate = useNavigate();
  const doc = AUTHORED.find((d) => d.id === id);
  const data = useMemo(() => (doc ? surfaceData(h, doc, {}) : {}), [h, doc]);
  if (!doc) return <TopBar title={title ?? "Not found"} back="/" />;
  const derive = DERIVE[id] ? (d: Data) => DERIVE[id](store.get(), doc, d) : undefined;
  const onAction = (e: ActionEvent) => {
    const out = runAction(store, e);
    if (out.say) say(out.say, out.undo);
    if (out.next) open(out.next.intent, out.next.slots);
    if (out.go) navigate(out.go);
  };
  return (
    <>
      <TopBar title={title ?? doc.document.surface.title} back={back} trailing={trailing} />
      <div className="hal-authored">
        {/* Keyed on the data, so a change made elsewhere (a budget set from the ask sheet) reaches the surface. */}
        <JitSurface key={fingerprint(data)} intent={doc} report={REPORTS[doc.id]} data={data} theme="material3" mode={mode} density="comfortable" origin="authored" onAction={onAction} onDismiss={() => navigate("/")} derive={derive} packs={PACKS} loadPack={loadPack} />
      </div>
    </>
  );
}

/**
 * Inputs on a screen that change its figures: the surface keeps the input's value, and this
 * recomputes everything else from the store, so the month someone picks on Insights refigures the
 * total, the categories and the regular outgoings without the shell knowing.
 */
const DERIVE: Record<string, (h: Halden, doc: IntentFile, data: Data) => Data> = {
  "screen.insights": (h, doc, data) => surfaceData(h, doc, { month: (data.insights as { month?: string } | undefined)?.month }),
};

/** A short, stable key for a data object: the surface remounts only when what it shows has changed. */
function fingerprint(data: Data): string {
  const s = JSON.stringify(data);
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  return `${s.length}:${hash}`;
}
