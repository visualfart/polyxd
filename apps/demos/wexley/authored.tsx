import { useMemo } from "react";
import type { ActionEvent } from "@polyxd/react";
import { JitSurface } from "../kit/jit.tsx";
import { REPORTS, authoredById, surfaceData } from "./intents.ts";
import { useWexley } from "./session.ts";
import { Breadcrumbs } from "./ui.tsx";

/**
 * A screen of the product that is an authored Polyxd document rather than hand-written React:
 * the page furniture (header, phase banner, breadcrumbs, footer) is the product's; the content is
 * the document in authored/<id>.json, bound to today's data through the same views the asked-for
 * pages use, and checked by the same verifier. The surface's title is the page's h1.
 */
export function AuthoredScreen({ id, crumb, onAction, packs, loadPack }: { id: string; crumb: string; onAction: (e: ActionEvent) => void; packs: { id: string; name: string }[]; loadPack: (id: string) => Promise<void> }) {
  const { w } = useWexley();
  const screen = authoredById(id);
  const data = useMemo(() => (screen ? surfaceData(w, screen, {}) : {}), [w, screen]);
  // Start the surface again whenever the data changes at all (an action, an undo), not only when its size does.
  const key = useMemo(() => JSON.stringify(data), [data]);
  if (!screen) return null;
  return (
    <>
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: crumb }]} />
      <div className="wx-grid">
        <div className="wx-surface wx-authored wx-col-full">
          <JitSurface key={key} intent={screen} report={REPORTS[screen.id]} data={data} theme="govuk" mode="light" density="comfortable" disclosure="progressive" onAction={onAction} onDismiss={() => undefined} origin="authored" packs={packs} loadPack={loadPack} />
        </div>
      </div>
    </>
  );
}
