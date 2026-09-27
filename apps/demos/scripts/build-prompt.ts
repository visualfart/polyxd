/**
 * The generator's system prompt, built from the spec itself (components and patterns) so it can't
 * drift, and written as a module: the live-generation Worker imports it, and the documents that
 * ship with each demo were produced from the same text. Port of model/polyxd_model/prompt.py.
 * Run with `npm run build:prompt -w @polyxd/demos`.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";

const SPEC = new URL("../../../packages/spec/", import.meta.url);
const read = async (p: string) => JSON.parse(await readFile(new URL(p, SPEC), "utf8"));

const REF_NAMES: Record<string, string> = {
  DynamicString: "text|{path}",
  DynamicNumber: "number|{path}",
  DynamicBoolean: "bool|{path}",
  DynamicValue: "value|{path}",
  Binding: "{path}",
  Id: "id",
  Key: "key",
  Path: "path",
  Format: "{type:currency|number|percent|date|time|datetime|relativeTime|color|bytes,currency?}",
  Action: "{event:{name,context?}}",
  ActionSpec: "{label,action}",
  ChildList: "[ids]",
  Template: "{path,componentId}",
  Options: "[{value,label}]|{path,valuePath,labelPath}",
  Tone: "neutral|info|success|warning|danger",
  Accessibility: "{label?}",
};

function type(schema: any): string {
  if (schema.$ref) {
    const name = String(schema.$ref).split("/").pop()!;
    return REF_NAMES[name] ?? name;
  }
  if (schema.enum) return schema.enum.join("|");
  if (schema.type === "array") {
    const items = schema.items ?? {};
    if (items.type === "object") return `[{${Object.keys(items.properties ?? {}).map((k) => k + ((items.required ?? []).includes(k) ? "" : "?")).join(",")}}]`;
    return `[${type(items)}]`;
  }
  if (schema.type === "object") return `{${Object.keys(schema.properties ?? {}).map((k) => k + ((schema.required ?? []).includes(k) ? "" : "?")).join(",")}}`;
  return String(schema.type ?? "any");
}

const componentFiles = (await readdir(new URL("components/", SPEC))).filter((f) => f.endsWith(".json")).sort();
const allComponents = await Promise.all(componentFiles.map((f) => read(`components/${f}`)));
// The shell components (Frame, AppBar, Footer, Outlet, Custom) are the product's frame around its
// screens: authored once per product, never generated. They stay out of the catalog the model sees,
// and one rule says so, so a model that has seen them elsewhere doesn't reach for them.
const shellComponents = allComponents.filter((c) => c.shell === true);
const components = allComponents.filter((c) => c.shell !== true);
const shellNames = shellComponents.map((c) => c.name).join(", ").replace(/, ([^,]*)$/, " or $1");
const patternFiles = (await readdir(new URL("patterns/", SPEC))).filter((f) => f.endsWith(".json")).sort();
const patterns = await Promise.all(patternFiles.map((f) => read(`patterns/${f}`)));
const { SPEC_VERSION } = (await import("../../../packages/spec/src/version.ts")) as { SPEC_VERSION: string };

const catalog = components
  .map((c) => {
    const props = Object.entries(c.props)
      .map(([name, s]) => `${name}${c.required.includes(name) ? "*" : ""}: ${type(s)}`)
      .join(", ");
    return `- ${c.name}(${props})\n  ${c.summary} Use for: ${c.whenToUse.slice(0, 2).join("; ")}.`;
  })
  .join("\n");

const patternText = patterns.map((p) => `- ${p.id}: ${p.summary} Structure: ${p.structure.join(" → ")}`).join("\n");

const example = {
  specVersion: SPEC_VERSION,
  surface: { id: "add-task", title: "New task", intent: "tasks.create" },
  root: "form",
  components: [
    { id: "form", component: "Form", children: ["title", "due", "priority"], submit: { label: "Add task", action: { event: { name: "task.save", context: { title: { path: "/draft/title" }, due: { path: "/draft/due" }, priority: { path: "/draft/priority" } } } } } },
    { id: "title", component: "TextInput", key: "title", label: "Task", value: { path: "/draft/title" }, required: true },
    { id: "due", component: "DateInput", key: "due", label: "Due", value: { path: "/draft/due" } },
    { id: "priority", component: "Choice", key: "priority", label: "Priority", value: { path: "/draft/priority" }, options: [{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }] },
  ],
};

const prompt = `You generate just-in-time user interfaces as JSON, in the Polyxd UI document format. Output ONE JSON object and nothing else.

Document shape: {"specVersion":"${SPEC_VERSION}","surface":{"id","title","intent","pattern"?},"root":"<id>","components":[...]}.
Components are a FLAT list; each has a unique "id" and "component" (its type). Containers reference children by id STRINGS ("children": ["a","b"]); never nest component objects inside other components.

Rules:
1. Data comes from the host. Bind values with {"path":"/json/pointer"}; pointers start at the root of the DATA object (DATA {"card":{"id":"c1"}} → {"path":"/card/id"}, never "/data/card/id"). Never type numbers, prices, names or dates from the data as literal text; never invent data.
2. Inside a repeated item (Collection items template, Table columns, Chart series, Comparison attributes) use paths RELATIVE to the item, e.g. {"path":"amount"}.
3. Actions: {"event":{"name":"<capability>","context":{...}}}. Use ONLY the capabilities listed. "ui.dismiss" closes the surface.
4. Destructive capabilities must be triggered from a Confirm. Consequential ones need a Confirm or a review step first.
5. At most one primary action visible at a time (a Form's submit counts). At most 6 inputs per view; use Steps for more.
6. Labels say what happens ("Send £20", "Freeze card"), in sentence case. Give every component that represents a thing from the data a stable "key" in lower_snake_case (e.g. "card_status").
7. Collections and Tables need an "empty" Status when the list may be empty.
8. If no listed capability can do what was asked, show a Status explaining that instead of a fake interface.
9. Format numbers, money and dates with "format", never by writing them into strings.
10. There is no template engine. Text is either literal or a binding; "{{budget}}" or "\${spent}" in a string reaches the screen exactly as written.
11. Bind text to a field that holds text. A pointer at an object or a list prints as "[object Object]"; point at the string inside it.
12. Show people names, not internal ids. If a record has both "id" and "name", the screen gets "name"; the id belongs in an action's context.
13. Never use ${shellNames}: the product's shell is authored, and your surface renders inside it. Never draw navigation, a header or a footer around a surface.

Components (* = required):
${catalog}

Patterns (set surface.pattern when one applies):
${patternText}

Example:
${JSON.stringify(example)}`;

const out = new URL("../kit/prompt.generated.ts", import.meta.url);
await writeFile(out, `// Generated by scripts/build-prompt.ts from the spec (${SPEC_VERSION}). Do not edit.\nexport const SPEC_VERSION = ${JSON.stringify(SPEC_VERSION)};\nexport const SYSTEM_PROMPT = ${JSON.stringify(prompt)};\n`);
console.log(`wrote kit/prompt.generated.ts (${prompt.length} chars, ${components.length} components, ${shellComponents.length} shell components left out, ${patterns.length} patterns)`);
