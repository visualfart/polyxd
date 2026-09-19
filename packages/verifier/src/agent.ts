import type { Locator, Page } from "playwright";
import { sentActions } from "./browser.ts";

/**
 * A task step, written the way a user or agent would describe it: by visible names only.
 * The agent resolves every step through the accessibility tree (roles + accessible names),
 * never CSS selectors, so a task that passes is operable by assistive technology and AI agents.
 */
export type Step =
  | { fill: string; value: string }
  | { choose: string; in?: string }
  | { check: string }
  | { toggle: string }
  | { press: string }
  | { tab: string }
  | { setDate: string; value: string };

export interface Task {
  id: string;
  /** Example document file name (in @polyxd/spec examples) */
  document: string;
  journey?: string;
  instruction: string;
  steps: Step[];
  expect: { event: string; context?: Record<string, unknown> };
}

export interface AgentResult {
  success: boolean;
  steps: number;
  error?: string;
  sent: { name: string; context: Record<string, unknown> }[];
}

const exact = (name: string) => ({ name, exact: true });

async function one(locator: Locator, what: string): Promise<Locator> {
  const n = await locator.count();
  if (n === 0) throw new Error(`no ${what}`);
  if (n > 1) throw new Error(`${n} elements match ${what}; names must be unique for agents`);
  return locator;
}

async function runStep(root: Locator, step: Step) {
  if ("fill" in step) {
    // By role and computed accessible name, as assistive technology and agents see it.
    const field = await one(
      root.getByRole("textbox", exact(step.fill)).or(root.getByRole("searchbox", exact(step.fill))).or(root.getByRole("spinbutton", exact(step.fill))),
      `field named "${step.fill}"`,
    );
    await field.fill(step.value);
  } else if ("choose" in step) {
    const scope = step.in ? await one(root.getByRole("radiogroup", exact(step.in)).or(root.getByRole("group", exact(step.in))), `group "${step.in}"`) : root;
    const option = await one(scope.getByRole("radio", exact(step.choose)), `option "${step.choose}"`);
    await option.click();
  } else if ("check" in step) {
    const box = await one(root.getByRole("checkbox", exact(step.check)), `checkbox "${step.check}"`);
    await box.click();
  } else if ("toggle" in step) {
    const control = await one(root.getByRole("switch", exact(step.toggle)).or(root.getByRole("checkbox", exact(step.toggle))), `toggle "${step.toggle}"`);
    await control.click();
  } else if ("press" in step) {
    const button = await one(root.getByRole("button", exact(step.press)), `button "${step.press}"`);
    await button.click();
  } else if ("tab" in step) {
    const tab = await one(root.getByRole("tab", exact(step.tab)), `tab "${step.tab}"`);
    await tab.click();
  } else if ("setDate" in step) {
    const field = await one(root.getByLabel(step.setDate, { exact: true }), `date field "${step.setDate}"`);
    await field.fill(step.value);
  }
}

const matches = (actual: unknown, expected: unknown): boolean =>
  expected !== null && typeof expected === "object" && !Array.isArray(expected)
    ? actual !== null && typeof actual === "object" && Object.entries(expected).every(([k, v]) => matches((actual as any)[k], v))
    : JSON.stringify(actual) === JSON.stringify(expected);

/** Opens any collapsed Disclosure, so hidden detail doesn't look like a missing control. */
async function openDetail(root: Locator): Promise<boolean> {
  const closed = root.locator('.pxd-disclosure-trigger[aria-expanded="false"]');
  const n = await closed.count();
  for (let i = 0; i < n; i++) await closed.nth(0).click();
  return n > 0;
}

/** Runs a task on a rendered surface and checks the host received the expected capability event. */
export async function runTask(page: Page, task: Task): Promise<AgentResult> {
  const root = page.locator(".pxd-surface");
  let done = 0;
  try {
    for (const step of task.steps) {
      try {
        await runStep(root, step);
      } catch (e) {
        // Detail behind progressive disclosure is hidden, not unavailable: open it and try again,
        // which is what a capable agent (or a person) does.
        if (!/^no /.test((e as Error).message) || !(await openDetail(root))) throw e;
        await runStep(root, step);
      }
      done++;
    }
  } catch (e) {
    return { success: false, steps: done, error: `step ${done + 1} (${JSON.stringify(task.steps[done])}): ${(e as Error).message.split("\n")[0]}`, sent: await sentActions(page) };
  }
  const sent = await sentActions(page);
  const hit = sent.find((a) => a.name === task.expect.event && matches(a.context, task.expect.context ?? {}));
  return hit
    ? { success: true, steps: done, sent }
    : { success: false, steps: done, error: `expected ${task.expect.event} ${JSON.stringify(task.expect.context ?? {})}, host received ${JSON.stringify(sent)}`, sent };
}
