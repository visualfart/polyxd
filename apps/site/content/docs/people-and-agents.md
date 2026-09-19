---
title: People and agents
description: Why accessibility is the bridge to AI agents, what the renderer guarantees, and how agent tasks are written and run.
order: 16
section: Concepts
---

# People and agents

A Polyxd interface has two kinds of users: people, some of them using assistive technology, and AI agents acting for people. Polyxd serves both through one channel, the **accessibility tree**.

## Accessibility is the bridge

A screen reader doesn't see pixels. It reads roles ("button", "radio group", "table"), accessible names ("Send £250.00"), states ("expanded", "checked") and structure (headings, regions, lists). An agent operating a UI needs the same information. If a control has a unique, meaningful name and the right role, both can find and use it. If it doesn't, both get stuck.

So Polyxd doesn't add a separate agent API. Each component definition states the role it must expose and how an agent operates it ("fill by label", "select options by label", "activate the card by its title"), and the verifier proves it by completing tasks through the accessibility tree alone.

## What the renderer guarantees

These hold for every document rendered by `@polyxd/react`, in every design system.

### Names and roles

- Every input has a visible label that is also its accessible name, never a placeholder alone. Help text is attached with `aria-describedby`.
- Choices are real radio groups, checkbox groups or segmented controls with a group label. Toggles are switches (applied immediately) or checkboxes (inside a form).
- `Confirm` is an `alertdialog` named by its title and described by its consequence.
- `Table` has a `caption` and real header cells. `Chart` is a `figure` with its written summary and a data table.
- `Metric` is a named `group`, so label, value and change are read together.
- Comparison "choose" buttons carry the option's title in their accessible name, so three buttons called "Choose" become "Choose Basic", "Choose Plus" and so on.
- Decorative media is hidden from assistive technology; other media needs `alt` (enforced by the validator).
- Visual extras such as "(required)" markers are kept out of accessible names.

### Headings

The surface title is the `h1`. Each `Section` title is a real heading, one level deeper per nesting level. The model never picks a heading level.

### Live regions

`Status` is a live region: `role="status"` (polite) for info, success, warning, empty and loading, and `role="alert"` (assertive) for errors. Meaning is carried in text, not only colour or icon. `RangeInput` announces its current value politely as it changes.

### Target sizes

Interactive controls use the pack's `size.target.min` token as their minimum height. The contract requires that token to be at least 24px (WCAG 2.2 2.5.8). The packs set 48px (Material 3, Carbon) and 32px (Ant Design). The verifier measures every rendered target against both the WCAG minimum and the pack's own value.

### Contrast

Every pack must pass 34 contrast pairs in every mode (4.5:1 for text, 3:1 for non-text), checked by `check-design-system`. The verifier also runs axe-core's contrast rules on each rendered surface. See [Design systems](/docs/design-systems).

### Recoverable state

`Steps` exposes "Step N of M" and `aria-current` on the current step. Back never loses entered data. `Disclosure` exposes expanded or collapsed state. `Views` are real tabs.

## Agent tasks

The verifier's agent is scripted. It is given a task written the way a person would describe it, **by visible names only**, and it resolves every step through Playwright's role and accessible-name queries. It never uses CSS selectors. If a step matches no element, or more than one, the task fails. A task passes only if the host receives the expected capability event with the expected context.

Tasks live in `bench/tasks.json`:

```json
{
  "id": "find-slot",
  "document": "calendar-find-slot",
  "instruction": "Invite Tom to the 13:00 slot on Monday.",
  "steps": [
    { "choose": "13:00–13:30", "in": "Times everyone is free" },
    { "check": "Tom" },
    { "press": "Send invite" }
  ],
  "expect": {
    "event": "meeting.invite",
    "context": { "slot": "13:00", "people": ["c1", "c2"] }
  }
}
```

### Step types

| Step | What the agent does |
|---|---|
| `{ "fill": name, "value": v }` | Fills the textbox, searchbox or spinbutton with that exact accessible name |
| `{ "choose": name, "in": group }` | Clicks the radio with that name, optionally inside the named radio group or group |
| `{ "check": name }` | Clicks the checkbox with that name |
| `{ "toggle": name }` | Clicks the switch (or checkbox) with that name |
| `{ "press": name }` | Clicks the button with that name |
| `{ "tab": name }` | Selects the tab with that name |
| `{ "setDate": label, "value": iso }` | Fills the date field with that label |

`expect.context` is matched as a subset: every expected key must be present with that value.

The `document` field names the example file the task runs against. `polyxd-verify` runs each task in a fresh render, in every design system, mode and width. Today there are 18 tasks covering 18 of the 20 examples, which makes 216 runs across the default 12-target matrix. All of them pass.

Agent tasks that use a small local LLM instead of a script are part of the Phase 3 plan but are not built yet.

## What agents should do with risky actions

The `confirm-destructive` pattern tells agents to read the title and consequence, and, when acting for a user, to show that consequence to the user before confirming. Capabilities can set `agentMayInvoke: false` to say an agent may not trigger them without a human confirming. The field is in the schema today; runtime enforcement is planned. See [Capabilities](/docs/product#capabilities).
