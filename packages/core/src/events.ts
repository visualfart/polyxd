/**
 * Semantic analytics events: what people do with a rendered surface, said in the document's own
 * terms (its intent, pattern, component ids and capability names), never in the values they typed.
 * The shape is the spec's schema/event.schema.json; core's tests hold these types to it.
 *
 * A renderer creates one emitter per surface it shows and tells it what happened: shown, an action
 * dispatched, an input edited, an input refused, a Status drawn, the surface taken down. The
 * emitter decides which events that makes and hands each one to the host's handler. Polyxd itself
 * receives none of them.
 */
import type { Action, Node, UIDocument } from "./document.ts";
import { indexById } from "./document.ts";

/** Every event type the schema defines, in its order. */
export const SEMANTIC_EVENT_TYPES = [
  "surface.shown", "surface.dismissed", "surface.regenerated",
  "action.taken", "checkpoint.reached", "task.completed", "task.abandoned",
  "input.error", "status.shown", "undo", "feedback",
] as const;

export type SemanticEventType = (typeof SEMANTIC_EVENT_TYPES)[number];

/** Which surface an event is about. `intent` is the surface id when the document gives no intent. */
export interface EventSurface {
  id: string;
  intent: string;
  pattern?: string;
  journey?: string;
  specVersion?: string;
  /** Model or generator id and version, when the host knows it */
  generator?: string;
  /** Design Direction name@version */
  direction?: string;
  /** Experiment key to variant */
  experiment?: Record<string, string>;
}

export interface EventActor {
  kind: "human" | "agent";
  assistiveTech?: boolean;
}

/** The component an event came from: its id, its stable semantic `key` when the document gives one, and its type. */
export interface EventComponent {
  id?: string;
  key?: string;
  type?: string;
}

export type EventRating = -1 | 0 | 1;

export interface SemanticEvent {
  type: SemanticEventType;
  /** ISO 8601 */
  timestamp: string;
  sessionId: string;
  surface: EventSurface;
  actor: EventActor;
  component?: EventComponent;
  capability?: string;
  checkpoint?: string;
  /** Time since surface.shown */
  durationMs?: number;
  /** Interactions since surface.shown */
  steps?: number;
  /** A short code, never free text */
  reason?: string;
  rating?: EventRating;
}

/** The property names the schema allows, at the top level and in each nested object. */
export const EVENT_PROPERTIES = ["type", "timestamp", "sessionId", "surface", "actor", "component", "capability", "checkpoint", "durationMs", "steps", "reason", "rating"] as const;
export const EVENT_SURFACE_PROPERTIES = ["id", "intent", "pattern", "journey", "specVersion", "generator", "direction", "experiment"] as const;
export const EVENT_ACTOR_PROPERTIES = ["kind", "assistiveTech"] as const;
export const EVENT_COMPONENT_PROPERTIES = ["id", "key", "type"] as const;

/** The parts of a journey (schema/journey.schema.json) the emitter reads. */
export interface EventJourney {
  id?: string;
  checkpoints?: { key: string; event?: string }[];
  done?: { event: string };
}

export interface SurfaceEventOptions {
  /** Ties events together. Defaults to a random id made when the surface is shown. */
  sessionId?: string;
  /** Who is using the surface. Defaults to an agent when the browser says it is automated (navigator.webdriver), else a human. */
  actor?: EventActor;
  /** The journey this surface is a step of: its checkpoint events and its done event. */
  journey?: EventJourney;
  generator?: string;
  direction?: string;
  experiment?: Record<string, string>;
  /** The clock, for tests. Defaults to Date.now. */
  now?: () => number;
}

/** What a renderer tells the emitter. Every method is safe to call more than once. */
export interface SurfaceEvents {
  readonly sessionId: string;
  /** The surface is on screen: surface.shown, once. Also cancels an unmount that was only a remount. */
  shown(): void;
  /** Any action the surface dispatched, before the host hears it. */
  action(action: Action, source: string): void;
  /** An input wrote a value. Only the pointer is read, never the value. */
  edited(pointer: string): void;
  /** An input was refused: its node (or id) and a reason code. */
  inputError(node: Node | string, reason: string): void;
  /** A Status was drawn. */
  statusShown(node: Node): void;
  /** The person rated the surface. */
  feedback(rating: EventRating, reason?: string): void;
  /** The person asked for this surface again: it is being replaced. */
  regenerated(reason?: string): void;
  /**
   * The renderer took the surface down. Deferred (the default), it ends on the next microtask unless
   * shown() is called first, so a remount in the same tick (React StrictMode) is not an ending.
   * `unmounted(false)` ends it now, or settles a deferred ending before the next surface is shown.
   */
  unmounted(defer?: boolean): void;
}

/** A reason is a short code: letters, digits, dots, dashes and underscores. Anything else is dropped. */
const REASON = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const code = (reason: string | undefined): string | undefined => (typeof reason === "string" && REASON.test(reason) ? reason : undefined);

/** A browser's ValidityState, or anything shaped like it. */
export type ValidityLike = Partial<Record<"valueMissing" | "typeMismatch" | "patternMismatch" | "tooShort" | "tooLong" | "rangeUnderflow" | "rangeOverflow" | "stepMismatch" | "badInput" | "customError", boolean>>;

const VALIDITY: [keyof ValidityLike, string][] = [
  ["valueMissing", "required"],
  ["typeMismatch", "type"],
  ["patternMismatch", "pattern"],
  ["tooShort", "too-short"],
  ["tooLong", "too-long"],
  ["rangeUnderflow", "too-low"],
  ["rangeOverflow", "too-high"],
  ["stepMismatch", "step"],
  ["badInput", "bad-input"],
  ["customError", "custom"],
];

/** The reason code for a failed control: "required", "pattern", "too-short", … ; "invalid" when nothing says. */
export function validityReason(validity: ValidityLike | undefined): string {
  for (const [flag, reason] of VALIDITY) if (validity?.[flag]) return reason;
  return "invalid";
}

/** Why a file was refused, as a code: the same order of checks as refuseFile. */
export function fileRefusalReason(file: { size: number }, maxSize: number | undefined): string {
  return maxSize && file.size > maxSize ? "file-too-large" : "file-type";
}

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function defaultActor(): EventActor {
  const nav = (globalThis as { navigator?: { webdriver?: boolean } }).navigator;
  return { kind: nav?.webdriver === true ? "agent" : "human" };
}

/** A component as an event names it: its id, its stable semantic key when it has one, and its type. */
function describe(node: Node | undefined, id: string): EventComponent {
  if (!node) return { id };
  return { id: node.id, ...(typeof node.key === "string" ? { key: node.key } : {}), type: node.component };
}

/** The ids of every Action a node reaches through `action` (an Action, or an ActionBar's children). */
function actionIds(id: string | undefined, byId: Map<string, Node>): string[] {
  const node = id ? byId.get(id) : undefined;
  if (!node) return [];
  if (node.component === "ActionBar") return (node.children ?? []).flatMap((c: string) => actionIds(c, byId));
  return [node.id];
}

/**
 * Whether an action is the source's primary one: a Form's submit, a Confirm's confirm, a Steps'
 * finish. These are where a surface hands its task on.
 */
function isPrimary(source: Node | undefined, action: Action): boolean {
  if (!source) return false;
  const primary = source.component === "Form" ? source.submit : source.component === "Confirm" ? source.confirm : source.component === "Steps" ? source.finish : undefined;
  const p: Action | undefined = primary?.action;
  if (!p) return false;
  if (p === action) return true;
  const other: Action | undefined = source.cancel?.action;
  return p.event.name === action.event.name && other?.event?.name !== action.event.name;
}

/**
 * The emitter for one surface. `emit` receives each event; an exception in it is caught, so a
 * failing analytics call never breaks the surface.
 *
 * - surface.shown: the first time the surface is on screen.
 * - action.taken: every action that reaches the host (not ui.dismiss).
 * - checkpoint.reached: an action whose name is one of the journey's checkpoint events, once each.
 * - task.completed: with a journey, its done event; without one, the primary action of a Form,
 *   Confirm or Steps. Once. Shells have no task.
 * - undo: the action of an 'undo' Status (after action.taken).
 * - surface.dismissed: ui.dismiss (reason "dismiss"), except from a Panel or Confirm that is not
 *   the root, which closes only itself; or the surface taken down (reason "unmount") before it
 *   completed or handed on.
 * - task.abandoned: dismissed or taken down after at least one interaction, without completing or
 *   handing on (reaching a checkpoint or firing a primary action hands on).
 * - input.error, status.shown, feedback, surface.regenerated: when the renderer or host says so.
 */
export function createSurfaceEvents(doc: UIDocument, emit: (event: SemanticEvent) => void, options: SurfaceEventOptions = {}): SurfaceEvents {
  const now = options.now ?? Date.now;
  const sessionId = options.sessionId ?? randomId();
  const actor: EventActor = options.actor ? { kind: options.actor.kind === "agent" ? "agent" : "human", ...(typeof options.actor.assistiveTech === "boolean" ? { assistiveTech: options.actor.assistiveTech } : {}) } : defaultActor();
  const byId = indexById(doc);
  const s = doc.surface;
  const journeyId = options.journey?.id ?? s.journey;
  const surface: EventSurface = {
    id: s.id,
    intent: s.intent ?? s.id,
    ...(s.pattern ? { pattern: s.pattern } : {}),
    ...(journeyId ? { journey: journeyId } : {}),
    ...(doc.specVersion ? { specVersion: doc.specVersion } : {}),
    ...(options.generator ? { generator: options.generator } : {}),
    ...(options.direction ? { direction: options.direction } : {}),
    ...(options.experiment ? { experiment: Object.fromEntries(Object.entries(options.experiment).filter(([, v]) => typeof v === "string")) } : {}),
  };
  const shell = s.kind === "shell";
  const undoSources = new Set(doc.components.filter((c) => c.component === "Status" && c.kind === "undo").flatMap((c) => actionIds(c.action, byId)));
  const checkpoints = new Map((options.journey?.checkpoints ?? []).filter((c) => c.event).map((c) => [c.event!, c.key]));
  const doneEvent = options.journey?.done?.event;

  let started: number | undefined;
  let steps = 0;
  let lastEdited: string | undefined;
  let completed = false;
  let handedOn = false;
  let ended = false;
  let pendingEnd = false;
  const reached = new Set<string>();

  const send = (type: SemanticEventType, extra: Partial<SemanticEvent> = {}) => {
    // Every other event is about a surface that was shown, so shown comes first whatever the order of calls.
    if (type !== "surface.shown" && started === undefined) ensureShown();
    const t = now();
    const event: SemanticEvent = { type, timestamp: new Date(t).toISOString(), sessionId, surface, actor, ...extra };
    if (type === "surface.shown") started = t;
    else {
      event.durationMs = Math.max(0, Math.round(t - (started ?? t)));
      event.steps = steps;
    }
    try {
      emit(event);
    } catch {
      // The host's analytics failing is not the surface's problem.
    }
  };
  const componentOf = (id: string): EventComponent => describe(byId.get(id), id);
  const end = (reason: "dismiss" | "unmount") => {
    if (ended) return;
    ended = true;
    if (reason === "unmount" && (completed || handedOn)) return;
    send("surface.dismissed", { reason });
    if (!shell && steps > 0 && !completed && !handedOn) send("task.abandoned", { reason });
  };
  function ensureShown() {
    if (started === undefined) send("surface.shown");
  }

  return {
    sessionId,
    shown() {
      pendingEnd = false;
      ensureShown();
    },
    action(action, source) {
      if (!action?.event?.name) return;
      ensureShown();
      const name = action.event.name;
      const node = byId.get(source);
      if (name === "ui.dismiss") {
        const overlay = node && (node.component === "Panel" || node.component === "Confirm") && doc.root !== node.id;
        if (!overlay) end("dismiss");
        return;
      }
      steps++;
      lastEdited = undefined;
      const component = componentOf(source);
      send("action.taken", { component, capability: name });
      const checkpoint = checkpoints.get(name);
      if (checkpoint !== undefined && !reached.has(checkpoint)) {
        reached.add(checkpoint);
        handedOn = true;
        send("checkpoint.reached", { component, capability: name, checkpoint });
      }
      const primary = isPrimary(node, action);
      const completes = shell ? false : doneEvent !== undefined ? name === doneEvent : primary;
      if (completes && !completed) {
        completed = true;
        send("task.completed", { component, capability: name });
      } else if (primary && !shell) handedOn = true;
      if (undoSources.has(source)) send("undo", { component, capability: name });
    },
    edited(pointer) {
      if (pointer === lastEdited) return;
      lastEdited = pointer;
      steps++;
    },
    inputError(target, reason) {
      const node = typeof target === "string" ? byId.get(target) : target;
      const id = typeof target === "string" ? target : target.id;
      send("input.error", { component: describe(node, id), reason: code(reason) ?? "invalid" });
    },
    statusShown(node) {
      const kind = code(node.kind);
      send("status.shown", { component: describe(node, node.id), ...(kind ? { reason: kind } : {}) });
    },
    feedback(rating, reason) {
      if (rating !== -1 && rating !== 0 && rating !== 1) return;
      const r = code(reason);
      send("feedback", { rating, ...(r ? { reason: r } : {}) });
    },
    regenerated(reason) {
      if (ended) return;
      ended = true;
      const r = code(reason);
      send("surface.regenerated", r ? { reason: r } : {});
    },
    unmounted(defer = true) {
      if (ended) return;
      if (!defer) {
        pendingEnd = false;
        return end("unmount");
      }
      if (pendingEnd) return;
      pendingEnd = true;
      queueMicrotask(() => {
        if (pendingEnd) end("unmount");
        pendingEnd = false;
      });
    },
  };
}
