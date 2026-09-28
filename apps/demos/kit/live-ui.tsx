import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActionEvent } from "@polyxd/react";
import { allowAction, createLiveClient, routeAsk, type LiveEvent, type LiveOutcome, type LiveSpec } from "./live.ts";
import type { IntentFile } from "./types.ts";

/**
 * Live generation in a product: the library answers first; when it has nothing and the site has a
 * model, the product shows a streaming state and then the screen, marked "generated just now".
 * With no model configured the probe says no, and every miss is the same honest "not yet" as before.
 */

export interface LivePending {
  ask: string;
  attempt: number;
  chars: number;
  checking: boolean;
  remembered: boolean;
}

/** A generated screen, ready for the product's surface. */
export interface LiveScreen {
  intent: IntentFile;
  capabilities: string[];
}

export interface LiveHandlers<M> {
  library: (match: M) => void;
  live: (screen: LiveScreen) => void;
  miss: (reason: string) => void;
  /** Called once a live generation starts, so the ask box can close and the pending state show. */
  started?: () => void;
}

function step(p: LivePending, e: LiveEvent): LivePending {
  switch (e.type) {
    case "started":
      return { ...p, remembered: e.remembered };
    case "progress":
      return { ...p, attempt: e.attempt, chars: e.chars, checking: false };
    case "attempt":
      return { ...p, attempt: e.attempt, checking: true };
    default:
      return p;
  }
}

/** What the pending state says, in the product's plain words. */
export function pendingStatus(p: LivePending): string {
  if (p.checking) return p.attempt > 1 ? "Checking the fixes against the spec…" : "Checking it against the spec…";
  if (p.attempt > 1) return "Fixing what the checks found…";
  if (p.chars > 0) return `Writing this screen… ${p.chars.toLocaleString("en-GB")} characters so far${p.remembered ? ", keeping it like last time" : ""}`;
  return p.remembered ? "Writing this screen, keeping it like last time…" : "Writing this screen…";
}

export function useLive(spec: LiveSpec) {
  const client = useMemo(() => createLiveClient({ spec }), [spec]);
  const [pending, setPending] = useState<LivePending | null>(null);
  const [available, setAvailable] = useState(false);
  const running = useRef<AbortController | null>(null);
  // Ask once whether the endpoint has a model, so the first miss doesn't wait on it.
  useEffect(() => {
    let on = true;
    client.available().then((yes) => on && setAvailable(yes));
    return () => void (on = false);
  }, [client]);
  useEffect(() => () => running.current?.abort(), []);

  const route = useCallback(
    async <M,>(text: string, match: (text: string) => M | null, on: LiveHandlers<M>) => {
      const where = await routeAsk(text, match, client);
      if (where.kind === "library") return on.library(where.match);
      if (where.kind === "miss") return on.miss("off");
      running.current?.abort();
      const controller = new AbortController();
      running.current = controller;
      setPending({ ask: text, attempt: 1, chars: 0, checking: false, remembered: false });
      on.started?.();
      const out: LiveOutcome = await client.generate(text, { signal: controller.signal, onEvent: (e) => !controller.signal.aborted && setPending((p) => p && step(p, e)) });
      if (controller.signal.aborted) return;
      running.current = null;
      setPending(null);
      if (out.kind === "live") on.live({ intent: out.intent, capabilities: out.capabilities });
      else on.miss(out.reason);
    },
    [client],
  );

  /** Stop waiting (the sheet was closed). The stream is dropped and nothing is shown. */
  const cancel = useCallback(() => {
    running.current?.abort();
    running.current = null;
    setPending(null);
  }, []);

  return { available, pending, route, cancel };
}

/**
 * The product's own action handler, for a generated screen: an action it wasn't offered is refused
 * with a sentence, everything else goes exactly where a library screen's action goes.
 */
export function guardLiveActions(offered: readonly string[], run: (e: ActionEvent) => void, refuse: (e: ActionEvent) => void) {
  return (e: ActionEvent) => (allowAction(e, offered) ? run(e) : refuse(e));
}
