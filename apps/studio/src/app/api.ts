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
  if (!r.ok) throw new ApiError(r.status, data.error ?? `${r.status} ${r.statusText}`, data);
  return data as T;
}

export interface Me {
  user: { id: string; email: string; name: string } | null;
  workspaces: { id: string; slug: string; name: string; role: string }[];
  signIn?: { google: boolean; emailVerification: boolean };
  /** Present only when the Worker has a PostHog key: the project's public key and PostHog's app for its region. */
  analytics?: { key: string; ui: string };
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
