"""Builds the generator's prompt from the spec itself (components, patterns), so it can't drift."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SPEC = REPO / "packages" / "spec"
BENCH = REPO / "bench"

REF_NAMES = {
    "DynamicString": "text|{path}",
    "DynamicNumber": "number|{path}",
    "DynamicBoolean": "bool|{path}",
    "DynamicValue": "value|{path}",
    "Binding": "{path}",
    "Id": "id",
    "Key": "key",
    "Path": "path",
    "Format": "{type:currency|number|percent|date|time|datetime|relativeTime,currency?}",
    "Action": "{event:{name,context?}}",
    "ActionSpec": "{label,action}",
    "ChildList": "[ids]",
    "Template": "{path,componentId}",
    "Options": "[{value,label}]|{path,valuePath,labelPath}",
    "Tone": "neutral|info|success|warning|danger",
    "Accessibility": "{label?}",
}


def _type(schema: dict) -> str:
    if "$ref" in schema:
        name = schema["$ref"].split("/")[-1]
        return REF_NAMES.get(name, name)
    if "enum" in schema:
        return "|".join(str(v) for v in schema["enum"])
    if schema.get("type") == "array":
        items = schema.get("items", {})
        if items.get("type") == "object":
            fields = ",".join(k + ("" if k in items.get("required", []) else "?") for k in items.get("properties", {}))
            return f"[{{{fields}}}]"
        return f"[{_type(items)}]"
    if schema.get("type") == "object":
        fields = ",".join(k + ("" if k in schema.get("required", []) else "?") for k in schema.get("properties", {}))
        return f"{{{fields}}}"
    return str(schema.get("type", "any"))


@cache
def components() -> list[dict]:
    files = sorted((SPEC / "components").glob("*.json"))
    return [json.loads(f.read_text()) for f in files]


@cache
def catalog_text() -> str:
    lines = []
    for c in components():
        props = ", ".join(f"{name}{'*' if name in c['required'] else ''}: {_type(s)}" for name, s in c["props"].items())
        lines.append(f"- {c['name']}({props})\n  {c['summary']} Use for: {'; '.join(c['whenToUse'][:2])}.")
    return "\n".join(lines)


@cache
def patterns_text() -> str:
    out = []
    for f in sorted((SPEC / "patterns").glob("*.json")):
        p = json.loads(f.read_text())
        out.append(f"- {p['id']}: {p['summary']} Structure: {' → '.join(p['structure'])}")
    return "\n".join(out)


EXAMPLE = {
    "specVersion": "0.1.0",
    "surface": {"id": "add-task", "title": "New task", "intent": "tasks.create"},
    "root": "form",
    "components": [
        {"id": "form", "component": "Form", "children": ["title", "due", "priority"],
         "submit": {"label": "Add task", "action": {"event": {"name": "task.save", "context": {"title": {"path": "/draft/title"}, "due": {"path": "/draft/due"}, "priority": {"path": "/draft/priority"}}}}}},
        {"id": "title", "component": "TextInput", "key": "title", "label": "Task", "value": {"path": "/draft/title"}, "required": True},
        {"id": "due", "component": "DateInput", "key": "due", "label": "Due", "value": {"path": "/draft/due"}},
        {"id": "priority", "component": "Choice", "key": "priority", "label": "Priority", "value": {"path": "/draft/priority"},
         "options": [{"value": "low", "label": "Low"}, {"value": "normal", "label": "Normal"}, {"value": "high", "label": "High"}]},
    ],
}


PROMPT_VERSION = 5  # v5: 26 components (FilterPanel, Navigation), dense tables, undo-over-confirm

TREE_EXAMPLE = {
    "specVersion": "0.1.0",
    "surface": EXAMPLE["surface"],
    "root": {**{k: v for k, v in EXAMPLE["components"][0].items() if k not in ("id", "children")},
             "children": [{k: v for k, v in c.items() if k != "id"} for c in EXAMPLE["components"][1:]]},
}

SHAPES = {
    "flat": """Document shape: {"specVersion":"0.1.0","surface":{"id","title","intent","pattern"?},"root":"<id>","components":[...]}.
Components are a FLAT list; each has a unique "id" and "component" (its type). Containers reference children by id STRINGS ("children": ["a","b"]); never nest component objects inside other components.""",
    "tree": """Document shape: {"specVersion":"0.1.0","surface":{"id","title","intent","pattern"?},"root":{<component>}}.
Write the interface as a TREE: "root" is a component object, and wherever a component contains others (children, media, empty, summary, action, a Collection's items.item, a view's or step's content) write the child component object inline. Components don't need ids.""",
}


@cache
def system_prompt(fmt: str = "flat") -> str:
    example = TREE_EXAMPLE if fmt == "tree" else EXAMPLE
    return f"""You generate just-in-time user interfaces as JSON, in the Polyxd UI document format. Output ONE JSON object and nothing else.

{SHAPES[fmt]}

Rules:
1. Data comes from the host. Bind values with {{"path":"/json/pointer"}}; pointers start at the root of the DATA object (DATA {{"card":{{"id":"c1"}}}} → {{"path":"/card/id"}}, never "/data/card/id"). Never type numbers, prices, names or dates from the data as literal text; never invent data.
2. Inside a repeated item (Collection items template, Table columns, Chart series, Comparison attributes) use paths RELATIVE to the item, e.g. {{"path":"amount"}}.
3. Actions: {{"event":{{"name":"<capability>","context":{{...}}}}}}. Use ONLY the capabilities listed. "ui.dismiss" closes the surface.
4. Destructive capabilities must be triggered from a Confirm. Consequential ones need a Confirm or a review step first.
5. At most one primary action visible at a time (a Form's submit counts). At most 6 inputs per view; use Steps for more.
6. Labels say what happens ("Send £20", "Freeze card"), in sentence case. Give every component that represents a thing from the data a stable "key" in lower_snake_case (e.g. "card_status").
7. Collections and Tables need an "empty" Status when the list may be empty.
8. If no listed capability can do what was asked, show a Status explaining that instead of a fake interface.
9. Format numbers, money and dates with "format", never by writing them into strings.
10. There is no template engine. Text is either literal or a binding; "{{{{budget}}}}" or "${{spent}}" in a string reaches the screen exactly as written.
11. Bind text to a field that holds text. A pointer at an object or a list prints as "[object Object]"; point at the string inside it.
12. Show people names, not internal ids. If a record has both "id" and "name", the screen gets "name"; the id belongs in an action's context.

Components (* = required):
{catalog_text()}

Patterns (set surface.pattern when one applies):
{patterns_text()}

Example:
{json.dumps(example, ensure_ascii=False)}"""


@cache
def registry() -> dict:
    return json.loads((BENCH / "registry.json").read_text())["capabilities"]


@cache
def directions() -> dict:
    out = {}
    for f in (SPEC / "examples" / "directions").glob("*.json"):
        d = json.loads(f.read_text())
        out[d["name"]] = d
    return out


def direction_text(d: dict) -> list[str]:
    """A Design Direction as instructions: taste rules plus copy and tone."""
    v = d.get("voice", {})
    out = [f"Design direction ({d['name']}):"]
    if v.get("guidelines"):
        out.append("- Voice: " + " ".join(v["guidelines"]))
    tone = v.get("tone", {})
    if tone:
        out.append("- Tone: " + ", ".join(f"{k} {val}" for k, val in tone.items()))
    person = {"you": 'address the user as "you"; never say "we"', "we-and-you": 'the product may say "we"', "impersonal": 'don\'t say "you" or "we"'}.get(v.get("person", ""))
    if person:
        out.append(f"- Person: {person}")
    style = []
    if v.get("casing"):
        style.append(f"{v['casing']} case")
    if v.get("spelling"):
        style.append(f"{v['spelling']} spelling")
    if v.get("readingLevel", {}).get("maxGrade"):
        style.append(f"reading grade {v['readingLevel']['maxGrade']} or below")
    if v.get("punctuation", {}).get("exclamation") == "never":
        style.append("no exclamation marks")
    if v.get("punctuation", {}).get("emoji") == "never":
        style.append("no emoji")
    if v.get("labels", {}).get("maxWords"):
        style.append(f"button labels of at most {v['labels']['maxWords']} words, starting with a verb")
    if style:
        out.append("- Style: " + "; ".join(style))
    glossary = [f'say "{g["use"]}", not {" or ".join(repr(x) for x in g.get("insteadOf", []))}' for g in v.get("glossary", [])]
    if glossary:
        out.append("- Words: " + "; ".join(glossary))
    if v.get("avoid"):
        out.append("- Never use: " + ", ".join(repr(x) for x in v["avoid"]))
    for moment, guidance in v.get("situations", {}).items():
        out.append(f"- For {moment} states: {guidance}")
    rules = [r["description"] for r in d.get("rules", [])]
    if rules:
        out.append("- Rules: " + "; ".join(rules))
    return out


def user_prompt(request: dict, memory: str | None = None) -> str:
    """The host's turn: request, capabilities it exposes, the data, and any direction/memory."""
    caps = registry()
    lines = [f"Request: {request['request']}", f"Intent: {request.get('intent', '')}", "", "Capabilities you may use:"]
    for name in request.get("capabilities", []):
        c = caps.get(name, {})
        inputs = ", ".join(c.get("inputs", {}).get("properties", {}).keys())
        lines.append(f"- {name} (risk: {c.get('risk', '?')}; inputs: {inputs or 'none'}): {c.get('description', '')}")
    if not request.get("capabilities"):
        lines.append("- (none)")
    lines += ["", "DATA (bind to it with JSON Pointers; do not copy values into text):", json.dumps(request.get("data", {}), ensure_ascii=False)]
    names = request.get("expect", {}).get("names")
    if names:
        lines += ["", "Required button labels (use exactly): " + "; ".join(names)]
    direction = request.get("direction")
    if direction and direction in directions():
        lines += ["", *direction_text(directions()[direction])]
    if memory:
        lines += ["", "Interface memory (keep these keys, labels, components and order the same):", memory]
    lines += ["", "Output the JSON document now."]
    return "\n".join(lines)
