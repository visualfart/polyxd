"""Validates UI documents and Design Directions.

A port of packages/spec/src/validate.ts. The JSON Schema runs first; if it passes, the structural
and design rules the schema can't express run next. Each issue carries the same JSON Pointer and
the same message as the TypeScript validator gives, which tests/test_parity.py checks against
the TypeScript validator's own output.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from . import _data
from ._schema import SchemaError, schema_errors

Severity = Literal["error", "warning"]
Code = Literal["data:missing-path", "shell:structure"]


@dataclass(frozen=True)
class Issue:
    """One problem with a document."""

    path: str
    """JSON Pointer into the document ("" or "/" is the whole document)."""
    message: str
    severity: Severity = "error"
    hint: str | None = None
    """What to change, in a sentence, when there's something specific to say."""
    code: Code | None = None
    """Set on issues a caller may want to weigh on their own: a binding that reads nothing, or the shell's structure."""

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}

    def __str__(self) -> str:
        return f"{self.severity} {self.path}: {self.message}"


@dataclass(frozen=True)
class Result:
    valid: bool
    issues: list[Issue] = field(default_factory=list)

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == "warning"]

    def __bool__(self) -> bool:
        return self.valid

    def to_dict(self) -> dict[str, Any]:
        return {"valid": self.valid, "issues": [i.to_dict() for i in self.issues]}


# The tables below mirror the ones at the top of validate.ts. tests/test_parity.py fails if the
# two validators disagree on any example or fixture, which is how a change there shows up here.

#: Props whose paths resolve against the current item of a repeated structure.
ITEM_SCOPED: dict[str, list[str]] = {
    "Table": ["columns", "rowAction", "rowValuePath"],
    "Tree": ["labelPath", "childrenPath", "valuePath", "detailPath", "action"],
    "Chart": ["x", "series"],
    "Comparison": ["itemTitle", "attributes", "choose"],
    "Collection": ["datePath"],
    "Text": ["itemPath"],
    "Media": ["imagePath", "altPath"],
    "DetailList": ["rowAction"],
}
#: Props that open a separately visible context (only one panel/step/dialog shows at a time).
PANEL_PROPS: dict[str, list[str]] = {"Views": ["views"], "Steps": ["steps"]}
RENDERER_ACTIONS = ["ui.dismiss", "ui.back", "ui.next", "ui.copy"]
#: The prop each repeating component iterates over. Its item-scoped props read from each entry.
LIST_BINDINGS: dict[str, str] = {"Collection": "items", "Table": "rows", "Comparison": "items", "Chart": "data", "Choice": "options", "Tree": "items", "Text": "items", "Media": "items"}
#: Components whose `value` binding is state they write, so it needn't exist in data beforehand.
INPUTS = {"TextInput", "Choice", "Toggle", "DateInput", "RangeInput", "Rating", "FileInput", "ColorInput", "CodeInput"}


class _Missing:
    """JavaScript's undefined: a key that isn't there, as opposed to null."""

    def __repr__(self) -> str:
        return "undefined"


MISSING: Any = _Missing()


def _js_keys(obj: Any) -> list[str]:
    """Object.keys order: integer-like keys ascending, then the rest in insertion order."""
    if isinstance(obj, list):
        return [str(i) for i in range(len(obj))]
    ints = sorted((k for k in obj if k.isdigit() and (k == "0" or not k.startswith("0")) and int(k) < 2**32 - 1), key=int)
    return ints + [k for k in obj if k not in set(ints)]


def _js_typeof(v: Any) -> str:
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        return "string"
    return "object"


def resolve_pointer(data: Any, path: str) -> Any:
    """The value at a JSON Pointer, or MISSING. Arrays answer `length`, as in JavaScript."""
    if not path.startswith("/"):
        return MISSING
    cur = data
    for part in (p.replace("~1", "/").replace("~0", "~") for p in path[1:].split("/")):
        if isinstance(cur, dict):
            if part not in cur:
                return MISSING
            cur = cur[part]
        elif isinstance(cur, list):
            if part == "length":
                cur = len(cur)
            elif part.isdigit() and (part == "0" or not part.startswith("0")) and int(part) < len(cur):
                cur = cur[int(part)]
            else:
                return MISSING
        else:
            return MISSING
    return cur


@dataclass
class _ListScope:
    """A list relative paths resolve against: absolute, or relative to each entry of `parent`."""

    path: str
    parent: _ListScope | None = None


@dataclass
class _Ctx:
    prop: str
    item_scoped: bool
    panel: str | None = None
    list: _ListScope | None = None


@dataclass
class _Found:
    ids: list[dict[str, Any]] = field(default_factory=list)
    paths: list[dict[str, Any]] = field(default_factory=list)
    actions: list[dict[str, Any]] = field(default_factory=list)


def _items_of(data: Any, scope: _ListScope) -> list[Any]:
    if scope.path.startswith("/"):
        within = [data]
    else:
        within = _items_of(data, scope.parent) if scope.parent else []
    pointer = scope.path if scope.path.startswith("/") else f"/{scope.path}"
    out: list[Any] = []
    for w in within:
        v = resolve_pointer(w, pointer)
        if isinstance(v, list):
            out.extend(v)
    return out


def _pointers_ending_in(data: Any, name: str, at: str = "", depth: int = 0) -> list[str]:
    if depth > 4 or not isinstance(data, dict):
        return []
    out: list[str] = []
    for k in _js_keys(data):
        if k == name:
            out.append(f"{at}/{k}")
        out.extend(_pointers_ending_in(data[k], name, f"{at}/{k}", depth + 1))
    return out


class _DocumentChecker:
    def __init__(self, opts: dict[str, Any]):
        self.schema = _data.schema("ui")
        self.defs = self.schema["$defs"]
        self.reference_types = _data.reference_types()
        self.shell_components = [n for n, d in _data.component_definitions().items() if d.get("shell")]
        self.opts = opts
        self.issues: list[Issue] = []

    # Reporting

    def error(self, at: str, message: str, hint: str | None = None) -> None:
        self.issues.append(Issue(at, message, "error", hint))

    def warn(self, at: str, message: str, hint: str | None = None) -> None:
        self.issues.append(Issue(at, message, "warning", hint))

    def shell(self, severity: Severity, at: str, message: str, hint: str | None = None) -> None:
        self.issues.append(Issue(at, message, severity, hint, "shell:structure"))

    def missing(self, at: str, message: str, hint: str | None = None) -> None:
        self.issues.append(Issue(at, message, self.opts.get("missing_data") or "warning", hint, "data:missing-path"))

    # Schema walking

    def deref(self, s: Any) -> Any:
        cur = s
        while isinstance(cur, dict) and "$ref" in cur:
            cur = self.defs.get(cur["$ref"].replace("#/$defs/", ""))
        return cur

    @staticmethod
    def ref_name(s: Any) -> str | None:
        return s["$ref"].replace("#/$defs/", "") if isinstance(s, dict) and isinstance(s.get("$ref"), str) else None

    def walk(self, schema: Any, value: Any, at: str, ctx: _Ctx, found: _Found) -> None:
        """Walks a value alongside its schema, collecting component references, data paths and action names."""
        name = self.ref_name(schema)
        if name == "Id" and isinstance(value, str):
            found.ids.append({"id": value, "at": at, "prop": ctx.prop, "panel": ctx.panel})
            return
        if name == "Path" and isinstance(value, str):
            found.paths.append({"path": value, "at": at, "item_scoped": ctx.item_scoped, "list": ctx.list if ctx.item_scoped else None})
            return
        if name == "Capability" and isinstance(value, str):
            found.actions.append({"name": value, "at": at})
            return
        # An Identity group: one list, with paths relative to each entry, like Options.
        if ctx.prop == "group" and isinstance(value, dict) and "path" in value:
            found.paths.append({"path": value["path"], "at": f"{at}/path", "item_scoped": ctx.item_scoped, "list": None})
            for k in ("namePath", "imagePath"):
                if value.get(k):
                    found.paths.append({"path": value[k], "at": f"{at}/{k}", "item_scoped": True, "list": _ListScope(value["path"])})
            return
        if name == "Options" and isinstance(value, dict):
            found.paths.append({"path": value.get("path"), "at": f"{at}/path", "item_scoped": ctx.item_scoped, "list": None})
            for k in ("valuePath", "labelPath", "descriptionPath", "avatarPath", "imagePath", "recentPath"):
                if value.get(k):
                    found.paths.append({"path": value[k], "at": f"{at}/{k}", "item_scoped": True, "list": _ListScope(value.get("path"))})
            return
        s = self.deref(schema)
        if not s:
            return
        if "oneOf" in s:
            for b in s["oneOf"]:
                d = self.deref(b)
                t = d.get("type")
                if isinstance(value, list):
                    match = t == "array"
                elif isinstance(value, dict):
                    match = t == "object"
                else:
                    match = t != "object" and t != "array"
                if match:
                    self.walk(b, value, at, ctx, found)
                    break
            return
        if isinstance(value, list) and s.get("items"):
            for i, v in enumerate(value):
                self.walk(s["items"], v, f"{at}/{i}", ctx, found)
        elif isinstance(value, dict):
            props = s.get("properties") or {}
            extra = s.get("additionalProperties")
            for k in _js_keys(value):
                child = props[k] if k in props else (extra if isinstance(extra, dict) else None)
                if child:
                    self.walk(child, value[k], f"{at}/{k}", ctx, found)

    # The rules

    def run(self, doc: Any) -> Result:
        errs = schema_errors("ui", doc)
        if errs:
            return self.schema_result(errs)

        d = doc
        data = d.get("data", MISSING)
        surface = d.get("surface") if isinstance(d.get("surface"), dict) else {}
        by_id: dict[str, tuple[dict[str, Any], int]] = {}
        for index, c in enumerate(d["components"]):
            if c["id"] in by_id:
                self.error(f"/components/{index}/id", f'duplicate id "{c["id"]}"', "Give each component its own id.")
            else:
                by_id[c["id"]] = (c, index)
        if d["root"] not in by_id:
            self.error("/root", f'root "{d["root"]}" is not a component id', "Set root to the id of the outermost component.")

        # Collect references per component.
        refs: dict[str, _Found] = {}
        for cid, (c, index) in by_id.items():
            found = _Found()
            comp_schema = self.defs[f"Component{c['component']}"]
            for prop in _js_keys(c):
                if prop in ("id", "component"):
                    continue
                value = c[prop]
                item_scoped = prop in ITEM_SCOPED.get(c["component"], [])
                bound = c.get(LIST_BINDINGS.get(c["component"], "\0"))
                list_path = bound.get("path") if isinstance(bound, dict) else None
                scope = _ListScope(list_path) if item_scoped and isinstance(list_path, str) else None
                panelled = prop in PANEL_PROPS.get(c["component"], [])
                if panelled and isinstance(value, list):
                    for i, panel in enumerate(value):
                        self.walk(comp_schema["properties"][prop]["items"], panel, f"/components/{index}/{prop}/{i}", _Ctx(prop, item_scoped, f"{cid}#{i}", scope), found)
                else:
                    self.walk(comp_schema["properties"][prop], value, f"/components/{index}/{prop}", _Ctx(prop, item_scoped, None, scope), found)
            refs[cid] = found

        # Reference integrity and allowed types.
        for cid, found in refs.items():
            owner = by_id[cid][0]
            for r in found.ids:
                target = by_id.get(r["id"])
                if not target:
                    self.error(r["at"], f'references unknown component "{r["id"]}"', "Add a component with that id, or reference one that exists.")
                    continue
                if r["id"] == cid:
                    self.error(r["at"], "component references itself")
                allowed = self.reference_types.get(f"{owner['component']}.{r['prop']}")
                if allowed and target[0]["component"] not in allowed:
                    self.error(
                        r["at"],
                        f"{owner['component']}.{r['prop']} must reference {' or '.join(allowed)}, not {target[0]['component']}",
                        "Wrap the content in a component this slot accepts.",
                    )
            for a in found.actions:
                if a["name"].startswith("ui.") and a["name"] not in RENDERER_ACTIONS:
                    self.error(a["at"], f'"{a["name"]}" is not a renderer action ({", ".join(RENDERER_ACTIONS)})', "The ui. namespace is the renderer's; name a host capability instead.")

        # Rules the schema states in prose.
        for c, index in by_id.values():
            if c["component"] == "TextInput" and "placeholder" in c and c.get("kind") != "search":
                self.warn(f"/components/{index}/placeholder", "placeholders are only for search fields; use the label and help text")
            if c["component"] == "Media" and not c.get("decorative") and "alt" not in c:
                self.error(f"/components/{index}", "Media needs alt text unless it is decorative", 'Bind alt to data, or set "decorative": true.')

        # Tree walk from root: cycles, single parent, reachability, item scope, primary-action contexts.
        parent: dict[str, str] = {}
        reached: set[str] = set()
        item_scoped_ids: set[str] = set()
        template_list: dict[str, _ListScope] = {}
        primaries: list[tuple[str, list[str]]] = []

        def visit(cid: str, stack: list[str], in_template: bool, trail: list[str], scope: _ListScope | None = None) -> None:
            entry = by_id.get(cid)
            if not entry:
                return
            c, index = entry
            if cid in trail:
                self.error(f"/components/{index}", f"cycle: {' → '.join([*trail, cid])}")
                return
            reached.add(cid)
            if in_template:
                item_scoped_ids.add(cid)
            if scope:
                template_list[cid] = scope
            ctx = stack
            if c["component"] == "Confirm":
                ctx = [*stack, f"{cid}#dialog"]
            if c["component"] == "Action" and c.get("emphasis") == "primary":
                primaries.append((f"/components/{index}", ctx))
            if c["component"] == "Form":
                primaries.append((f"/components/{index}/submit", ctx))
            if c["component"] == "Steps":
                primaries.append((f"/components/{index}/finish", [*ctx, f"{cid}#{len(c['steps']) - 1}"]))

            for r in refs[cid].ids:
                if r["id"] not in by_id or r["id"] == cid:
                    continue
                # A Collection's item template and a Table's row-action menu and row detail all render once per row.
                is_template = (r["prop"] == "items" and c["component"] == "Collection") or (r["prop"] in ("rowActions", "detail") and c["component"] == "Table")
                prev = parent.get(r["id"])
                if prev and prev != cid:
                    self.error(r["at"], f'"{r["id"]}" already has parent "{prev}"; a component can appear in only one place', "Give the second place its own component.")
                    continue
                parent[r["id"]] = cid
                repeats = None
                if is_template:
                    holder = c.get("rows" if c["component"] == "Table" else "items")
                    repeats = holder.get("path") if isinstance(holder, dict) else None
                child_scope = _ListScope(repeats, None if repeats.startswith("/") else scope) if isinstance(repeats, str) else scope
                visit(r["id"], [*ctx, r["panel"]] if r["panel"] else ctx, in_template or is_template, [*trail, cid], child_scope)

        if d["root"] in by_id:
            visit(d["root"], [], False, [])
        # The surface's own header actions and the product's navigation sit outside the root component.
        if isinstance(surface.get("actions"), str) and surface["actions"] in by_id:
            visit(surface["actions"], [], False, [])
        for cid, (c, _) in by_id.items():
            if c["component"] == "Navigation" and cid not in reached:
                visit(cid, [], False, [])

        for cid, (_, index) in by_id.items():
            if cid not in reached:
                self.warn(f"/components/{index}", f'"{cid}" is not reachable from root "{d["root"]}"', "Reference it from a parent, or remove it.")

        # The shell: Frame, AppBar, Footer, Outlet and Custom live only in an authored shell document.
        is_shell_doc = surface.get("kind") == "shell"
        shell_parts = [(cid, c, index) for cid, (c, index) in by_id.items() if c["component"] in self.shell_components]
        if not is_shell_doc:
            for _, c, index in shell_parts:
                self.shell("error", f"/components/{index}", f'{c["component"]} belongs in a shell document: set surface.kind to "shell"', "A generator never writes a shell; remove it from this surface.")
        else:
            if surface.get("origin") != "authored":
                self.shell("error", "/surface/origin", 'a shell is authored; set surface.origin to "authored"')
            root_component = by_id[d["root"]][0]["component"] if d["root"] in by_id else None
            if root_component and root_component != "Frame":
                self.shell("error", "/root", f"a shell's root is a Frame, not {root_component}")
            outlets = [(cid, index) for cid, (c, index) in by_id.items() if c["component"] == "Outlet"]
            if not outlets:
                self.shell("error", "/components", "a shell has exactly one Outlet, reachable from the Frame's main; this one has none")
            for _, index in outlets[1:]:
                self.shell("error", f"/components/{index}", "a shell has exactly one Outlet; this is another")
            under_main: set[str] = set()
            main = by_id[d["root"]][0].get("main") if root_component == "Frame" else None

            def walk_main(cid: Any) -> None:
                if not isinstance(cid, str) or cid in under_main or cid not in by_id:
                    return
                under_main.add(cid)
                for r in refs[cid].ids:
                    walk_main(r["id"])

            if isinstance(main, str):
                walk_main(main)
            for cid, index in outlets[:1]:
                if isinstance(main, str) and cid not in under_main:
                    self.shell("error", f"/components/{index}", f'the Outlet "{cid}" is not reachable from the Frame\'s main "{main}"')
        # Navigation.placement is where a Frame puts its main navigation; outside a Frame nothing reads it.
        for cid, (c, index) in by_id.items():
            if c["component"] != "Navigation" or "placement" not in c:
                continue
            owner = parent.get(cid)
            if not owner or by_id.get(owner, ({}, 0))[0].get("component") != "Frame":
                self.shell("warning", f"/components/{index}/placement", "Navigation.placement only applies to a Frame's navigation; here nothing reads it")

        # How many primary actions may share a view (a Design Direction's profile.emphasisBudget).
        budget = max(1, self.opts.get("emphasis_budget") or 1)

        def is_prefix(a: list[str], b: list[str]) -> bool:
            return all(i < len(b) and b[i] == x for i, x in enumerate(a))

        def together(a: list[str], b: list[str]) -> bool:
            return is_prefix(a, b) or is_prefix(b, a)

        for i in range(len(primaries)):
            group = [p for j, p in enumerate(primaries) if j >= i and together(primaries[i][1], p[1])]
            if len(group) > budget:
                last = group[budget]
                if budget == 1:
                    msg = f"more than one primary action visible at once (also {group[0][0]})"
                else:
                    msg = f"more than {budget} primary actions visible at once (also {', '.join(p[0] for p in group[:budget])})"
                self.error(last[0], msg, "Make the others secondary, or put them in separate views.")
                break

        # A binding a component repeats over has to point at a list.
        if data is not MISSING:
            for c, index in by_id.values():
                prop = LIST_BINDINGS.get(c["component"])
                bound = c.get(prop) if prop else None
                path = bound.get("path") if isinstance(bound, dict) else None
                if not isinstance(path, str) or not path.startswith("/"):
                    continue
                value = resolve_pointer(data, path)
                if value is not MISSING and not isinstance(value, list):
                    kind = "null" if value is None else _js_typeof(value)
                    self.error(f"/components/{index}/{prop}/path", f'{c["component"]}.{prop} must point at a list; "{path}" is {kind} in data', "Point the binding at an array in data.")

        # Relative paths only where an item is in scope; with data given, every binding should read something.
        written = [c["value"]["path"] for c, _ in by_id.values() if c["component"] in INPUTS and isinstance(c.get("value"), dict) and isinstance(c["value"].get("path"), str) and c["value"]["path"].startswith("/")]

        def is_written(path: str) -> bool:
            return any(w == path or w.startswith(f"{path}/") or path.startswith(f"{w}/") for w in written)

        for cid, found in refs.items():
            scoped = cid in item_scoped_ids
            for p in found.paths:
                path = p["path"]
                if not path.startswith("/"):
                    if not p["item_scoped"] and not scoped:
                        self.error(p["at"], f'relative path "{path}" used outside a repeated item', f'Use an absolute path, "/{path}", or move this inside a repeated item.')
                        continue
                    scope = p["list"] or template_list.get(cid)
                    if data is MISSING or not scope:
                        continue
                    items = _items_of(data, scope)
                    if items and all(resolve_pointer(item, f"/{path}") is MISSING for item in items):
                        first = next((i for i in items if isinstance(i, (dict, list))), {})
                        fields = _js_keys(first)
                        self.missing(p["at"], f'"{path}" is not a field of the items in {scope.path}' + (f" (they have {', '.join(fields)})" if fields else ""))
                elif data is not MISSING and resolve_pointer(data, path) is MISSING and not is_written(path):
                    scope = template_list.get(cid) if scoped else None
                    name = path[path.rfind("/") + 1 :]
                    in_item = bool(scope) and any(resolve_pointer(item, f"/{name}") is not MISSING for item in _items_of(data, scope))
                    elsewhere = None if in_item else next(iter(_pointers_ending_in(data, name)), None)
                    suffix = f': inside a repeated item, the item\'s own field is "{name}", without the slash' if in_item else (f' (did you mean "{elsewhere}"?)' if elsewhere else "")
                    self.missing(p["at"], f'path "{path}" does not exist in data' + suffix)

        return Result(not any(i.severity == "error" for i in self.issues), self.issues)

    def schema_result(self, errs: list[SchemaError]) -> Result:
        # oneOf and discriminator produce cascades; keep the most specific errors.
        deepest = [e for e in errs if not any(o is not e and o.at.startswith(e.at + "/") for o in errs)]
        seen: set[str] = set()
        for e in deepest:
            message = _schema_message(e)
            key = f"{e.at or '/'}: {message}"
            if key not in seen:
                seen.add(key)
                self.error(e.at or "/", message, _schema_hint(e))
        return Result(False, self.issues)


def _schema_message(e: SchemaError) -> str:
    if e.keyword == "additionalProperties":
        return f'unknown property "{e.params.get("additionalProperty")}"'
    if e.keyword == "const" and e.at.endswith("/component"):
        return f'unknown component "{e.instance}"'
    if e.keyword == "discriminator":
        return "unknown or missing component type"
    return e.message


def _schema_hint(e: SchemaError) -> str | None:
    if e.keyword == "additionalProperties":
        return "Remove it; polyxd_spec.components() lists each component's props."
    if e.keyword == "discriminator":
        return "Set component to one of the names in polyxd_spec.components()."
    if e.keyword == "required":
        return 'Add "{}".'.format(e.params.get("missingProperty"))
    if e.keyword == "type" and e.message == "must be object" and not isinstance(e.instance, (dict, list)):
        return 'Bind the value to host data: {"path": "/..."}.'
    return None


def validate_document(doc: Any, *, emphasis_budget: int | None = None, missing_data: Literal["warning", "error"] | None = None) -> Result:
    """Validates a UI document: JSON Schema first, then the structural and design rules.

    emphasis_budget: primary actions allowed in one view (a Design Direction's profile.emphasisBudget). Default 1.
    missing_data: how to report a binding that reads nothing from the document's data. Default "warning",
    since data given with a document may be a sample; the verifier uses "error".
    """
    return _DocumentChecker({"emphasis_budget": emphasis_budget, "missing_data": missing_data}).run(doc)


def _plain(name: str, instance: Any) -> Result:
    issues = [Issue(e.at or "/", e.message, "error", _schema_hint(e)) for e in schema_errors(name, instance)]
    return Result(not issues, issues)


def validate_direction(direction: Any) -> Result:
    """Validates a Design Direction (a company's taste) against schema/direction.schema.json."""
    return _plain("direction", direction)


def validate_schema(name: str, instance: Any) -> Result:
    """Validates anything against one of the spec's schemas by name: "journey", "event", "capabilities"..."""
    if name not in _data.schema_names():
        raise KeyError(f'no schema "{name}"; the spec has {", ".join(_data.schema_names())}')
    return _plain(name, instance)


def issue_lines(result: Result) -> Iterable[str]:
    for i in result.issues:
        yield f"    {'error' if i.severity == 'error' else 'warn '} {i.path}: {i.message}"
