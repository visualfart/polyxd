import type { UIDocument } from "@polyxd/react";
import type { IntentDef } from "./ask.ts";

/**
 * One thing a product can be asked for that it has no screen of its own for. The document was
 * generated ahead of time from the spec's prompt, then verified across the packs; both ship with
 * the product so the ask box answers instantly and honestly. Live generation (a Worker with a
 * model key) produces the same shape at request time.
 */
export interface Intent extends IntentDef {
  /** Capabilities the surface may use, from the product's registry. */
  capabilities: string[];
  /** Spec pattern the surface should follow, when one applies. */
  pattern?: string;
  /** JSON Pointer into the product's data → surface data. Keys are the surface's top-level data keys. */
  data: Record<string, unknown>;
  /** Slot → JSON Pointer into the surface data (a matched amount pre-fills the draft). */
  fill?: Record<string, string>;
}

export interface IntentFile extends Intent {
  document: UIDocument;
  /** Slots that make a representative data snapshot for verification (scripts/snapshot.ts). */
  sample?: Record<string, unknown>;
}

/** What the verifier said, trimmed to what a person reading the badge wants. */
export interface ReportSummary {
  score: number;
  errors: number;
  warnings: number;
  /** theme/mode/width → findings count */
  targets: { theme: string; mode: string; width: number; findings: number }[];
  checkedAt: string;
  /** Check set fingerprint, so a report from an older verifier is visibly older. */
  verifier: string;
  findings: { severity: string; check: string; message: string; where: string }[];
}

export interface Capability {
  description: string;
  risk: "none" | "low" | "consequential" | "destructive";
  inputs?: unknown;
  undo?: string;
  sideEffects?: string[];
  agentMayInvoke?: boolean;
}

export interface Registry {
  name: string;
  capabilities: Record<string, Capability>;
}
