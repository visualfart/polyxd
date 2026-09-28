import type { UIDocument } from "@polyxd/core";
import type { Capability, CapabilityRegistry } from "@polyxd/spec/capabilities";
import type { Rule } from "@polyxd/spec/patterns";

export type { UIDocument, Capability, CapabilityRegistry, Rule };

/** A component as the generator is told about it (from the spec, at build time). */
export interface CatalogComponent {
  name: string;
  /** Shell components are the product's authored frame and never appear in a generated document. */
  shell: boolean;
  /** Its props and when to use it, as one entry of the system prompt. */
  line: string;
}

/** A spec pattern: what the generator is told, and the checks a document that declares it must pass. */
export interface CatalogPattern {
  id: string;
  name: string;
  summary: string;
  whenToUse: string[];
  structure: string[];
  checks: Rule[];
}

/** A Design Direction (`direction.schema.json`). Only the parts the runtime reads are typed. */
export interface Direction {
  name: string;
  version?: string;
  designSystem?: string;
  profile?: {
    density?: "compact" | "comfortable" | "spacious";
    emphasisBudget?: number;
    dataDisplay?: "auto" | "prefer-charts" | "prefer-tables" | "prefer-metrics";
    motion?: "none" | "subtle" | "expressive";
    disclosure?: "show-everything" | "progressive";
    freedom?: "strict" | "guided" | "open";
  };
  voice?: Record<string, any>;
  patterns?: { prefer?: string[]; disallow?: string[]; custom?: string[] };
  rules?: Rule[];
  /** `document` is a path in the schema; the runtime also takes the document itself. */
  exemplars?: { request: string; document: string | UIDocument }[];
}

/** An exemplar ready for the prompt: the request and the document it was answered with. */
export interface Exemplar {
  request: string;
  document: UIDocument;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** What the runtime asks of a model: one system prompt, a short conversation, and streaming text. */
export interface GenerateRequest {
  system: string;
  messages: Message[];
  signal?: AbortSignal;
  /** Called with each piece of text as it arrives. */
  onText?: (text: string) => void;
}

export interface GeneratorOutput {
  text: string;
  usage?: Partial<Usage>;
}

/** Any model behind one call. The adapters implement it; so can your own code or a fake in tests. */
export interface Generator {
  /** A short name for the adapter, such as "anthropic". */
  readonly name: string;
  generate(request: GenerateRequest): Promise<GeneratorOutput | string>;
}

export interface Finding {
  severity: "error" | "warning";
  /** A check id such as `spec`, `pattern:root-is-confirm`, `rule:money-moves-in-confirm` or `json:parse`. */
  check: string;
  message: string;
}

export interface Report {
  /** No errors. Warnings don't make a document invalid. */
  valid: boolean;
  errors: number;
  warnings: number;
  findings: Finding[];
}

/** What the runtime passes to the checks: the same shape as the verifier's `staticAudit` options. */
export interface AuditOptions {
  /** Only the capabilities offered for this ask. */
  registry?: CapabilityRegistry;
  /** The Direction's rules and its compiled voice. */
  rules?: Rule[];
  /** The Direction's `profile.emphasisBudget`. */
  emphasisBudget?: number;
}

/** A document check. `staticAudit` from `@polyxd/verifier` fits this shape. */
export type Audit = (doc: any, options: AuditOptions) => Finding[] | Promise<Finding[]>;
