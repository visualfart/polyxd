import json, re, os
import flows as F
import b2b as B

ROWS = [
    ("Send money: who, how much, confirm, done", [("Main", F.send_pick), ("send-amount", F.amount_screen), ("send-confirm", F.send_confirm_sheet), ("send-done", F.send_done), ("send-desktop", F.send_desktop), ("send-confirm-desktop", F.confirm_desktop)]),
    ("Delete: a typed check only for high-risk actions, undo for everyday ones", [("delete-account", F.delete_mobile), ("delete-low-risk", F.delete_low_risk), ("delete-account-desktop", F.delete_desktop)]),
    ("Browse and filter: search, chips, sheet on mobile, sidebar on desktop, grid", [("browse", F.browse_mobile), ("browse-filters", F.browse_sheet), ("browse-desktop", F.browse_desktop)]),
    ("Compare plans: one recommendation, grouped features", [("compare", F.compare_mobile), ("compare-desktop", F.compare_desktop)]),
    ("Check your booking: summary first, agreement next to the button", [("hotel", F.hotel_mobile), ("hotel-desktop", F.hotel_desktop)]),
    ("Add a task: the basics first, the rest on request", [("task", lambda: F.task_mobile(False)), ("task-more", lambda: F.task_mobile(True)), ("task-desktop", F.task_desktop)]),
    ("Notifications: grouped by what they're about, in plain language", [("notifications", F.notify_mobile), ("notifications-desktop", F.notify_desktop)]),
    ("Find a time: who first, then when everyone's free", [("find-time", F.find_mobile), ("find-time-desktop", F.find_desktop)]),
    ("Reading list: an encouraging empty state, then progress", [("reading-empty", F.reading_empty), ("reading-list", F.reading_list), ("reading-desktop", F.reading_desktop)]),
    ("B2B lists: app shell, saved views, filters, sortable table, bulk actions, pagination; rows on phones", [("b2b-accounts", B.accounts_list), ("b2b-selected", B.accounts_selected), ("b2b-phone", B.accounts_phone)]),
    ("B2B records: record page with tabs and activity, create in a side panel over the list", [("b2b-account", B.account_detail), ("b2b-new", B.account_panel)]),
    ("B2B overview and settings: KPIs, chart, what needs attention; label-left settings rows", [("b2b-overview", B.overview), ("b2b-settings", B.settings)]),
    ("Density: one Design Direction setting, three row heights", [("b2b-density", B.density)]),
]

os.makedirs("out/project", exist_ok=True)
boards, order, notes = {}, [], {}
y = 0
for r, (title, items) in enumerate(ROWS):
    x = 0
    row_h = 0
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

canvas = {"v": 3, "createdOnFiles": {"v": 1, "at": "2026-09-20T05:10:00Z"}, "title": "Polyxd flow designs", "launch": {"view": "canvas"}, "pages": [], "boards": boards, "order": order, "notes": notes, "designSystems": []}
json.dump(canvas, open("out/project/canvas.json", "w"), indent=2)
print(len(boards), "artboards;", sum(os.path.getsize(f"out/project/{f}") for f in boards) // 1024, "KB")
for f in order: print(f, boards[f]["w"], boards[f]["h"])
