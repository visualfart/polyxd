/**
 * Broken documents the tests build from the examples: each is an example file, a change that
 * breaks it, and what should then be reported. validate.test.ts and patterns.test.ts check the
 * reports; precompiled.test.ts checks the precompiled schema validator agrees with Ajv on them.
 */
const byId = (d: any, id: string) => d.components.find((c: any) => c.id === id);

/** [name, example file, the change, the issue text expected from validateDocument] */
export const DOCUMENT_MUTATIONS: [string, string, (d: any) => void, RegExp][] = [
  ["unknown component type", "tasks-add.json", (d) => (byId(d, "notes").component = "Textarea"), /unknown or missing component type|unknown component/],
  ["unknown property", "tasks-add.json", (d) => (byId(d, "title").color = "#ff0000"), /unknown property "color"/],
  ["missing required label", "tasks-add.json", (d) => delete byId(d, "title").label, /label/],
  ["dangling child reference", "tasks-add.json", (d) => byId(d, "form").children.push("ghost"), /unknown component "ghost"/],
  ["duplicate id", "tasks-add.json", (d) => d.components.push({ ...byId(d, "title") }), /duplicate id "title"/],
  ["root missing", "tasks-add.json", (d) => (d.root = "nope"), /root "nope"/],
  ["two primary actions at once", "tasks-list.json", (d) => (byId(d, "plan").emphasis = "primary"), /more than one primary action/],
  ["primary action next to a form submit", "tasks-add.json", (d) => {
    d.components.push({ id: "extra", component: "Action", label: "Save draft", emphasis: "primary", action: { event: { name: "task.draft" } } });
    byId(d, "form").children.push("extra");
  }, /more than one primary action/],
  ["relative path outside a repeated item", "tasks-add.json", (d) => (byId(d, "title").value = { path: "draft/title" }), /relative path "draft\/title" used outside a repeated item/],
  ["wrong reference type", "error-load-failed.json", (d) => {
    d.components.push({ id: "txt", component: "Text", text: "hi" });
    byId(d, "root").action = "txt";
  }, /Status\.action must reference Action or ActionBar, not Text/],
  ["non-action in ActionBar", "personal-reading-log.json", (d) => {
    d.components.push({ id: "t", component: "Text", text: "x" });
    byId(d, "bar").children.push("t");
  }, /ActionBar\.children must reference Action/],
  ["cycle", "tasks-list.json", (d) => (byId(d, "list").empty = "root"), /already has parent|cycle|Collection\.empty must reference Status/],
  ["pure cycle back to root", "personal-reading-log.json", (d) => byId(d, "bar").children.push("root"), /cycle|ActionBar\.children must reference Action/],
  ["component used in two places", "travel-booking-review.json", (d) => byId(d, "form").children.push("guest-details"), /already has parent "guest"/],
  ["unknown renderer action", "settings-delete-account.json", (d) => (byId(d, "confirm").cancel.action.event.name = "ui.close"), /"ui\.close" is not a renderer action/],
  ["invalid capability name", "tasks-add.json", (d) => (byId(d, "form").submit.action.event.name = "Save Task"), /pattern/],
  ["hard-coded metric value (data must be bound)", "money-budget-settings.json", (d) => (byId(d, "used").value = 212.5), /must be object|must have required property 'path'/],
  ["image without alt text", "shop-order-status.json", (d) => delete byId(d, "item-img").alt, /Media needs alt text/],
  ["URL instead of host-provided image", "shop-order-status.json", (d) => (byId(d, "item-img").src = "https://example.com/x.png"), /must be object/],
];

/** [name, example file, the change, the pattern check expected to fail] */
export const PATTERN_MUTATIONS: [string, string, (d: any) => void, string][] = [
  ["generic confirm label", "money-send-confirm.json", (d) => (byId(d, "confirm").confirm.label = "OK"), "specific-confirm-label"],
  ["no consequence", "money-send-confirm.json", (d) => delete byId(d, "confirm").consequence, "states-consequence"],
  ["destructive without typed confirmation", "tasks-delete-project.json", (d) => delete byId(d, "confirm").typeToConfirm, "typed-for-destructive"],
  ["too many inputs in one view", "money-send-form.json", (d) => {
    for (let i = 0; i < 4; i++) d.components.push({ id: `x${i}`, component: "TextInput", label: `Extra ${i}`, value: { path: `/draft/x${i}` } });
    byId(d, "form").children.push("x0", "x1", "x2", "x3");
  }, "short-views"],
  ["results before filters", "shop-browse-filter.json", (d) => (byId(d, "root").children = ["results", "filters"]), "filters-first"],
  ["no empty state", "shop-browse-filter.json", (d) => delete byId(d, "results").empty, "empty-state"],
  ["comparison without choose", "shop-compare-plans.json", (d) => delete byId(d, "root").choose, "can-choose"],
  ["'Submit' on a review", "travel-booking-review.json", (d) => (byId(d, "form").submit.label = "Submit"), "commitment-label"],
];
