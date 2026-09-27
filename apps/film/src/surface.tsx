/**
 * The real renderer in the film. Remotion renders React and @polyxd/react is React, so the pack
 * flips, the scan, the grid and the split frame are `PolyxdSurface` mounted with the theme CSS
 * imported, not screenshots. The document is the spec's send-money example with Halden's own
 * payees as data, so the live render matches the footage: Priya chosen, £40 typed.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { PolyxdSurface, type UIDocument } from "@polyxd/react";
import "@polyxd/react/styles.css";
import "@polyxd/react/themes/material3.css";
import "@polyxd/react/themes/carbon.css";
import "@polyxd/react/themes/polaris.css";
import "@polyxd/react/themes/govuk.css";
import "@polyxd/react/themes/shadcn.css";
import "@polyxd/react/themes/fluent.css";
import "@polyxd/react/themes/spectrum.css";
import "@polyxd/react/themes/antd.css";
import "@polyxd/react/themes/bootstrap.css";
import "@polyxd/react/themes/chakra.css";
import "@polyxd/react/themes/mantine.css";
import "@polyxd/react/themes/primer.css";
import "@polyxd/react/themes/radix.css";
import "@polyxd/react/themes/sketch.css";
import "@polyxd/react/themes/wireframe.css";
import formDoc from "../../../packages/spec/examples/money-send-form.json";
import confirmDoc from "../../../packages/spec/examples/money-send-confirm.json";

/** The thirteen real design systems, in the order the grid shows them. */
export const PACKS: { key: string; name: string }[] = [
  { key: "material3", name: "Material 3" },
  { key: "carbon", name: "Carbon" },
  { key: "polaris", name: "Polaris" },
  { key: "govuk", name: "GOV.UK" },
  { key: "shadcn", name: "shadcn/ui" },
  { key: "fluent", name: "Fluent" },
  { key: "spectrum", name: "Spectrum" },
  { key: "antd", name: "Ant Design" },
  { key: "bootstrap", name: "Bootstrap" },
  { key: "chakra", name: "Chakra" },
  { key: "mantine", name: "Mantine" },
  { key: "primer", name: "Primer" },
  { key: "radix", name: "Radix" },
];

/** Halden's payees, as the product has them, so the live render and the footage agree. */
const PAYEES = [
  { id: "p_priya", name: "Priya Raman", initials: "PR", recent: true, bank: "04-00-04 ··04" },
  { id: "p_amara", name: "Amara Osei", initials: "AO", recent: true, bank: "60-83-71 ··86" },
  { id: "p_landlord", name: "Redcliffe Lettings", initials: "RL", recent: true, bank: "30-96-26 ··63" },
  { id: "p_tom", name: "Tom Ashby", initials: "TA", recent: false, bank: "20-45-77 ··45" },
  { id: "p_dan", name: "Dan Whitfield", initials: "DW", recent: false, bank: "11-22-33 ··22" },
];

export const FORM = formDoc as unknown as UIDocument;
/** The spec's confirm example, with the button labelled for this payment (the example's is a £250 rent share). */
export const CONFIRM = {
  ...(confirmDoc as unknown as UIDocument),
  components: (confirmDoc as unknown as UIDocument).components.map((c: any) => (c.id === "confirm" ? { ...c, confirm: { ...c.confirm, label: "Send £40.00" } } : c)),
} as UIDocument;

/** The form's data at a step of the task: nothing chosen, Priya chosen, an amount typed. */
export const formData = (recipient: string | null = "p_priya", amount: number | null = 40, reference = "Dinner", few = false) => ({
  payees: few ? PAYEES.slice(0, 3) : PAYEES,
  draft: { recipient, amount, reference },
  quote: { fee: 0, arrives: "2026-09-28T20:56:00Z" },
});
export const CONFIRM_DATA = {
  quote: { id: "q_40", recipient: "Priya Raman", amount: 40, fee: 0, reference: "Dinner", recipientAccount: "04-00-04 ··04", recipientInitials: "PR" },
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Measured = Record<string, Rect>;

/**
 * The real renderer, at a width, in a pack and a mode. `measure` names elements to find inside it
 * (by selector) and reports their boxes relative to the surface's top-left, in the surface's own
 * pixels, so the scan ticks and the pointer can be keyed to where things really are.
 */
export function Surface({ theme, mode = "light", width, doc = FORM, data, measure, onMeasure, style, className, height }: { theme: string; mode?: "light" | "dark"; width: number; doc?: UIDocument; data?: Record<string, unknown>; measure?: Record<string, string>; onMeasure?: (m: Measured) => void; style?: CSSProperties; className?: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string>("");
  useLayoutEffect(() => {
    if (!measure || !onMeasure || !ref.current) return;
    const base = ref.current.getBoundingClientRect();
    const out: Measured = {};
    for (const [name, sel] of Object.entries(measure)) {
      const el = ref.current.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out[name] = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    }
    const key = JSON.stringify(out);
    if (key !== last.current) {
      last.current = key;
      onMeasure(out);
    }
  });
  return (
    <div ref={ref} className={className} style={{ width, height, overflow: height ? "hidden" : undefined, position: "relative", ...style }}>
      <PolyxdSurface document={doc} data={data ?? formData()} theme={theme} mode={mode} resolveMedia={() => undefined} />
    </div>
  );
}

/** Measures once; returns the boxes (empty until the first layout). */
export function useMeasured() {
  const [m, setM] = useState<Measured>({});
  return [m, setM] as const;
}

/** The selectors the scenes key their graphics to, by the names the accessibility tree uses. */
export const FORM_PARTS: Record<string, string> = {
  root: ".pxd-surface",
  title: "h1",
  recipient: ".pxd-choice",
  priya: "[role=radio][aria-label='Priya Raman']",
  amount: ".pxd-hero-field",
  amountInput: ".pxd-hero-value",
  reference: ".pxd-field:has(input.pxd-input)",
  details: ".pxd-detail-list",
  continue: "button[type=submit]",
  cancel: "button.pxd-button-secondary",
};
