/** One fetch wrapper: JSON in, JSON out, errors as messages a person can read. */
export class ApiError extends Error {
  status: number;
  /** The whole answer, for errors that carry more than a message (a Direction's schema issues). */
  data: Record<string, unknown>;
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin" };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const r = await fetch(path, init);
  const text = await r.text();
  const data = text ? JSON.parse(text) : {};
  // A plan's limit, wherever it was hit: the shell shows the upgrade dialog (App.tsx), and the caller still gets the error.
  if (r.status === 402) window.dispatchEvent(new CustomEvent<PlanLimitError>(PLAN_LIMIT_EVENT, { detail: { error: data.error ?? "Your plan's limit", ...data } }));
  if (!r.ok) throw new ApiError(r.status, data.error ?? `${r.status} ${r.statusText}`, data);
  return data as T;
}

export const PLAN_LIMIT_EVENT = "studio:plan-limit";
/** The Worker's 402: what ran out, on which plan (src/worker/plans.ts). */
export interface PlanLimitError {
  error: string;
  code?: "plan_limit" | "over_quota";
  limit?: string;
  plan?: string;
  current?: number;
  max?: number | null;
}

export interface Me {
  user: { id: string; email: string; name: string } | null;
  workspaces: { id: string; slug: string; name: string; role: string; plan?: string }[];
  signIn?: { google: boolean; emailVerification: boolean };
  /** Present only when the Worker has a PostHog key: the project's public key and PostHog's app for its region. */
  analytics?: { key: string; ui: string };
  /** Whether this Studio has plans (the hosted one). A self-hosted Studio has no limits and no Billing page. */
  billing?: boolean;
}

type Limit = number | null;
export interface Billing {
  enabled: true;
  plan: "free" | "pro" | "team" | "enterprise";
  status: string | null;
  interval: "month" | "year" | null;
  seats: number | null;
  periodEnd: string | null;
  subscribed: boolean;
  customer: boolean;
  limits: { workspaces: Limit; editors: Limit; designSystems: Limit; directions: Limit; publishedScreens: Limit; fetches: Limit; history: Limit; privateMcp: boolean; approvals: boolean; sharedLibraries: boolean };
  usage: { editors: number; pendingEditors: number; viewers: number; designSystems: number; directions: number; publishedScreens: number; fetches: number };
  period: string;
  fetchesPercent: number | null;
  overQuotaSince: string | null;
  lockedFrom: string | null;
  locked: boolean;
  prices: { pro: { month: number; year: number }; team: { month: number; year: number } };
  founding: boolean;
  checkout: boolean;
  canManage: boolean;
}

export interface Scan {
  format: string;
  total: number;
  byTier: { primitive: number; semantic: number; component: number };
  byType: { type: string; label: string; total: number; primitive: number; semantic: number; component: number }[];
  sets: string[];
  modes: { name: string; sets: string[] }[];
  issues: { kind: string; count: number; examples: string[] }[];
  picked?: string[];
}

export interface RoleRow {
  role: string;
  type: string;
  description: string;
  token: string | null;
  chain: string[];
  values: Record<string, string | null>;
  raw: Record<string, unknown>;
  how: string;
  why: string;
  status: "exact" | "guessed" | "missing" | "fails" | "primitive" | "off";
  contrast: { against: string; mode: string; ratio: number; min: number; passes: boolean }[];
}

export interface ScreenRow {
  id: string;
  key: string;
  name: string;
  intent: string;
  /** From the latest version's document: a shell is the product's frame, a surface a screen in it. */
  kind: "surface" | "shell";
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
  versions: number;
  published: number | null;
  errors: number;
  warnings: number;
}

export interface ScreenVersionRow {
  id: string;
  number: number;
  status: "draft" | "published";
  notes: string;
  created_at: string;
  author: string;
  errors: number;
  warnings: number;
}

export interface Candidate {
  token: string;
  chain: string[];
  value: string | null;
  tier: string;
  contrast: RoleRow["contrast"];
}

export interface TemplateSummary {
  name: string;
  displayName: string;
  character: string;
  modes: string[];
  tokens: number;
  swatches: { role: string; value: string }[];
  radius: string;
  font: string;
  extras: boolean;
}

export interface DirectionRow {
  id: string;
  key: string;
  name: string;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
  versions: number;
  published: number | null;
  /** The latest version's `version` field, e.g. 1.2.0 */
  version: string | null;
}

export interface DirectionVersionRow {
  id: string;
  number: number;
  status: "draft" | "published";
  notes: string;
  created_at: string;
  author: string;
  version: string;
}
