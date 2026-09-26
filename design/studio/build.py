"""Writes Polyxd Studio's artboards and canvas index to out/project/.

    python3 build.py            (Python 3.12 or later)

Artboards are as tall as their content: measure.mjs renders each one and records the height it
needs in heights.json, and the next build uses it.
"""
import json, os, re, datetime
import kit
if os.path.exists("heights.json"):
    kit.HEIGHTS.update(json.load(open("heights.json")))
import screens_a as A
import screens_b as B
import screens_c as C
import screens_ds as D

ROWS = [
    ("Sign up and sign in", [("sign-up", C.sign_up), ("verify-email", C.verify_email), ("sign-in", C.sign_in), ("sign-in-error", C.sign_in_error), ("sign-in-sso", C.sign_in_sso), ("two-factor", C.two_factor)]),
    ("Password, invites, signing out", [("forgot-password", C.forgot_password), ("reset-password", C.reset_password), ("invite-accept", C.invite_accept), ("session-expired", C.session_expired), ("signed-out", C.signed_out)]),
    ("Getting started", [("workspace-new", A.workspace_new), ("Main", A.home), ("workspace-switcher", C.workspace_switcher), ("user-menu", C.user_menu), ("notifications", C.notifications_panel), ("search", C.command_search)]),
    ("Your account", [("account-profile", C.account_profile), ("account-security", C.account_security), ("account-notifications", C.account_notifications)]),
    ("Design systems: import", [("ds-list", D.ds_list), ("ds-import", D.ds_import), ("ds-scan", D.ds_scan), ("ds-mapping", D.ds_mapping)]),
    ("Design systems: browse, edit, delete", [("ds-detail", D.ds_detail), ("ds-source", D.ds_source), ("ds-token-edit", D.ds_token_edit), ("ds-preview", D.ds_preview), ("ds-delete", D.ds_delete)]),
    ("Components", [("components", A.components_list), ("component-detail", A.component_detail), ("component-connect", A.component_connect), ("component-new", A.component_new), ("components-undo", A.components_undo)]),
    ("Patterns", [("patterns", C.patterns), ("pattern-detail", C.pattern_detail)]),
    ("Direction", [("direction", B.direction), ("rules", B.rules), ("rule-edit", B.rule_edit), ("rules-undo", B.rules_undo), ("rules-empty", C.rules_empty), ("exemplars", B.exemplars)]),
    ("Reviews", [("reviews", B.reviews), ("review-surface", B.review_surface), ("review-rank", B.review_rank), ("review-rule", B.review_rule), ("reviews-empty", C.reviews_empty)]),
    ("Capabilities and journeys", [("capabilities", B.capabilities), ("capability-edit", B.capability_edit), ("journeys", B.journeys), ("journey-edit", B.journey_edit), ("flow-map", B.flow_map)]),
    ("Releases", [("release-new", B.release_new), ("release-rollout", B.release_rollout), ("releases", B.releases), ("release-rollback", B.release_rollback)]),
    ("Insights", [("insights", B.insights)]),
    ("Workspace settings", [("team", B.team), ("team-invite", B.team_invite), ("integrations", B.integrations), ("workspace", B.workspace_settings), ("workspace-delete", B.workspace_delete)]),
    ("When something's missing", [("no-access", C.no_access), ("not-found", C.not_found)]),
]

# Frame names on the canvas: overlays share their page's <title>, so each gets its own.
FRAME = {
    "Main": "Home", "workspace-switcher": "Home · switch workspace", "user-menu": "Home · account menu", "notifications": "Home · notifications", "search": "Home · search",
    "session-expired": "Session expired", "ds-token-edit": "Design system · edit a token", "ds-delete": "Design systems · delete one in use",
    "ds-detail": "Design system · Polyxd roles", "ds-source": "Design system · your tokens", "component-connect": "Choice · connect your component",
    "components-undo": "Components · deleted, with undo", "rules-undo": "Rules · deleted, with undo", "review-rule": "Review · comment becomes a rule",
    "capability-edit": "Capabilities · edit", "release-rollout": "Release 15 · rollout", "release-rollback": "Releases · roll back",
    "team-invite": "Team · invite", "workspace-delete": "Workspace · delete",
}
os.makedirs("out/project", exist_ok=True)
for f in os.listdir("out/project"):
    if f.endswith(".dc.html"):
        os.remove(f"out/project/{f}")
boards, order, notes = {}, [], {}
y = 0
for r, (title, items) in enumerate(ROWS):
    x, row_h = 0, 0
    for name, fn in items:
        html = fn()
        w, h = map(int, re.search(r'<div style="width: (\d+)px; height: (\d+)px;', html).groups())
        fname = f"{name}.dc.html"
        open(f"out/project/{fname}", "w").write(html)
        boards[fname] = {"x": x, "y": y, "w": w, "h": h, "title": FRAME.get(name) or re.search(r"<title>(.*?)</title>", html).group(1)}
        order.append(fname)
        x += w + 80
        row_h = max(row_h, h)
    notes[f"row{r + 1}"] = {"x": 0, "y": y - 150, "text": f"{r + 1:02d} · {title}", "kind": "title1", "size": "l", "maxW": 1440}
    y += row_h + 120 + 150

# The canvas keeps the stamp from when it was first created from files.
now = "2026-09-26T19:56:32Z"
canvas = {"v": 3, "createdOnFiles": {"v": 1, "at": now}, "title": "Polyxd Studio", "launch": {"view": "canvas"}, "pages": [], "boards": boards, "order": order, "notes": notes, "designSystems": []}
json.dump(canvas, open("out/project/canvas.json", "w"), indent=2)
print(len(boards), "artboards;", sum(os.path.getsize(f"out/project/{f}") for f in boards) // 1024, "KB")
