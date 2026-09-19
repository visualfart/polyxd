"""Dense B2B screens (Carbon g10 values): app shell, data tables, bulk actions, record pages, side-panel forms, dashboards, settings."""
from kit import ICONS, icon

K = dict(
    bg="#FFFFFF", layer="#F4F4F4", layer2="#E8E8E8", border="#E0E0E0", border_strong="#8D8D8D",
    text="#161616", text2="#525252", placeholder="#6F6F6F", link="#0F62FE", interactive="#0F62FE",
    hover="#E5E5E5", selected="#E0E0E0", shell="#161616", shell_text="#F4F4F4", shell_2="#393939",
    error="#DA1E28", success="#24A148", warn="#F1C21B", highlight="#EDF5FF",
)
TAG = {
    "green": ("#A7F0BA", "#0E6027"), "blue": ("#D0E2FF", "#0043CE"), "gray": ("#E0E0E0", "#161616"),
    "red": ("#FFD7D9", "#A2191F"), "purple": ("#E8DAFF", "#6929C4"), "yellow": ("#FCF4D6", "#483700"),
    "teal": ("#9EF0F0", "#004144"),
}
FONT = "'IBM Plex Sans', system-ui, -apple-system, sans-serif"
CUR = ' aria-current="page"'
MONO = "'IBM Plex Mono', ui-monospace, monospace"

ICONS.update({
    "menu": '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    "help": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7"/><path d="M12 17h.01"/>',
    "dots": '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    "columns": '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16"/><path d="M15 4v16"/>',
    "download": '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    "filter": '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    "dash": '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    "building": '<rect x="4" y="3" width="16" height="18"/><path d="M9 7h1"/><path d="M14 7h1"/><path d="M9 11h1"/><path d="M14 11h1"/><path d="M10 21v-4h4v4"/>',
    "receipt": '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6"/><path d="M9 12h6"/>',
    "repeat": '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    "card": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    "gear": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    "contact": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "sort_up": '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
    "sort_both": '<path d="M8 9l4-4 4 4"/><path d="M8 15l4 4 4-4"/>',
    "edit": '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    "chev_l": '<path d="M15 18l-6-6 6-6"/>',
    "send": '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    "density": '<path d="M4 6h16"/><path d="M4 10h16"/><path d="M4 14h16"/><path d="M4 18h16"/>',
    "key": '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2"/><path d="M16 7l3 3"/>',
    "plug": '<path d="M9 2v6"/><path d="M15 2v6"/><path d="M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v4"/>',
})


def ic(name, size=16, color="currentColor", sw=1.75):
    return icon(name, size, color, sw)


def doc(title, w, h, body, bg=None):
    bg = bg or K["bg"]
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0;font-family:{FONT};color:{K['text']};background:{bg}}}
a{{color:{K['link']};text-decoration:none}}a:hover{{text-decoration:underline}}
table{{border-collapse:collapse}}
</style>
</helmet>
<div style="width: {w}px; height: {h}px; box-sizing: border-box; overflow: hidden; background: {bg}; color: {K['text']}; font-family: {FONT}; font-size: 14px; line-height: 18px; letter-spacing: 0.16px; display: flex; flex-direction: column;">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
"""


# ---------- atoms ----------

def tag(label, tone="gray"):
    bg, fg = TAG[tone]
    return f'<span style="display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 12px; background: {bg}; color: {fg}; font-size: 12px; line-height: 16px; white-space: nowrap;">{label}</span>'


def btn(label, kind="primary", icon_name=None, h=40, w=None, only_icon=False, danger=False):
    bg, fg, border = {
        "primary": (K["error"] if danger else K["interactive"], "#FFFFFF", "transparent"),
        "secondary": ("#393939", "#FFFFFF", "transparent"),
        "tertiary": ("transparent", K["interactive"], K["interactive"]),
        "ghost": ("transparent", K["error"] if danger else K["link"], "transparent"),
        "ghost_plain": ("transparent", K["text"], "transparent"),
        "on_blue": ("transparent", "#FFFFFF", "transparent"),
    }[kind]
    ic_html = ic(icon_name, 16) if icon_name else ""
    if only_icon:
        return f'<button type="button" aria-label="{label}" title="{label}" style="width: {h}px; height: {h}px; flex-shrink: 0; border: 0; background: {bg}; color: {fg}; display: inline-flex; align-items: center; justify-content: center; padding: 0;">{ic_html}</button>'
    width = f" width: {w}px;" if w else ""
    pad = "0 16px" if kind.startswith("ghost") or kind == "on_blue" else "0 16px 0 16px"
    justify = "space-between" if (icon_name and kind in ("primary", "secondary", "tertiary") and w) else "flex-start"
    gap = "32px" if kind in ("primary", "secondary", "tertiary") and icon_name else "8px"
    order = f"<span>{label}</span>{ic_html}" if kind in ("primary", "secondary", "tertiary") else f"{ic_html}<span>{label}</span>"
    return f'<button type="button" style="height: {h}px;{width} flex-shrink: 0; box-sizing: border-box; padding: {pad}; border: 1px solid {border}; background: {bg}; color: {fg}; font-family: {FONT}; font-size: 14px; letter-spacing: 0.16px; display: inline-flex; align-items: center; justify-content: {justify}; gap: {gap}; white-space: nowrap;">{order}</button>'


def avatar(initials, tone="blue", size=24):
    bg, fg = TAG[tone]
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; border-radius: 50%; background: {bg}; color: {fg}; display: inline-flex; align-items: center; justify-content: center; font-size: {max(10, int(size * 0.42))}px; font-weight: 600;">{initials}</span>'


def checkbox(on=False, mixed=False, label="Select row"):
    if on or mixed:
        mark = '<path d="M6 12h12"/>' if mixed else ICONS["check"]
        return f'<span role="checkbox" aria-checked="{"mixed" if mixed else "true"}" aria-label="{label}" style="width: 16px; height: 16px; flex-shrink: 0; border-radius: 2px; vertical-align: middle; background: {K["text"]}; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{mark}</svg></span>'
    return f'<span role="checkbox" aria-checked="false" aria-label="{label}" style="display: inline-block; vertical-align: middle; width: 16px; height: 16px; flex-shrink: 0; box-sizing: border-box; border-radius: 2px; border: 1px solid {K["text"]};"></span>'


def text_input(label, value="", placeholder="", help_text=None, w=None, select=False, prefix=None, invalid=None, h=40, bg=None):
    bg = bg or K["layer"]
    val = value if value else f'<span style="color: {K["placeholder"]};">{placeholder}</span>'
    pre = f'<span style="color: {K["text2"]};">{prefix}</span>' if prefix else ""
    trail = f'<span style="color: {K["text"]}; display: flex;">{ic("chev_d", 16)}</span>' if select else ""
    width = f"width: {w}px;" if w else ""
    border = f"2px solid {K['error']}" if invalid else f"1px solid {K['border_strong']}"
    helper = ""
    if invalid:
        helper = f'<div style="font-size: 12px; line-height: 16px; color: {K["error"]};">{invalid}</div>'
    elif help_text:
        helper = f'<div style="font-size: 12px; line-height: 16px; color: {K["text2"]};">{help_text}</div>'
    lab = f'<div style="font-size: 12px; line-height: 16px; color: {K["text2"]};">{label}</div>' if label else ""
    return f'<div style="{width} display: flex; flex-direction: column; gap: 8px; min-width: 0;">{lab}<div style="height: {h}px; box-sizing: border-box; padding: 0 16px; background: {bg}; border-bottom: {border}; display: flex; align-items: center; gap: 8px;">{pre}<span style="flex-grow: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">{val}</span>{trail}</div>{helper}</div>'


# ---------- shell ----------

NAV = [
    (None, [("dash", "Overview", None)]),
    ("Customers", [("building", "Accounts", None), ("contact", "Contacts", None)]),
    ("Billing", [("receipt", "Invoices", "12"), ("repeat", "Subscriptions", None), ("card", "Payments", None)]),
    (None, [("gear", "Settings", None)]),
]


def shell_header(product="Northwind", section="Billing"):
    return f"""<header style="height: 48px; flex-shrink: 0; background: {K['shell']}; color: {K['shell_text']}; display: flex; align-items: center; border-bottom: 1px solid {K['shell_2']};">
<span style="padding: 0 16px 0 16px; font-size: 14px; line-height: 18px;"><span style="font-weight: 600;">{product}</span> <span style="color: #C6C6C6;">{section}</span></span>
<div style="margin-left: 32px; width: 420px; height: 32px; box-sizing: border-box; padding: 0 12px; background: {K['shell_2']}; display: flex; align-items: center; gap: 10px; color: #C6C6C6;">{ic('search', 16)}<span>Search accounts, invoices, people</span><span style="margin-left: auto; font-family: {MONO}; font-size: 12px; border: 1px solid #6F6F6F; padding: 0 4px;">/</span></div>
<div style="margin-left: auto; display: flex; align-items: center;">
{btn('Help', 'on_blue', 'help', h=48, only_icon=True)}
<span style="position: relative; display: inline-flex;">{btn('Notifications, 3 new', 'on_blue', 'bell', h=48, only_icon=True)}<span style="position: absolute; top: 12px; right: 12px; width: 8px; height: 8px; border-radius: 50%; background: {K['error']};"></span></span>
<span style="width: 48px; height: 48px; display: inline-flex; align-items: center; justify-content: center;">{avatar('RM', 'purple', 28)}</span>
</div>
</header>"""


def side_nav(active="Accounts", w=224):
    out = []
    for group, items in NAV:
        if group:
            out.append(f'<div style="padding: 20px 16px 6px; font-size: 12px; line-height: 16px; color: {K["text2"]};">{group}</div>')
        else:
            out.append('<div style="height: 8px;"></div>')
        for icon_name, label, badge in items:
            on = label == active
            b = f'<span style="margin-left: auto; min-width: 20px; height: 18px; padding: 0 6px; box-sizing: border-box; border-radius: 9px; background: {K["error"]}; color: #FFFFFF; font-size: 12px; line-height: 18px; text-align: center;" aria-label="{badge} overdue">{badge}</span>' if badge else ""
            style = f"background: {K['selected']}; border-left: 3px solid {K['interactive']}; padding-left: 13px; font-weight: 600;" if on else f"border-left: 3px solid transparent; padding-left: 13px; color: {K['text2']};"
            out.append(f'<a href="#"{CUR if on else ""} style="height: 32px; box-sizing: border-box; padding-right: 16px; display: flex; align-items: center; gap: 12px; color: {K["text"]}; text-decoration: none; {style}">{ic(icon_name, 16)}<span>{label}</span>{b}</a>')
    return f'<nav aria-label="Main" style="width: {w}px; flex-shrink: 0; background: {K["bg"]}; border-right: 1px solid {K["border"]}; display: flex; flex-direction: column;">{"".join(out)}<div style="margin-top: auto; padding: 12px 16px; border-top: 1px solid {K["border"]}; font-size: 12px; color: {K["text2"]};">Acme Workspace · Admin</div></nav>'


def app(title, body, active="Accounts", w=1440, h=900, bg=None):
    return doc(title, w, h, f"""{shell_header()}
<div style="flex-grow: 1; min-height: 0; display: flex;">
{side_nav(active)}
<main style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; background: {bg or K['bg']}; position: relative;">
{body}
</main>
</div>""")


def page_header(title, crumbs=None, meta=None, actions="", tabs=None, lead=None, badge=None, pad="16px 32px 0"):
    c = ""
    if crumbs:
        parts = " ".join(f'<a href="#">{x}</a><span style="color: {K["text2"]};">/</span>' for x in crumbs)
        c = f'<nav aria-label="Breadcrumb" style="display: flex; gap: 8px; font-size: 12px; line-height: 16px; margin-bottom: 8px;">{parts}</nav>'
    m = f'<div style="margin-top: 4px; font-size: 14px; color: {K["text2"]};">{meta}</div>' if meta else ""
    t = ""
    if tabs:
        cells = []
        for label, on in tabs:
            st = f"border-bottom: 2px solid {K['interactive']}; font-weight: 600; color: {K['text']};" if on else f"border-bottom: 2px solid {K['border']}; color: {K['text2']};"
            cells.append(f'<button type="button" role="tab" aria-selected="{"true" if on else "false"}" style="height: 40px; padding: 0 16px; border: 0; background: transparent; font-family: {FONT}; font-size: 14px; {st}">{label}</button>')
        t = f'<div role="tablist" style="display: flex; margin-top: 16px;">{"".join(cells)}<span style="flex-grow: 1; border-bottom: 2px solid {K["border"]};"></span></div>'
    b = f" {badge}" if badge else ""
    l = lead or ""
    return f"""<div style="flex-shrink: 0; padding: {pad}; {'' if tabs else 'padding-bottom: 16px;'}">
{c}<div style="display: flex; align-items: flex-start; gap: 16px;"><div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex-grow: 1;">{l}<div style="min-width: 0;"><h1 style="margin: 0; font-size: 28px; line-height: 36px; font-weight: 400; display: flex; align-items: center; gap: 12px;">{title}{b}</h1>{m}</div></div><div style="display: flex; gap: 1px; align-items: center;">{actions}</div></div>
{t}
</div>"""


# ---------- data table ----------

ACCOUNTS = [
    ("Acme Corp", "AC", "blue", "Rhea M.", "Enterprise", "£4,200", "48 / 50", ("Past due", "red"), "12 Oct 2026"),
    ("Globex", "GL", "teal", "Tom W.", "Pro", "£1,180", "22 / 25", ("Active", "green"), "03 Nov 2026"),
    ("Initech", "IN", "purple", "Rhea M.", "Pro", "£940", "18 / 20", ("Active", "green"), "21 Oct 2026"),
    ("Umbrella Health", "UH", "red", "Sam P.", "Enterprise", "£6,750", "120 / 120", ("Active", "green"), "30 Jan 2027"),
    ("Hooli", "HO", "yellow", "Jo R.", "Starter", "£120", "3 / 5", ("Trial", "blue"), "27 Sep 2026"),
    ("Stark Logistics", "SL", "gray", "Tom W.", "Pro", "£1,560", "30 / 30", ("Active", "green"), "14 Dec 2026"),
    ("Wayne Retail", "WR", "blue", "Sam P.", "Enterprise", "£3,900", "64 / 80", ("Renewing", "purple"), "02 Oct 2026"),
    ("Vandelay Imports", "VI", "teal", "Jo R.", "Starter", "£90", "2 / 5", ("Trial", "blue"), "25 Sep 2026"),
    ("Soylent", "SO", "purple", "Rhea M.", "Pro", "£1,020", "19 / 25", ("Past due", "red"), "18 Oct 2026"),
    ("Pied Piper", "PP", "red", "Tom W.", "Pro", "£780", "11 / 15", ("Active", "green"), "09 Nov 2026"),
    ("Cyberdyne", "CY", "gray", "Sam P.", "Enterprise", "£5,400", "96 / 100", ("Active", "green"), "05 Mar 2027"),
    ("Massive Dynamic", "MD", "yellow", "Jo R.", "Pro", "£1,320", "24 / 25", ("Cancelled", "gray"), "—"),
    ("Tyrell", "TY", "blue", "Rhea M.", "Enterprise", "£4,860", "70 / 75", ("Active", "green"), "19 Feb 2027"),
    ("Oscorp", "OS", "teal", "Tom W.", "Pro", "£1,110", "20 / 25", ("Active", "green"), "28 Nov 2026"),
    ("Nakatomi", "NA", "purple", "Sam P.", "Starter", "£150", "4 / 5", ("Trial", "blue"), "30 Sep 2026"),
    ("Gringotts", "GR", "red", "Jo R.", "Enterprise", "£7,200", "140 / 150", ("Active", "green"), "11 Apr 2027"),
]

COLS = [("Account", "left", None, True), ("Owner", "left", 130, True), ("Plan", "left", 130, True), ("MRR", "right", 110, True), ("Seats", "right", 100, False), ("Status", "left", 120, True), ("Renews", "left", 130, True)]


def th(label, align, w, sortable, sorted_=None):
    arrow = ""
    if sortable:
        arrow = ic("sort_up", 16) if sorted_ == "asc" else ic("sort_both", 14, K["text2"])
    aria = f' aria-sort="{"ascending" if sorted_ == "asc" else "none"}"' if sortable else ""
    just = "flex-end" if align == "right" else "flex-start"
    inner = f'<span style="display: inline-flex; align-items: center; gap: 6px; justify-content: {just}; width: 100%;">{"" if align != "right" else arrow}{label}{arrow if align != "right" else ""}</span>'
    width = f"width: {w}px; " if w else ""
    return f'<th scope="col"{aria} style="{width}height: 40px; padding: 0 16px; text-align: {align}; font-weight: 600; font-size: 14px; background: {K["selected"]}; white-space: nowrap;">{inner}</th>'


def account_table(rows, selected=(), row_h=40, sort="MRR", show_select=True, cols=COLS, highlight=None):
    head = ""
    if show_select:
        all_sel = len(selected) == len(rows)
        head += f'<th scope="col" style="width: 48px; background: {K["selected"]}; padding: 0 0 0 16px;">{checkbox(all_sel, mixed=bool(selected) and not all_sel, label="Select all rows")}</th>'
    for label, align, w, sortable in cols:
        head += th(label, align, w, sortable, "asc" if label == sort else None)
    head += f'<th scope="col" style="width: 48px; background: {K["selected"]};"><span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);">Actions</span></th>'
    body = []
    for i, r in enumerate(rows):
        name, ini, tone, owner, plan, mrr, seats, status, renew = r
        on = i in selected
        bg = K["selected"] if on else (K["highlight"] if highlight == i else K["bg"])
        cells = ""
        if show_select:
            cells += f'<td style="padding: 0 0 0 16px;">{checkbox(on, label="Select " + name)}</td>'
        full = seats.split(" / ")[0] == seats.split(" / ")[1] if "/" in seats else False
        vals = {
            "Account": f'<span style="display: inline-flex; align-items: center; gap: 10px;">{avatar(ini, tone, 24)}<a href="#" style="color: {K["text"]}; font-weight: 500;">{name}</a></span>',
            "Owner": owner, "Plan": plan, "MRR": mrr,
            "Seats": f'<span style="{"color: " + K["error"] + ";" if full else ""}">{seats}</span>',
            "Status": tag(*status), "Renews": renew,
        }
        for label, align, w, _ in cols:
            v = vals[label]
            num = "font-variant-numeric: tabular-nums;" if align == "right" or label == "Renews" else ""
            cells += f'<td style="padding: 0 16px; text-align: {align}; white-space: nowrap; {num}">{v}</td>'
        cells += f'<td style="text-align: center;">{btn("Actions for " + name, "ghost_plain", "dots", h=row_h, only_icon=True)}</td>'
        body.append(f'<tr aria-selected="{"true" if on else "false"}" style="height: {row_h}px; background: {bg}; border-bottom: 1px solid {K["border"]};">{cells}</tr>')
    return f'<table style="width: 100%; table-layout: auto; font-size: 14px;"><thead style="position: sticky; top: 0;"><tr style="position: relative;">{head}</tr></thead><tbody>{"".join(body)}</tbody></table>'


def toolbar(chips=True, search="Search accounts"):
    ch = ""
    if chips:
        ch = f"""<div style="display: flex; gap: 8px; align-items: center;">
<button type="button" style="height: 32px; padding: 0 12px; border: 1px solid {K['border_strong']}; background: {K['bg']}; font-family: {FONT}; font-size: 14px; display: inline-flex; gap: 8px; align-items: center;">{ic('filter', 16)}Filters</button>
{filter_tag('Status: Active, Past due')}{filter_tag('Owner: Rhea M.')}
<a href="#" style="font-size: 14px; margin-left: 4px;">Clear filters</a></div>"""
    return f"""<div role="toolbar" aria-label="Table tools" style="height: 48px; flex-shrink: 0; display: flex; align-items: center; background: {K['layer']}; ">
<div style="width: 320px; height: 48px; box-sizing: border-box; padding: 0 16px; display: flex; align-items: center; gap: 12px; color: {K['text2']}; border-right: 1px solid {K['border']};">{ic('search', 16)}<span style="color: {K['placeholder']};">{search}</span></div>
<div style="padding: 0 16px; flex-grow: 1; min-width: 0;">{ch}</div>
{btn('Row height', 'ghost_plain', 'density', h=48, only_icon=True)}{btn('Columns', 'ghost_plain', 'columns', h=48, only_icon=True)}{btn('Export CSV', 'ghost_plain', 'download', h=48, only_icon=True)}
{btn('New account', 'primary', 'plus', h=48)}
</div>"""


def filter_tag(label):
    bg, fg = TAG["blue"]
    return f'<span style="height: 24px; padding: 0 4px 0 10px; border-radius: 12px; background: {bg}; color: {fg}; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">{label}<button type="button" aria-label="Remove filter {label}" style="width: 20px; height: 20px; border: 0; border-radius: 50%; background: transparent; color: {fg}; display: inline-flex; align-items: center; justify-content: center; padding: 0;">{ic("close", 12)}</button></span>'


def batch_bar(n, actions):
    acts = "".join(btn(label, "primary", icon_name, h=48) for label, icon_name in actions)
    return f"""<div role="toolbar" aria-label="Actions for {n} selected" style="height: 48px; flex-shrink: 0; display: flex; align-items: center; background: {K['interactive']}; color: #FFFFFF;">
<span style="padding: 0 16px; flex-grow: 1;" aria-live="polite">{n} accounts selected</span>{acts}
<span style="width: 1px; height: 16px; background: rgba(255,255,255,0.5);"></span>
{btn('Cancel', 'primary', None, h=48)}
</div>"""


def pagination(start=1, end=16, total="1,284", pages=81):
    return f"""<div style="height: 40px; flex-shrink: 0; display: flex; align-items: center; border-top: 1px solid {K['border']}; background: {K['layer']}; font-size: 14px;">
<span style="padding: 0 16px; color: {K['text2']};">Rows per page</span><span style="display: inline-flex; align-items: center; gap: 8px; padding-right: 16px; border-right: 1px solid {K['border']}; height: 40px;">50 {ic('chev_d', 16)}</span>
<span style="padding: 0 16px; font-variant-numeric: tabular-nums; flex-grow: 1;">{start}–{end} of {total} accounts</span>
<span style="padding: 0 16px; border-left: 1px solid {K['border']}; height: 40px; display: inline-flex; align-items: center; gap: 8px;">Page 1 {ic('chev_d', 16)} <span style="color: {K['text2']};">of {pages}</span></span>
<span style="border-left: 1px solid {K['border']}; display: inline-flex;">{btn('Previous page', 'ghost_plain', 'chev_l', h=40, only_icon=True)}</span><span style="border-left: 1px solid {K['border']}; display: inline-flex;">{btn('Next page', 'ghost_plain', 'chev_r', h=40, only_icon=True)}</span>
</div>"""


# ---------- screens ----------

def accounts_list():
    body = f"""{page_header('Accounts', crumbs=['Customers'], meta='1,284 accounts · £312,480 MRR', actions=btn('Import', 'tertiary', 'upload'), pad='16px 32px 0')}
<div style="padding: 0 32px; display: flex; gap: 0; margin-bottom: 16px;">{views_tabs()}</div>
<div style="margin: 0 32px; flex-grow: 1; min-height: 0; display: flex; flex-direction: column; border: 1px solid {K['border']};">
{toolbar()}
<div style="flex-grow: 1; min-height: 0; overflow: hidden;">{account_table(ACCOUNTS[:15])}</div>
{pagination(1, 50)}
</div>
<div style="height: 24px;"></div>"""
    return app("Accounts: table with filters", body)


def views_tabs():
    views = [("All accounts", "1,284", True), ("Mine", "212", False), ("Past due", "31", False), ("Renewing in 30 days", "46", False), ("Trials", "58", False)]
    out = []
    for label, n, on in views:
        st = f"border-bottom: 2px solid {K['interactive']}; font-weight: 600;" if on else f"border-bottom: 2px solid {K['border']}; color: {K['text2']};"
        out.append(f'<button type="button" role="tab" aria-selected="{"true" if on else "false"}" style="height: 40px; padding: 0 16px; border: 0; background: transparent; font-family: {FONT}; font-size: 14px; display: inline-flex; align-items: center; gap: 8px; {st}">{label}<span style="font-size: 12px; color: {K["text2"]}; font-weight: 400; font-variant-numeric: tabular-nums;">{n}</span></button>')
    out.append(f'<button type="button" style="height: 40px; padding: 0 12px; border: 0; border-bottom: 2px solid {K["border"]}; background: transparent; color: {K["link"]}; font-family: {FONT}; font-size: 14px; display: inline-flex; align-items: center; gap: 6px;">{ic("plus", 16)}Save view</button>')
    out.append(f'<span style="flex-grow: 1; border-bottom: 2px solid {K["border"]};"></span>')
    return f'<div role="tablist" aria-label="Saved views" style="display: flex; width: 100%;">{"".join(out)}</div>'


def accounts_selected():
    sel = (0, 2, 8)
    body = f"""{page_header('Accounts', crumbs=['Customers'], meta='1,284 accounts · £312,480 MRR', actions=btn('Import', 'tertiary', 'upload'))}
<div style="padding: 0 32px; margin-bottom: 16px;">{views_tabs()}</div>
<div style="margin: 0 32px; flex-grow: 1; min-height: 0; display: flex; flex-direction: column; border: 1px solid {K['border']};">
{batch_bar(3, [('Assign owner', 'contact'), ('Send reminder', 'send'), ('Export', 'download'), ('Cancel subscriptions', 'trash')])}
<div style="flex-grow: 1; min-height: 0; overflow: hidden;">{account_table(ACCOUNTS[:15], selected=sel)}</div>
{pagination(1, 50)}
</div>
<div style="height: 24px;"></div>"""
    return app("Accounts: 3 selected, bulk actions", body)


def kpi(label, value, delta=None, tone=None, sub=None):
    d = ""
    if delta:
        color = {"up": K["success"], "down": K["error"], None: K["text2"]}[tone]
        d = f'<span style="font-size: 12px; color: {color};">{delta}</span>'
    s = f'<div style="font-size: 12px; color: {K["text2"]};">{sub}</div>' if sub else ""
    return f'<div style="flex: 1; min-width: 0; padding: 16px; background: {K["layer"]}; display: flex; flex-direction: column; gap: 6px;"><div style="font-size: 12px; color: {K["text2"]};">{label}</div><div style="display: flex; align-items: baseline; gap: 8px;"><span style="font-size: 28px; line-height: 36px; font-variant-numeric: tabular-nums;">{value}</span>{d}</div>{s}</div>'


def inline_notice(title, text, action, tone="warn"):
    bar = {"warn": K["warn"], "error": K["error"], "info": K["interactive"]}[tone]
    bg = {"warn": "#FCF4D6", "error": "#FFF1F1", "info": "#EDF5FF"}[tone]
    return f'<div role="status" style="display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 0 0 13px; border-left: 3px solid {bar}; background: {bg}; outline: 1px solid rgba(0,0,0,0.08); outline-offset: -1px;"><span style="color: #8E6A00; display: flex;">{ic("alert", 18)}</span><div style="flex-grow: 1; padding: 12px 0;"><b style="font-weight: 600;">{title}</b> {text}</div>{btn(action, "ghost", None, h=40)}</div>'


def dl_grid(items, cols=3):
    cells = "".join(f'<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;"><dt style="font-size: 12px; color: {K["text2"]};">{k}</dt><dd style="margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{v}</dd></div>' for k, v in items)
    return f'<dl style="margin: 0; display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: 16px 24px;">{cells}</dl>'


def small_table(head, rows, aligns):
    h = "".join(f'<th scope="col" style="height: 32px; padding: 0 12px; text-align: {a}; font-weight: 600; background: {K["selected"]}; font-size: 12px;">{x}</th>' for x, a in zip(head, aligns))
    b = "".join("<tr style=\"height: 32px; border-bottom: 1px solid " + K["border"] + ";\">" + "".join(f'<td style="padding: 0 12px; text-align: {a}; white-space: nowrap; font-variant-numeric: tabular-nums;">{c}</td>' for c, a in zip(r, aligns)) + "</tr>" for r in rows)
    return f'<table style="width: 100%; font-size: 14px;"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'


def section_head(title, action=None):
    a = f'<a href="#" style="font-size: 14px;">{action}</a>' if action else ""
    return f'<div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px;"><h2 style="margin: 0; font-size: 16px; line-height: 22px; font-weight: 600;">{title}</h2>{a}</div>'


def timeline(items):
    out = []
    for when, who, what, tone in items:
        out.append(f'<li style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid {K["border"]};"><span style="margin-top: 5px; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: {TAG[tone][1]};"></span><div style="min-width: 0;"><div>{what}</div><div style="font-size: 12px; color: {K["text2"]};">{who} · {when}</div></div></li>')
    return f'<ol style="list-style: none; margin: 0; padding: 0;">{"".join(out)}</ol>'


def account_detail():
    actions = btn("Edit", "tertiary", "edit") + '<span style="width: 8px;"></span>' + btn("Record payment", "primary", "plus") + btn("More actions", "ghost_plain", "dots", only_icon=True)
    header = page_header("Acme Corp", crumbs=["Customers", "Accounts"], meta="Enterprise · acme.com · Customer since March 2023", actions=actions,
                         tabs=[("Overview", True), ("Invoices 12", False), ("Subscriptions 2", False), ("Seats 48", False), ("Activity", False)],
                         lead=avatar("AC", "blue", 48), badge=tag("Past due", "red"))
    invoices = small_table(["Invoice", "Issued", "Due", "Amount", "Status"],
                           [["<a href='#'>INV-2041</a>", "01 Sep 2026", "15 Sep 2026", "£1,250.00", tag("Overdue 5 days", "red")],
                            ["<a href='#'>INV-1987</a>", "01 Aug 2026", "15 Aug 2026", "£4,200.00", tag("Paid", "green")],
                            ["<a href='#'>INV-1932</a>", "01 Jul 2026", "15 Jul 2026", "£4,200.00", tag("Paid", "green")],
                            ["<a href='#'>INV-1880</a>", "01 Jun 2026", "15 Jun 2026", "£4,200.00", tag("Paid", "green")]],
                           ["left", "left", "left", "right", "left"])
    body = f"""{header}
<div style="flex-grow: 1; min-height: 0; display: flex; gap: 32px; padding: 24px 32px; background: {K['bg']};">
<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 24px;">
{inline_notice('INV-2041 is 5 days overdue.', 'Acme has paid on time for 18 months; a reminder usually settles it.', 'Send reminder')}
<div style="display: flex; gap: 1px;">{kpi('MRR', '£4,200', '+£600 since June', 'up')}{kpi('Seats used', '48 of 50', None, None, '2 left before the next tier')}{kpi('Outstanding', '£1,250', '1 invoice', 'down')}{kpi('Health', '82', None, None, 'Usage up 12% this month')}</div>
<section>{section_head('Details', 'Edit details')}{dl_grid([('Legal name', 'Acme Corporation Ltd'), ('Billing email', 'ap@acme.com'), ('VAT number', 'GB 123 4567 89'), ('Owner', '<span style="display: inline-flex; gap: 8px; align-items: center;">' + avatar('RM', 'purple', 20) + 'Rhea Mills</span>'), ('Payment method', 'Visa ending 4242'), ('Currency', 'GBP'), ('Plan', 'Enterprise, annual'), ('Renews', '12 Oct 2026'), ('Region', 'EU (Frankfurt)')])}</section>
<section>{section_head('Recent invoices', 'All 12 invoices')}{invoices}</section>
</div>
<aside aria-label="Activity" style="width: 340px; flex-shrink: 0;">
{section_head('Activity')}
<div style="display: flex; gap: 8px; margin-bottom: 8px;">{text_input(None, placeholder='Add a note', w=340)}</div>
{timeline([('2 hours ago', 'System', 'Payment of £1,250 failed: card declined', 'red'), ('Yesterday', 'Rhea Mills', 'Added 6 seats (42 → 48)', 'blue'), ('3 Sep', 'Rhea Mills', 'Note: procurement moving to new AP team in October', 'gray'), ('1 Sep', 'System', 'Invoice INV-2041 issued', 'gray'), ('14 Aug', 'System', 'Invoice INV-1987 paid', 'green'), ('2 Aug', 'Tom Walsh', 'Upgraded Pro → Enterprise', 'purple')])}
</aside>
</div>"""
    return app("Account: record page", body)


def account_panel():
    """New account in a side panel over the table: the list stays visible, the form is dense and grouped."""
    dim = f'<div style="position: absolute; inset: 0; background: rgba(22,22,22,0.5);"></div>'
    form = f"""<aside role="dialog" aria-modal="true" aria-labelledby="np-title" style="position: absolute; top: 0; right: 0; bottom: 0; width: 560px; background: {K['bg']}; display: flex; flex-direction: column; box-shadow: -2px 0 12px rgba(0,0,0,0.3);">
<div style="padding: 16px 16px 16px 24px; display: flex; align-items: flex-start; border-bottom: 1px solid {K['border']};"><div style="flex-grow: 1;"><div style="font-size: 12px; color: {K['text2']};">Accounts</div><h2 id="np-title" style="margin: 2px 0 0; font-size: 20px; line-height: 28px; font-weight: 400;">New account</h2></div>{btn('Close', 'ghost_plain', 'close', h=40, only_icon=True)}</div>
<div style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 24px; display: flex; flex-direction: column; gap: 28px;">
<fieldset style="border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px;"><legend style="padding: 0; margin-bottom: 16px; font-size: 14px; font-weight: 600;">Company</legend>
{text_input('Company name', 'Northwind Traders')}
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">{text_input('Website', 'northwind.co')}{text_input('Region', 'EU (Frankfurt)', select=True)}</div>
</fieldset>
<fieldset style="border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px;"><legend style="padding: 0; margin-bottom: 16px; font-size: 14px; font-weight: 600;">Billing</legend>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">{text_input('Plan', 'Pro, monthly', select=True)}{text_input('Seats', '25', help_text='£47 per seat per month')}</div>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">{text_input('Billing email', 'ap@northwind', invalid='Enter an email like name@company.com')}{text_input('Currency', 'GBP', select=True)}</div>
</fieldset>
<fieldset style="border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px;"><legend style="padding: 0; margin-bottom: 16px; font-size: 14px; font-weight: 600;">Ownership</legend>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">{text_input('Account owner', '<span style="display: inline-flex; gap: 8px; align-items: center;">' + avatar('RM', 'purple', 20) + 'Rhea Mills</span>', select=True)}{text_input('Start date', '01 Oct 2026', help_text='First invoice on this date')}</div>
</fieldset>
<div style="padding: 12px 16px; background: {K['layer']}; display: flex; justify-content: space-between; font-variant-numeric: tabular-nums;"><span style="color: {K['text2']};">First invoice</span><span><b style="font-weight: 600;">£1,175.00</b> <span style="color: {K['text2']};">on 01 Oct 2026</span></span></div>
</div>
<div style="display: flex; flex-shrink: 0;">{btn('Cancel', 'secondary', None, h=64, w=280)}{btn('Create account', 'primary', None, h=64, w=280)}</div>
</aside>"""
    body = f"""{page_header('Accounts', crumbs=['Customers'], meta='1,284 accounts · £312,480 MRR', actions=btn('Import', 'tertiary', 'upload'))}
<div style="padding: 0 32px; margin-bottom: 16px;">{views_tabs()}</div>
<div style="margin: 0 32px; flex-grow: 1; min-height: 0; display: flex; flex-direction: column; border: 1px solid {K['border']};">{toolbar()}<div style="flex-grow: 1; min-height: 0; overflow: hidden;">{account_table(ACCOUNTS[:15])}</div></div>
{dim}{form}"""
    return app("New account: side panel form", body)


def chart_svg(w=620, h=200):
    vals = [251, 258, 262, 270, 268, 279, 286, 291, 297, 301, 306, 312]
    months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]
    lo, hi = 240, 320
    bw = (w - 48) / len(vals)
    bars, labels, grid = [], [], []
    for g in (250, 275, 300):
        y = h - 24 - (g - lo) / (hi - lo) * (h - 40)
        grid.append(f'<line x1="40" x2="{w}" y1="{y:.0f}" y2="{y:.0f}" stroke="{K["border"]}"/><text x="34" y="{y + 4:.0f}" text-anchor="end" font-size="11" fill="{K["text2"]}">£{g}k</text>')
    for i, v in enumerate(vals):
        x = 48 + i * bw
        bh = (v - lo) / (hi - lo) * (h - 40)
        bars.append(f'<rect x="{x + 6:.0f}" y="{h - 24 - bh:.0f}" width="{bw - 12:.0f}" height="{bh:.0f}" fill="{K["interactive"] if i == len(vals) - 1 else "#A6C8FF"}"/>')
        labels.append(f'<text x="{x + bw / 2:.0f}" y="{h - 6}" text-anchor="middle" font-size="11" fill="{K["text2"]}">{months[i]}</text>')
    return f'<svg role="img" aria-label="MRR by month, rising from £251k in October to £312k in September" width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="display: block; font-family: {FONT};">{"".join(grid)}{"".join(bars)}{"".join(labels)}</svg>'


def overview():
    date = f'<span style="height: 40px; box-sizing: border-box; padding: 0 16px; background: {K["layer"]}; border-bottom: 1px solid {K["border_strong"]}; display: inline-flex; align-items: center; gap: 12px;">{ic("calendar", 16)}Last 12 months {ic("chev_d", 16)}</span>'
    attention = small_table(["Account", "Reason", "Amount", "Owner", ""],
                            [[f'<a href="#" style="color: {K["text"]}; font-weight: 500;">Acme Corp</a>', tag("Overdue 5 days", "red"), "£1,250.00", "Rhea M.", "<a href='#'>Send reminder</a>"],
                             [f'<a href="#" style="color: {K["text"]}; font-weight: 500;">Soylent</a>', tag("Card expires in 3 days", "yellow"), "£1,020.00", "Rhea M.", "<a href='#'>Ask for new card</a>"],
                             [f'<a href="#" style="color: {K["text"]}; font-weight: 500;">Hooli</a>', tag("Trial ends in 7 days", "blue"), "£120.00", "Jo R.", "<a href='#'>Offer a call</a>"],
                             [f'<a href="#" style="color: {K["text"]}; font-weight: 500;">Umbrella Health</a>', tag("Seat limit reached", "purple"), "£6,750.00", "Sam P.", "<a href='#'>Propose upgrade</a>"],
                             [f'<a href="#" style="color: {K["text"]}; font-weight: 500;">Wayne Retail</a>', tag("Renews in 12 days", "gray"), "£3,900.00", "Sam P.", "<a href='#'>Review renewal</a>"]],
                            ["left", "left", "right", "left", "right"])
    mix = "".join(f'<div style="display: grid; grid-template-columns: 90px 1fr 70px; gap: 12px; align-items: center; height: 32px;"><span>{n}</span><span style="height: 8px; background: {K["layer"]};"><span style="display: block; height: 8px; width: {p}%; background: {c};"></span></span><span style="text-align: right; font-variant-numeric: tabular-nums;">{v}</span></div>' for n, p, v, c in [("Enterprise", 64, "£199,980", K["interactive"]), ("Pro", 31, "£96,870", "#6929C4"), ("Starter", 5, "£15,630", "#009D9A")])
    body = f"""{page_header('Overview', meta='Billing health for Acme Workspace', actions=date)}
<div style="flex-grow: 1; min-height: 0; padding: 0 32px 24px; display: flex; flex-direction: column; gap: 24px;">
<div style="display: flex; gap: 1px;">{kpi('Monthly recurring revenue', '£312,480', '▲ 4.2% vs last month', 'up')}{kpi('Active accounts', '1,184', '▲ 23', 'up')}{kpi('Churn (monthly)', '1.8%', '▼ 0.3 pts', 'up')}{kpi('Overdue', '£18,240', '12 invoices', 'down')}</div>
<div style="display: flex; gap: 24px;">
<section style="flex-grow: 1; min-width: 0; padding: 16px; border: 1px solid {K['border']};">{section_head('MRR by month', 'Open report')}{chart_svg(700, 210)}</section>
<section style="width: 400px; flex-shrink: 0; padding: 16px; border: 1px solid {K['border']};">{section_head('MRR by plan')}{mix}<div style="margin-top: 16px; font-size: 12px; color: {K['text2']};">Enterprise grew fastest: 4 upgrades from Pro this quarter.</div></section>
</div>
<section>{section_head('Needs attention', 'View all 17')}{attention}</section>
</div>"""
    return app("Overview: billing dashboard", body, active="Overview")


def settings():
    sub = [("General", False), ("Team", True), ("Billing", False), ("Integrations", False), ("API keys", False), ("Audit log", False)]
    subnav = "".join(f'<a href="#"{CUR if on else ""} style="height: 32px; display: flex; align-items: center; padding-left: 13px; border-left: 3px solid {K["interactive"] if on else K["border"]}; color: {K["text"] if on else K["text2"]}; {"font-weight: 600;" if on else ""}">{label}</a>' for label, on in sub)
    members = [("Rhea Mills", "RM", "purple", "rhea@acme.com", "Admin", "Active", "green", "Now"),
               ("Tom Walsh", "TW", "teal", "tom@acme.com", "Billing manager", "Active", "green", "2 hours ago"),
               ("Sam Patel", "SP", "blue", "sam@acme.com", "Billing manager", "Active", "green", "Yesterday"),
               ("Jo Rivera", "JR", "red", "jo@acme.com", "Viewer", "Active", "green", "3 days ago"),
               ("Priya Shah", "PS", "yellow", "priya@acme.com", "Viewer", "Invited", "blue", "—")]
    rows = "".join(f'<tr style="height: 48px; border-bottom: 1px solid {K["border"]};"><td style="padding: 0 16px;"><span style="display: inline-flex; gap: 10px; align-items: center;">{avatar(i, t, 28)}<span><span style="display: block;">{n}</span><span style="display: block; font-size: 12px; color: {K["text2"]};">{e}</span></span></span></td><td style="padding: 0 16px; width: 200px;"><span style="height: 32px; box-sizing: border-box; padding: 0 12px; display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; width: 180px; border-bottom: 1px solid {K["border_strong"]}; background: {K["layer"]};">{r} {ic("chev_d", 16)}</span></td><td style="padding: 0 16px;">{tag(s, st)}</td><td style="padding: 0 16px; color: {K["text2"]};">{last}</td><td style="width: 48px;">{btn("Actions for " + n, "ghost_plain", "dots", h=48, only_icon=True)}</td></tr>' for n, i, t, e, r, s, st, last in members)
    head = "".join(f'<th scope="col" style="height: 40px; padding: 0 16px; text-align: left; font-weight: 600; background: {K["selected"]};">{h}</th>' for h in ["Member", "Role", "Status", "Last active", ""])

    def row(label, help_text, control):
        return f'<div style="display: grid; grid-template-columns: 280px 1fr; gap: 32px; padding: 20px 0; border-bottom: 1px solid {K["border"]};"><div><div style="font-weight: 600;">{label}</div><div style="margin-top: 4px; font-size: 12px; line-height: 16px; color: {K["text2"]};">{help_text}</div></div><div style="max-width: 480px;">{control}</div></div>'
    toggle = lambda on, label: f'<span style="display: inline-flex; align-items: center; gap: 8px;"><span role="switch" aria-checked="{"true" if on else "false"}" style="width: 48px; height: 24px; border-radius: 12px; background: {K["success"] if on else K["border_strong"]}; position: relative; display: inline-block;"><span style="position: absolute; top: 3px; left: {27 if on else 3}px; width: 18px; height: 18px; border-radius: 50%; background: #fff;"></span></span>{label}</span>'
    body = f"""{page_header('Settings', meta='Acme Workspace')}
<div style="flex-grow: 1; min-height: 0; display: flex; gap: 40px; padding: 8px 32px 24px;">
<nav aria-label="Settings" style="width: 180px; flex-shrink: 0;">{subnav}</nav>
<div style="flex-grow: 1; min-width: 0;">
<div style="display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 16px;"><div><h2 style="margin: 0; font-size: 20px; line-height: 28px; font-weight: 400;">Team</h2><div style="color: {K['text2']};">5 of 10 seats used on your plan</div></div>{btn('Invite people', 'primary', 'user_plus')}</div>
<table style="width: 100%; font-size: 14px; margin-bottom: 32px;"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>
<h3 style="margin: 0; font-size: 16px; font-weight: 600;">Access</h3>
{row('Sign-in method', 'Members sign in with your identity provider. Password sign-in stays available to admins.', text_input(None, 'Okta SAML', select=True))}
{row('Two-step verification', 'Required for anyone who can change billing or export data.', toggle(True, 'Required for Admins and Billing managers'))}
{row('Session length', 'People are signed out after this long without activity.', text_input(None, '12 hours', select=True, w=200))}
</div>
</div>"""
    return app("Settings: team and access", body, active="Settings")


def accounts_phone():
    items = []
    for r in ACCOUNTS[:9]:
        name, ini, tone, owner, plan, mrr, seats, status, renew = r
        items.append(f'<li style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 8px 16px; border-bottom: 1px solid {K["border"]};">{avatar(ini, tone, 32)}<div style="flex-grow: 1; min-width: 0;"><div style="font-weight: 500;">{name}</div><div style="font-size: 12px; color: {K["text2"]};">{plan} · {mrr}/mo · {owner}</div></div>{tag(*status)}</li>')
    chips = "".join(f'<span style="height: 32px; flex-shrink: 0; padding: 0 12px; border-radius: 16px; display: inline-flex; align-items: center; gap: 6px; {"background: " + TAG["blue"][0] + "; color: " + TAG["blue"][1] + ";" if on else "border: 1px solid " + K["border_strong"] + ";"}">{l}</span>' for l, on in [("All 1,284", True), ("Mine", False), ("Past due 31", False), ("Trials", False)])
    body = f"""<header style="height: 48px; flex-shrink: 0; background: {K['shell']}; color: {K['shell_text']}; display: flex; align-items: center;">{btn('Menu', 'on_blue', 'menu', h=48, only_icon=True)}<span style="font-weight: 600;">Northwind</span><span style="margin-left: auto;">{btn('Search', 'on_blue', 'search', h=48, only_icon=True)}</span>{btn('Notifications', 'on_blue', 'bell', h=48, only_icon=True)}</header>
<div style="padding: 16px 16px 8px; display: flex; align-items: center;"><div style="flex-grow: 1;"><h1 style="margin: 0; font-size: 24px; line-height: 32px; font-weight: 400;">Accounts</h1><div style="font-size: 12px; color: {K['text2']};">1,284 · sorted by MRR</div></div>{btn('Sort and filter', 'ghost_plain', 'tune', h=48, only_icon=True)}</div>
<div style="display: flex; gap: 8px; padding: 0 16px 12px; overflow: hidden;">{chips}</div>
<ul style="list-style: none; margin: 0; padding: 0; flex-grow: 1; overflow: hidden; border-top: 1px solid {K['border']};">{"".join(items)}</ul>
<div style="flex-shrink: 0; display: flex;">{btn('New account', 'primary', 'plus', h=56, w=390)}</div>"""
    return doc("Accounts on a phone: rows, not columns", 390, 844, body)


def density():
    def mini(h, label, note):
        rows = ACCOUNTS[:6]
        t = account_table(rows, row_h=h, cols=[("Account", "left", None, True), ("Plan", "left", 130, True), ("MRR", "right", 90, True), ("Status", "left", 110, True)], show_select=True)
        return f'<div style="flex: 1; min-width: 0;"><div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px;"><h2 style="margin: 0; font-size: 16px; font-weight: 600;">{label}</h2><span style="font-size: 12px; color: {K["text2"]};">{note}</span></div><div style="border: 1px solid {K["border"]};">{t}</div></div>'
    body = f"""<div style="padding: 32px; display: flex; flex-direction: column; gap: 8px;"><h1 style="margin: 0; font-size: 28px; line-height: 36px; font-weight: 400;">One setting, three densities</h1><p style="margin: 0; color: {K['text2']}; max-width: 780px;">Design Direction sets density per product; the renderer maps it to spacing and row height from the design system. Pointer surfaces can go compact; touch surfaces never go below the 44px target.</p></div>
<div style="padding: 0 32px 32px; display: flex; gap: 24px;">{mini(48, 'Comfortable', '48px rows · consumer, touch')}{mini(40, 'Default', '40px rows · most B2B')}{mini(32, 'Compact', '32px rows · pointer only, data-heavy')}</div>"""
    return doc("Density: comfortable, default, compact", 1680, 560, body)
