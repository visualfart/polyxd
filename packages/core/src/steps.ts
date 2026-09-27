/** The Steps state machines: a wizard's current step, and a task list's open task. */

export interface StepsState {
  index: number;
  total: number;
}

export type StepsAction = { type: "back" } | { type: "next" } | { type: "go"; index: number };

const clamp = (i: number, total: number) => Math.max(0, Math.min(total - 1, i));

/** Moves within the steps; never past either end. */
export function stepsReducer(state: StepsState, action: StepsAction): StepsState {
  const index = action.type === "back" ? state.index - 1 : action.type === "next" ? state.index + 1 : action.index;
  return { ...state, index: clamp(index, state.total) };
}

/** Where a wizard starts: the bound step when the document binds one, else the first. */
export const initialStep = (bound: unknown, total: number): StepsState => ({ index: typeof bound === "number" ? clamp(bound, total) : 0, total });

export const isLastStep = (s: StepsState): boolean => s.index === s.total - 1;

/** What the wizard says above the steps. */
export const stepsProgress = (s: StepsState): string => `Step ${s.index + 1} of ${s.total}`;

/** Task statuses (GOV.UK task list) and the tone each is shown in. */
export const TASK_STATUS: Record<string, { label: string; tone: string }> = {
  todo: { label: "Not started", tone: "neutral" },
  inProgress: { label: "In progress", tone: "info" },
  done: { label: "Completed", tone: "success" },
  blocked: { label: "Cannot start yet", tone: "neutral" },
};

export const taskStatus = (status: string | undefined): { label: string; tone: string } => TASK_STATUS[status ?? "todo"] ?? TASK_STATUS.todo;

/** A task opens in place; opening another closes it; opening it again closes it. */
export const tasklistReducer = (open: string | null, key: string): string | null => (open === key ? null : key);

export const tasklistProgress = (done: number, total: number): string => `${done} of ${total} tasks completed`;
