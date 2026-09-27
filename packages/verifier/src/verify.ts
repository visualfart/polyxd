import type { Browser } from "playwright";
import { launch, renderPage, type RendererHarness, type RenderTarget } from "./browser.ts";
import { renderedFingerprint, type Fingerprint } from "./fingerprint.ts";
import { axeAudit, layoutAudit, type Finding } from "./rendered.ts";
import { runTask, type AgentResult, type Task } from "./agent.ts";
import { staticAudit, type StaticOptions } from "./static.ts";

export interface VerifyOptions extends StaticOptions {
  themes?: string[];
  modes?: ("light" | "dark")[];
  widths?: number[];
  /** Agent tasks to run on this document, in every target */
  tasks?: Task[];
  /** Reuse a browser across many documents */
  browser?: Browser;
  /** The page that renders the document (see harness/README.md); the built-in React harness by default */
  harness?: RendererHarness;
  /** Record each target's rendered fingerprint (components, ARIA tree, text), for comparing renderers */
  fingerprint?: boolean;
}

export interface TargetReport extends RenderTarget {
  findings: Finding[];
  agent: (AgentResult & { task: string })[];
  fingerprint?: Fingerprint;
}

export interface Report {
  surface: string;
  static: Finding[];
  targets: TargetReport[];
  errors: number;
  warnings: number;
  agentSuccess: number;
  agentRuns: number;
  /** 0–100. 100 = no errors, warnings or failed tasks anywhere. */
  score: number;
}

export const DEFAULTS = { themes: ["material3", "carbon", "antd"], modes: ["light", "dark"] as ("light" | "dark")[], widths: [390, 1100] };

/**
 * Scoring (v0): start at 100; each distinct error check costs 20 (once per check, not per target,
 * so one broken thing isn't counted six times), each distinct warning 4, and failed agent runs
 * cost up to 40 in proportion. Floors at 0.
 */
export function score(r: Omit<Report, "score">): number {
  const all = [...r.static, ...r.targets.flatMap((t) => t.findings)];
  const distinct = (sev: string) => new Set(all.filter((f) => f.severity === sev).map((f) => f.check)).size;
  const agentPenalty = r.agentRuns ? 40 * (1 - r.agentSuccess / r.agentRuns) : 0;
  return Math.max(0, Math.round(100 - 20 * distinct("error") - 4 * distinct("warning") - agentPenalty));
}

export async function verifyDocument(doc: any, opts: VerifyOptions = {}): Promise<Report> {
  const staticFindings = staticAudit(doc, opts);
  const targets: TargetReport[] = [];
  const invalid = staticFindings.some((f) => f.check === "spec" && f.severity === "error");
  if (!invalid) {
    const browser = opts.browser ?? (await launch());
    try {
      for (const theme of opts.themes ?? DEFAULTS.themes) {
        for (const mode of opts.modes ?? DEFAULTS.modes) {
          for (const width of opts.widths ?? DEFAULTS.widths) {
            const target = { theme, mode, width };
            let page: Awaited<ReturnType<typeof renderPage>>["page"];
            let errors: string[];
            try {
              ({ page, errors } = await renderPage(browser, doc, target, opts.harness));
            } catch (e) {
              // Timed out or crashed before the surface was ready: that is the renderer's problem
              // with this document, and the run carries on.
              targets.push({ ...target, findings: [{ severity: "error", check: "runtime:render", message: `did not finish rendering: ${(e as Error).message.split("\n")[0]}` }], agent: [] });
              continue;
            }
            const rendered = await page.evaluate(() => !!document.querySelector(".pxd-surface"));
            if (!rendered) {
              // The renderer threw: a schema-valid document it can't display is a renderer bug.
              targets.push({ ...target, findings: [{ severity: "error", check: "runtime:render", message: errors[0] ?? "surface did not render" }], agent: [] });
              await page.close();
              continue;
            }
            const findings: Finding[] = [...(await axeAudit(page)), ...(await layoutAudit(page))];
            const fingerprint = opts.fingerprint ? await renderedFingerprint(page) : undefined;
            const agent: TargetReport["agent"] = [];
            for (const task of opts.tasks ?? []) {
              // Each task gets a fresh render so earlier tasks can't leave state behind.
              const fresh = agent.length === 0 ? page : (await renderPage(browser, doc, target, opts.harness)).page;
              agent.push({ task: task.id, ...(await runTask(fresh, task)) });
              if (fresh !== page) await fresh.close();
            }
            for (const e of errors) findings.push({ severity: "error", check: "runtime", message: e });
            targets.push({ ...target, findings, agent, ...(fingerprint ? { fingerprint } : {}) });
            await page.close();
          }
        }
      }
    } finally {
      if (!opts.browser) await browser.close();
    }
  }
  const all = [...staticFindings, ...targets.flatMap((t) => t.findings)];
  const runs = targets.flatMap((t) => t.agent);
  const base = {
    surface: doc?.surface?.id ?? "(invalid)",
    static: staticFindings,
    targets,
    errors: all.filter((f) => f.severity === "error").length,
    warnings: all.filter((f) => f.severity === "warning").length,
    agentSuccess: runs.filter((r) => r.success).length,
    agentRuns: runs.length,
  };
  return { ...base, score: invalid ? 0 : score(base) };
}
