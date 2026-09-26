import json, collections, glob, re
import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "../../apps/site/content/coverage.json")
m = json.load(open(os.path.join(HERE, "mapping.json")))
E = m["entries"]
# Decisions after the mapping: no Timeline (Collection's timeline layout covers it), no Calendar
# (two systems; the other calendars are DateInput), QR codes are a Media kind.
for e in E:
    if e["target"] == "Calendar":
        e.update(target="Collection", variant="calendar", status="existing-new-variant")
    if e["target"] is None or e["status"] == "UNMAPPED":
        e.update(target="Media", variant="qr", status="existing-new-variant")

    if e["target"] == "TextInput" and e["variant"] == "password":
        # The spec keeps secrets out of generated screens: the host collects them in its own flows.
        e.update(target="out:app-chrome", variant=None, status="non-component")
spec = {}
for f in glob.glob("/Users/neel/Work/Polixd/packages/spec/components/*.json"):
    c = json.load(open(f)); spec[c["name"]] = c["summary"]
NEW = {
    "ActionMenu": "Secondary actions behind one control: an overflow menu, dropdown, split button or context menu.",
    "FileInput": "Choose or drop files to upload.",
    "ColorInput": "Pick a colour or a swatch.",
    "CodeInput": "A one-time code or PIN, typed into boxes.",
    "Rating": "Give or show a score out of N.",
    "Tag": "A short label, status or count attached to something else.",
    "Identity": "A person, team or organisation: picture, name and details.",
    "Tree": "A hierarchy people expand, browse and pick from.",
    "Progress": "How far along something is, or an amount within bounds: bars, rings, meters, gauges.",
    "Code": "Code or preformatted text, copyable.",
    "Panel": "Content opened over the current view: a dialog, drawer, sheet or popover.",
}
GROUPS = [
    ("Actions", ["Action", "ActionBar", "ActionMenu", "Confirm"]),
    ("Inputs", ["TextInput", "Choice", "Toggle", "DateInput", "RangeInput", "Form", "FileInput", "ColorInput", "CodeInput", "Rating"]),
    ("Content", ["Text", "Metric", "DetailList", "Table", "Collection", "Chart", "Media", "Status", "Tag", "Identity", "Tree", "Progress", "Code"]),
    ("Structure and flow", ["Section", "Group", "Card", "Disclosure", "Views", "Steps", "Comparison", "FilterPanel", "Navigation", "Panel"]),
]
systems = []
for e in E:
    if e["system"] not in systems: systems.append(e["system"])
comps = []
for g, names in GROUPS:
    for n in names:
        rows = [e for e in E if e["target"] == n]
        sys_ = sorted({e["system"] for e in rows}, key=systems.index)
        variants = collections.Counter()
        vsys = collections.defaultdict(set)
        for e in rows:
            if e["variant"] and e["status"] == "existing-new-variant":
                vsys[e["variant"]].add(e["system"])
        covers = []
        seen = set()
        for e in rows:
            k = e["name"].lower()
            if k not in seen: seen.add(k); covers.append(e["name"])
        comps.append({"name": n, "group": g, "isNew": n in NEW, "summary": NEW.get(n) or spec.get(n, ""), "systems": len(sys_), "entries": len(rows),
                      "newVariants": sorted(([v, len(s)] for v, s in vsys.items()), key=lambda x: -x[1]), "covers": covers[:14], "more": max(0, len(covers) - 14)})
NONC = collections.Counter()
for e in E:
    t = e["target"] or ""
    if t.startswith("renderer:"): NONC["renderer"] += 1
    elif t.startswith("out:"): NONC[t] += 1
rows = [[systems.index(e["system"]), e["name"], e["target"], e["variant"] or "", {"existing": 0, "existing-new-variant": 1, "new": 2, "non-component": 3}.get(e["status"], 3)] for e in E]
# Foundations: the token roles every pack provides, by group.
contract = json.load(open("/Users/neel/Work/Polixd/packages/spec/tokens/semantic-contract.json"))
fgroups = collections.OrderedDict()
for role in contract["tokens"]:
    g = role.split(".")[0]; fgroups.setdefault(g, []).append(role)
FOUND_DESC = {"color": "Surfaces, text, borders, actions, selection, status and data colours, in every mode", "type": "The type scale: display, headings, body, captions and numerals", "space": "Inset and stack spacing, tight to spacious", "radius": "Corner radii for controls, cards and overlays", "elevation": "Shadows for raised and overlay surfaces", "shadow": "Shadows for raised and overlay surfaces", "motion": "Durations and easings", "size": "Control heights and the minimum touch target", "border": "Border widths", "focus": "The focus ring", "opacity": "Disabled and overlay opacities", "measure": "The longest comfortable line of text", "layout": "Action-bar gap, item and bleed a pack may set"}
FOUND_COVERS = {"color": ["Color", "Colors", "Palette", "Theme"], "type": ["Typography", "Type scale", "Text styles", "Fonts"], "space": ["Spacing", "Space", "Sizing"], "radius": ["Border radius", "Corner radius", "Radii"], "elevation": ["Elevation", "Shadows", "Depth"], "shadow": ["Elevation", "Shadows"], "motion": ["Motion", "Animation", "Easing", "Duration"], "size": ["Sizing", "Touch targets", "Density"], "border": ["Borders", "Strokes"], "focus": ["Focus ring", "Focus states"], "opacity": ["Opacity"], "measure": ["Line length"], "layout": ["Layout"]}
foundations = [{"name": g, "count": len(r), "summary": FOUND_DESC.get(g, ""), "covers": FOUND_COVERS.get(g, [])} for g, r in fgroups.items()]

# Patterns: the six the spec ships, with the design-system pages that describe the same thing.
patterns = []
PAT_MATCH = {"confirm": r"confirm|alert ?dialog|popconfirm", "undo": r"snackbar|toast|undo", "review": r"check.*answers|summary list|review", "multi-step": r"stepper|step by step|question page|task list|wizard|steps", "filter": r"^filter|search|pagination|data ?table|index ?table", "compar": r"compar|pricing|plan"}
for f in sorted(glob.glob("/Users/neel/Work/Polixd/packages/spec/patterns/*.json")):
    p = json.load(open(f)); pid = f.split("/")[-1].replace(".json", "")
    key = next((k for k in PAT_MATCH if k in pid or k in (p.get("name") or "").lower()), None)
    rx = re.compile(PAT_MATCH.get(key, "^$"), re.I)
    PAT_TARGET = {"confirm": ["Confirm"], "undo": ["renderer:action-feedback"], "review": [], "multi-step": ["Steps"], "filter": ["FilterPanel"], "compar": ["Comparison"]}
    names = []
    for e in E:
        if (rx.search(e["name"]) or e["target"] in PAT_TARGET.get(key, [])) and e["name"] not in names: names.append(e["name"])
    patterns.append({"id": pid, "name": p.get("name") or p.get("title") or pid, "summary": p.get("summary") or p.get("description") or "", "covers": names[:10], "more": max(0, len(names) - 10)})

# What the renderer does by itself, grouped by behaviour.
REN_DESC = {"hint": "Tooltips and help on hover or focus", "loading": "Skeletons, spinners and progress while data arrives", "action-feedback": "Toasts and snackbars after an action, with Undo for reversible ones", "field": "Labels, help text, required marks and error text around every input", "shortcut-hint": "Keyboard shortcut hints", "icon": "Icons, from the design system's own set", "scroll-area": "Scroll regions and their scrollbars", "dismiss": "Closing overlays and dismissing banners", "chart": "Chart scaffolding: axes, legends, tooltips", "affix": "Sticky bars and back-to-top", "overflow": "Truncation and overflow menus for what doesn't fit", "form-errors": "Error summaries at the top of a form", "focus-trap": "Focus management in dialogs", "media-viewer": "Lightboxes for media", "truncation": "Truncating long text", "navigation-toggle": "Opening and closing navigation on small screens", "announcements": "Live-region announcements for screen readers", "ai-disclosure": "Marking generated content as generated"}
ren = collections.OrderedDict()
for e in E:
    t = e["target"] or ""
    if t.startswith("renderer:"):
        k = t[9:]; ren.setdefault(k, [])
        if e["name"] not in ren[k]: ren[k].append(e["name"])
renderer = [{"name": k, "summary": REN_DESC.get(k, ""), "covers": v[:10], "more": max(0, len(v) - 10), "systems": len({e["system"] for e in E if e["target"] == "renderer:" + k})} for k, v in sorted(ren.items(), key=lambda x: -len(x[1]))]

data = {"systems": systems, "components": comps, "rows": rows, "counts": dict(NONC), "total": len(E), "foundations": foundations, "patterns": patterns, "renderer": renderer}
json.dump(data, open(OUT, "w"))
print(len(comps), "components;", sum(c["isNew"] for c in comps), "new;", len(rows), "rows;", dict(NONC))
