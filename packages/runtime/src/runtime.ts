import { checkDocument, generatedChecks, toReport } from "./audit.ts";
import { GeneratorError } from "./adapters/http.ts";
import { directionRules, relevantExemplars } from "./direction.ts";
import { forMemory, type MemoryStore } from "./memory.ts";
import { parseDocument } from "./parse.ts";
import { repairPrompt, systemPrompt, userPrompt } from "./prompt.ts";
import type { Audit, AuditOptions, Capability, Direction, Exemplar, Finding, Generator, Message, Report, UIDocument, Usage } from "./types.ts";

export interface RuntimeOptions {
  generator: Generator;
  /** The product's Design Direction, applied in the prompt and in the checks. */
  direction?: Direction;
  /** Where the screen shown for each intent is remembered. No memory when left out. */
  memory?: MemoryStore;
  /** How many times a failed document goes back to the model with its problems. Default 2. */
  maxRepairs?: number;
  /** Send warnings back for repair too, not only errors. Default false. */
  repairWarnings?: boolean;
  /** How many of the Direction's exemplars go in the prompt, chosen by relevance. Default 2. */
  exemplars?: number;
  /** Turns an exemplar's `document` path into the document. Exemplars given as paths are skipped without it. */
  resolveExemplar?: (path: string) => unknown | Promise<unknown>;
  /** The components generated screens may use. Default: every surface component in the spec. */
  components?: string[];
  /**
   * Replaces the built-in document checks, e.g. with `staticAudit` from `@polyxd/verifier` in Node.
   * It gets the same options the verifier takes. The generated-document checks still run.
   */
  audit?: Audit;
  /** Privacy-safe events: counts, timings, validity and check ids. Never the ask, the data or the document. */
  onEvent?: (event: RuntimeEvent) => void;
}

/** One request for a screen. */
export interface Ask {
  /** What the person asked, in their words. */
  ask: string;
  /** A stable key for what they're trying to do, such as `money.send`. Memory is kept by it. */
  intent: string;
  /** The capabilities the surface may trigger, by name. */
  capabilities?: Record<string, Capability>;
  /** The host data the surface binds to. Documents are checked against it. */
  data?: unknown;
  /** A spec pattern the surface should follow, when the host already knows. */
  pattern?: string;
  signal?: AbortSignal;
}

export interface Result {
  /** The accepted document; after giving up, the last one that parsed, if any. */
  document: UIDocument | undefined;
  /** What the checks found in `document`. `report.valid` is false when the runtime gave up. */
  report: Report;
  /** How many times the model was called. */
  attempts: number;
  usage: Usage;
}

/** What a stream yields, in order: `started`, then per attempt its `text` and `attempt`, then `repaired` if a repair worked, then `done` or `error`. */
export type Progress =
  | { type: "started"; remembered: boolean; exemplars: number }
  | { type: "text"; attempt: number; text: string }
  | { type: "attempt"; attempt: number; report: Report }
  | { type: "repaired"; attempt: number; report: Report }
  | { type: "done"; result: Result }
  | { type: "error"; reason: ErrorReason; error?: unknown; result?: Result };

export type ErrorReason = "invalid" | "aborted" | "generator" | "setup";

/** The events `onEvent` receives. Numbers, booleans and check ids only. */
export type RuntimeEvent =
  | { type: "started"; maxAttempts: number; exemplars: number; remembered: boolean; promptChars: number }
  | { type: "text"; attempt: number; chars: number }
  | { type: "attempt"; attempt: number; ms: number; chars: number; valid: boolean; errors: number; warnings: number; checks: string[]; inputTokens: number; outputTokens: number }
  | { type: "repaired"; attempt: number }
  | { type: "done"; attempts: number; ms: number; warnings: number; checks: string[]; inputTokens: number; outputTokens: number }
  | { type: "error"; reason: ErrorReason; attempts: number; ms: number; status?: number; checks?: string[] };

export interface Runtime {
  /** Generates, checks and repairs a document for one ask. */
  generate(ask: Ask, options?: { onProgress?: (progress: Progress) => void }): Promise<Result>;
  /** The same, as an async iterator of progress. Stopping early aborts the model call. */
  stream(ask: Ask): AsyncGenerator<Progress, void, undefined>;
  /** The exact prompt `generate` would send first, for inspection and tests. */
  prompt(ask: Ask): Promise<{ system: string; messages: Message[] }>;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const checkIds = (findings: Finding[]) => [...new Set(findings.map((f) => f.check))].sort();
const aborted = (signal: AbortSignal | undefined, err?: unknown) => signal?.aborted === true || (err as Error | undefined)?.name === "AbortError";

export function createRuntime(options: RuntimeOptions): Runtime {
  const maxAttempts = Math.max(0, options.maxRepairs ?? 2) + 1;
  const rules = directionRules(options.direction);
  const system = systemPrompt({ components: options.components });

  async function exemplarsFor(ask: Ask): Promise<Exemplar[]> {
    const chosen = relevantExemplars(options.direction?.exemplars ?? [], ask.ask, ask.intent, options.exemplars ?? 2);
    const out: Exemplar[] = [];
    for (const e of chosen) {
      const doc = typeof e.document === "string" ? (options.resolveExemplar ? await options.resolveExemplar(e.document) : undefined) : e.document;
      if (doc && typeof doc === "object") out.push({ request: e.request, document: doc as UIDocument });
    }
    return out;
  }

  async function prepare(ask: Ask) {
    const previous = options.memory ? await options.memory.get(ask.intent) : undefined;
    const exemplars = await exemplarsFor(ask);
    const user = userPrompt({ ask: ask.ask, intent: ask.intent, pattern: ask.pattern, capabilities: ask.capabilities, data: ask.data, direction: options.direction, exemplars, previous });
    return { user, remembered: previous !== undefined, exemplars: exemplars.length };
  }

  async function check(doc: Record<string, unknown>, ask: Ask): Promise<Finding[]> {
    const checked = ask.data !== undefined ? { ...doc, data: ask.data } : doc;
    const auditOptions: AuditOptions = { rules, emphasisBudget: options.direction?.profile?.emphasisBudget };
    if (ask.capabilities) auditOptions.registry = { name: "ask", capabilities: ask.capabilities };
    const found = options.audit ? await options.audit(checked, auditOptions) : checkDocument(checked, { ...auditOptions, missingData: ask.data !== undefined ? "error" : "warning" });
    return [...found, ...generatedChecks(doc, options.direction, options.components)];
  }

  async function run(ask: Ask, onProgress: (p: Progress) => void, signal: AbortSignal | undefined): Promise<Result> {
    const started = now();
    const ms = () => Math.round(now() - started);
    const event = (e: RuntimeEvent) => {
      try {
        options.onEvent?.(e);
      } catch {
        // An analytics hook never breaks generation.
      }
    };
    const usage: Usage = { inputTokens: 0, outputTokens: 0 };
    let attempts = 0;
    const fail = (reason: ErrorReason, error: unknown, result?: Result): void => {
      onProgress({ type: "error", reason, error, result });
      event({ type: "error", reason, attempts, ms: ms(), ...(error instanceof GeneratorError && error.status !== undefined ? { status: error.status } : {}), ...(result ? { checks: checkIds(result.report.findings) } : {}) });
    };

    let prepared: Awaited<ReturnType<typeof prepare>>;
    try {
      prepared = await prepare(ask);
    } catch (err) {
      fail("setup", err);
      throw err;
    }
    onProgress({ type: "started", remembered: prepared.remembered, exemplars: prepared.exemplars });
    event({ type: "started", maxAttempts, exemplars: prepared.exemplars, remembered: prepared.remembered, promptChars: system.length + prepared.user.length });

    let messages: Message[] = [{ role: "user", content: prepared.user }];
    let last: { document: UIDocument | undefined; report: Report } = { document: undefined, report: toReport([]) };
    while (attempts < maxAttempts) {
      attempts++;
      const attempt = attempts;
      const attemptStarted = now();
      let chars = 0;
      let text: string;
      let used: Partial<Usage> | undefined;
      try {
        if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
        const out = await options.generator.generate({
          system,
          messages,
          signal,
          onText: (piece) => {
            chars += piece.length;
            onProgress({ type: "text", attempt, text: piece });
            event({ type: "text", attempt, chars: piece.length });
          },
        });
        if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
        ({ text, usage: used } = typeof out === "string" ? { text: out, usage: undefined } : out);
      } catch (err) {
        fail(aborted(signal, err) ? "aborted" : "generator", err);
        throw err;
      }
      // A generator that doesn't stream still shows its text once.
      if (chars === 0 && text) {
        chars = text.length;
        onProgress({ type: "text", attempt, text });
        event({ type: "text", attempt, chars });
      }
      const u = { inputTokens: used?.inputTokens ?? 0, outputTokens: used?.outputTokens ?? 0 };
      usage.inputTokens += u.inputTokens;
      usage.outputTokens += u.outputTokens;

      const parsed = parseDocument(text);
      const findings = parsed.error !== undefined ? [{ severity: "error" as const, check: "json:parse", message: parsed.error }] : await check(parsed.document, ask);
      const report = toReport(findings);
      const document = parsed.document as UIDocument | undefined;
      onProgress({ type: "attempt", attempt, report });
      event({ type: "attempt", attempt, ms: Math.round(now() - attemptStarted), chars, valid: report.valid, errors: report.errors, warnings: report.warnings, checks: checkIds(report.findings), ...u });
      if (document) last = { document, report };
      else if (!last.document) last = { document: undefined, report };

      const blocking = report.findings.filter((f) => f.severity === "error" || (options.repairWarnings && attempt < maxAttempts));
      if (document && !blocking.length) {
        if (attempt > 1) {
          onProgress({ type: "repaired", attempt, report });
          event({ type: "repaired", attempt });
        }
        if (options.memory) {
          try {
            await options.memory.set(ask.intent, forMemory(document));
          } catch {
            // Memory is a convenience: a full or unavailable store doesn't lose a good document.
          }
        }
        const result: Result = { document, report, attempts, usage };
        onProgress({ type: "done", result });
        event({ type: "done", attempts, ms: ms(), warnings: report.warnings, checks: checkIds(report.findings), ...usage });
        return result;
      }
      messages = [
        { role: "user", content: prepared.user },
        { role: "assistant", content: text },
        { role: "user", content: repairPrompt(blocking) },
      ];
    }
    const result: Result = { document: last.document, report: { ...last.report, valid: false }, attempts, usage };
    fail("invalid", undefined, result);
    return result;
  }

  /** An abort signal that follows the ask's and can also be aborted by the runtime. */
  function linked(signal?: AbortSignal): AbortController {
    const controller = new AbortController();
    if (signal?.aborted) controller.abort(signal.reason);
    else signal?.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    return controller;
  }

  return {
    generate: (ask, opts = {}) => run(ask, opts.onProgress ?? (() => {}), ask.signal),

    async *stream(ask) {
      const controller = linked(ask.signal);
      const queue: Progress[] = [];
      let wake: (() => void) | undefined;
      let finished = false;
      const push = (p: Progress) => {
        queue.push(p);
        wake?.();
      };
      run(ask, push, controller.signal).then(
        () => {},
        () => {}, // Failures arrive in the queue as an `error` item.
      ).finally(() => {
        finished = true;
        wake?.();
      });
      try {
        for (;;) {
          if (queue.length) {
            yield queue.shift()!;
            continue;
          }
          if (finished) return;
          await new Promise<void>((resolve) => (wake = resolve));
          wake = undefined;
        }
      } finally {
        if (!finished) controller.abort(new DOMException("The stream was closed", "AbortError"));
      }
    },

    async prompt(ask) {
      const { user } = await prepare(ask);
      return { system, messages: [{ role: "user", content: user }] };
    },
  };
}
