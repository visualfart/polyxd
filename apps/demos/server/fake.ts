import type { Generator, GenerateRequest, UIDocument } from "@polyxd/runtime";

/**
 * A canned generator for local development and tests: no network, no key. It streams one fixed
 * document per product, bound to that product's live data, as a model would. The endpoint only
 * uses it when `POLYXD_DEMOS_FAKE=1` and the request is to a local host, so it can't answer on
 * polyxd.com whatever the environment says.
 */

const money = (currency: string) => ({ type: "currency", currency });

const CANNED: Record<string, (intent: string) => UIDocument> = {
  halden: (intent) => ({
    specVersion: "0.3.0",
    surface: { id: "live-where-it-goes", title: "Where your money goes", intent },
    root: "page",
    components: [
      { id: "page", component: "Group", children: ["figures", "summary", "table"] },
      { id: "figures", component: "Group", arrangement: "inline", children: ["balance", "spent"] },
      { id: "balance", component: "Metric", key: "balance", label: "Balance", value: { path: "/balance/amount" }, format: money("GBP") },
      { id: "spent", component: "Metric", key: "spent", label: "Spent this month", value: { path: "/compare/thisMonth" }, format: money("GBP") },
      { id: "summary", component: "Text", key: "summary", variant: "supporting", text: { path: "/compare/summary" } },
      {
        id: "table",
        component: "Table",
        key: "top",
        rows: { path: "/compare/top" },
        caption: "Biggest categories",
        columns: [
          { key: "name", label: "Category", path: "name" },
          { key: "this", label: "This month", path: "thisMonth", kind: "currency", format: money("GBP") },
          { key: "last", label: "Last month", path: "lastMonth", kind: "currency", format: money("GBP") },
        ],
        rowAction: { event: { name: "spend.category", context: { category: { path: "category" } } } },
      },
    ],
  }) as UIDocument,
  foundry: (intent) => ({
    specVersion: "0.3.0",
    surface: { id: "live-renewals-at-risk", title: "Renewals with open tickets", intent },
    root: "page",
    components: [
      { id: "page", component: "Group", children: ["count", "caption", "table"] },
      { id: "count", component: "Metric", key: "count", label: "Accounts", value: { path: "/results/count" }, format: { type: "number" } },
      { id: "caption", component: "Text", key: "caption", variant: "supporting", text: { path: "/results/caption" } },
      {
        id: "table",
        component: "Table",
        key: "accounts",
        rows: { path: "/results/rows" },
        caption: "Accounts",
        columns: [
          { key: "name", label: "Account", path: "name", kind: "entity", secondaryPath: "planLine" },
          { key: "renews", label: "Renews in", path: "daysToRenewal", kind: "number", format: { type: "number" } },
          { key: "health", label: "Health", path: "health", kind: "status", tones: { Healthy: "success", Watch: "warning", "At risk": "danger" } },
          { key: "tickets", label: "Open tickets", path: "openTickets", kind: "number", format: { type: "number" } },
        ],
        rowAction: { event: { name: "account.open", context: { id: { path: "id" } } } },
      },
    ],
  }) as UIDocument,
  wexley: (intent) => ({
    specVersion: "0.3.0",
    surface: { id: "live-repair-visit", title: "Your repair visit", intent },
    root: "page",
    components: [
      { id: "page", component: "Group", children: ["headline", "details", "change"] },
      { id: "headline", component: "Text", key: "headline", text: { path: "/repair/headline" } },
      {
        id: "details",
        component: "DetailList",
        key: "repair_details",
        items: [
          { key: "reference", label: "Reference", value: { path: "/repair/reference" } },
          { key: "problem", label: "Problem", value: { path: "/repair/problem" } },
          { key: "status", label: "Status", value: { path: "/repair/stageLabel" } },
          { key: "visit", label: "Visit", value: { path: "/repair/appointment/line" } },
        ],
      },
      { id: "change", component: "Action", key: "change", label: "Change the visit", emphasis: "secondary", action: { event: { name: "appointment.change", context: { repairId: { path: "/repair/id" } } } } },
    ],
  }) as UIDocument,
  quay: (intent) => ({
    specVersion: "0.3.0",
    surface: { id: "live-late-orders", title: "Orders past their ship date", intent },
    root: "page",
    components: [
      { id: "page", component: "Group", children: ["count", "intro", "table"] },
      { id: "count", component: "Metric", key: "count", label: "Late orders", value: { path: "/late/count" }, format: { type: "number" } },
      { id: "intro", component: "Text", key: "intro", variant: "supporting", text: { path: "/late/intro" } },
      {
        id: "table",
        component: "Table",
        key: "orders",
        rows: { path: "/late/rows" },
        caption: "Late orders",
        columns: [
          { key: "number", label: "Order", path: "number", kind: "entity", secondaryPath: "customer" },
          { key: "promised", label: "Promised", path: "promised", kind: "date", format: { type: "date" } },
          { key: "total", label: "Total", path: "total", kind: "currency", format: money("USD") },
        ],
        rowAction: { event: { name: "order.open", context: { id: { path: "id" } } } },
      },
    ],
  }) as UIDocument,
};

/** The canned document for a product, for the intent the prompt names. */
export function cannedDocument(product: string, intent = "live.ask"): UIDocument {
  const make = CANNED[product];
  if (!make) throw new Error(`No canned document for ${product}`);
  return make(intent);
}

export interface FakeOptions {
  /** Milliseconds between streamed pieces, so the streaming state can be seen. Default 0. */
  delayMs?: number;
  /** "ok" streams the canned document; "broken" always answers with one that fails its checks; "fixable" fails once, then passes. */
  behaviour?: "ok" | "broken" | "fixable";
  /** Sees every request, for tests. */
  onRequest?: (request: GenerateRequest) => void;
}

/** A broken answer binds to data the product doesn't have and asks for a capability it wasn't offered. */
function broken(doc: UIDocument): unknown {
  const components = (doc.components as unknown as Record<string, unknown>[]).map((c) => (c.id === "page" ? { ...c, children: [...(c.children as string[]), "extra", "ghost"] } : c));
  components.push({ id: "extra", component: "Action", key: "extra", label: "Do something", action: { event: { name: "made.up" } } });
  components.push({ id: "ghost", component: "Text", key: "ghost", text: { path: "/nothing/here" } });
  return { ...doc, components };
}

const intentOf = (request: GenerateRequest) => /^Intent: (\S+)$/m.exec(request.messages[0]?.content ?? "")?.[1];

export function fakeGenerator(product: string, { delayMs = 0, behaviour = "ok", onRequest }: FakeOptions = {}): Generator {
  let calls = 0;
  return {
    name: "fake",
    async generate(request) {
      onRequest?.(request);
      calls++;
      const doc = cannedDocument(product, intentOf(request));
      const fail = behaviour === "broken" || (behaviour === "fixable" && calls === 1);
      const answer = fail ? broken(doc) : doc;
      const text = JSON.stringify(answer, null, 1);
      const pieces = Math.max(1, Math.min(40, Math.ceil(text.length / 80)));
      const size = Math.ceil(text.length / pieces);
      for (let at = 0; at < text.length; at += size) {
        if (request.signal?.aborted) throw request.signal.reason ?? new DOMException("Aborted", "AbortError");
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        request.onText?.(text.slice(at, at + size));
      }
      return { text, usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}
