"""Writes Polyxd Studio's artboards and canvas index to out/project/: python3 build.py"""
import json, os, re, datetime
import screens_a as A
import screens_b as B

ROWS = [
    ("Getting started: a workspace, then a home that says what's left to set up", [("Main", A.home), ("workspace-new", A.workspace_new)]),
    ("Design system, create: import tokens, then check every guess Studio made", [("ds-list", A.ds_list), ("ds-import", A.ds_import), ("ds-mapping", A.ds_mapping)]),
    ("Design system, read, update, delete: tokens, a preview in real screens, edits in a draft, a typed check to delete one in use", [("ds-detail", A.ds_detail), ("ds-token-edit", A.ds_token_edit), ("ds-preview", A.ds_preview), ("ds-delete", A.ds_delete)]),
    ("Components: the catalog, one component, connecting your own, adding one only you have, deleting with undo", [("components", A.components_list), ("component-detail", A.component_detail), ("component-connect", A.component_connect), ("component-new", A.component_new), ("components-undo", A.components_undo)]),
    ("Direction: profile and voice, rules with pass rates, a rule tested before it's saved, undo on delete, exemplars", [("direction", B.direction), ("rules", B.rules), ("rule-edit", B.rule_edit), ("rules-undo", B.rules_undo), ("exemplars", B.exemplars)]),
    ("Reviews: the queue, one screen with its checks, ranking three options, a comment becoming a rule", [("reviews", B.reviews), ("review-surface", B.review_surface), ("review-rank", B.review_rank), ("review-rule", B.review_rule)]),
    ("Product: what screens may do and how risky it is, the journeys they serve, the paths people actually took", [("capabilities", B.capabilities), ("capability-edit", B.capability_edit), ("journeys", B.journeys), ("journey-edit", B.journey_edit), ("flow-map", B.flow_map)]),
    ("Releases: what changes and what it affects, a gradual rollout with guardrails, history and a way back", [("release-new", B.release_new), ("release-rollout", B.release_rollout), ("releases", B.releases), ("release-rollback", B.release_rollback)]),
    ("Insights: quality over time, what fails most, what people ask for that the product can't do", [("insights", B.insights)]),
    ("Settings: team and roles, invites, integrations, and a workspace that can be exported or deleted", [("team", B.team), ("team-invite", B.team_invite), ("integrations", B.integrations), ("workspace", B.workspace_settings), ("workspace-delete", B.workspace_delete)]),
]

os.makedirs("out/project", exist_ok=True)
boards, order, notes = {}, [], {}
y = 0
for r, (title, items) in enumerate(ROWS):
    x, row_h = 0, 0
    for name, fn in items:
        html = fn()
        w, h = map(int, re.search(r'<div style="width: (\d+)px; height: (\d+)px;', html).groups())
        fname = f"{name}.dc.html"
        open(f"out/project/{fname}", "w").write(html)
        boards[fname] = {"x": x, "y": y, "w": w, "h": h, "title": re.search(r"<title>(.*?)</title>", html).group(1)}
        order.append(fname)
        x += w + 80
        row_h = max(row_h, h)
    notes[f"row{r + 1}"] = {"x": 0, "y": y - 260, "text": title, "kind": "title1", "maxW": x - 80}
    y += row_h + 120 + 260

now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
canvas = {"v": 3, "createdOnFiles": {"v": 1, "at": now}, "title": "Polyxd Studio", "launch": {"view": "canvas"}, "pages": [], "boards": boards, "order": order, "notes": notes, "designSystems": []}
json.dump(canvas, open("out/project/canvas.json", "w"), indent=2)
print(len(boards), "artboards;", sum(os.path.getsize(f"out/project/{f}") for f in boards) // 1024, "KB")
