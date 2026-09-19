"""Shared Material 3 building blocks for the Polyxd flow designs (values from packages/ds-material3)."""

C = dict(
    primary="#65558F", on_primary="#FFFFFF", primary_c="#E9DDFF", on_primary_c="#4D3D75",
    secondary_c="#E8DEF8", on_secondary_c="#4A4458", tertiary_c="#FFD9E3", on_tertiary_c="#633B48",
    surface="#FDF7FF", lowest="#FFFFFF", low="#F8F2FA", cont="#F2ECF4", high="#ECE6EE", highest="#E6E0E9",
    on_surface="#1D1B20", variant="#49454E", outline="#7A757F", outline_v="#CAC4CF",
    error="#BA1A1A", error_c="#FFDAD6", on_error_c="#93000A", inverse="#322F35",
    success_c="#A3F69C", on_success_c="#005312", success="#1B6D24", warn_c="#FFDDB5", on_warn_c="#643F00",
)
FONT = "'Roboto', system-ui, -apple-system, sans-serif"

ICONS = {
    "back": '<path d="M15 18l-6-6 6-6"/>',
    "close": '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    "chev_r": '<path d="M9 18l6-6-6-6"/>',
    "chev_d": '<path d="M6 9l6 6 6-6"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "plus": '<path d="M12 5v14"/><path d="M5 12h14"/>',
    "tune": '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    "alert": '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    "calendar": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    "star": '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    "book": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    "trash": '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    "user_plus": '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6"/><path d="M16 11h6"/>',
    "arrow_r": '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    "sort": '<path d="M7 4v16"/><path d="M3 8l4-4 4 4"/><path d="M17 20V4"/><path d="M13 16l4 4 4-4"/>',
    "moon": '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    "tag": '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    "flag": '<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>',
    "note": '<path d="M4 4h16v16H4z"/><path d="M8 9h8"/><path d="M8 13h8"/><path d="M8 17h5"/>',
    "folder": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    "timer": '<circle cx="12" cy="13" r="8"/><path d="M12 9v4"/><path d="M9 2h6"/>',
    "bed": '<path d="M3 18V8"/><path d="M3 14h18v4"/><path d="M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
    "people": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    "bolt": '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "upload": '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
    "grid": '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
}


def icon(name, size=24, color="currentColor", sw=2):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>'


def doc(title, w, h, body, bg=None):
    bg = bg or C["surface"]
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
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&amp;family=Roboto+Flex:opsz,wght@8..144,300;8..144,400&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0;font-family:{FONT};color:{C['on_surface']};background:{bg}}}
a{{color:{C['primary']}}}a:hover{{color:{C['on_primary_c']}}}
</style>
</helmet>
<div style="width: {w}px; height: {h}px; box-sizing: border-box; overflow: hidden; background: {bg}; color: {C['on_surface']}; font-family: {FONT}; display: flex; flex-direction: column;">
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


def app_bar(title, lead="back", trail="", sub=None):
    lead_btn = f'<button type="button" aria-label="{"Back" if lead == "back" else "Close"}" style="width: 48px; height: 48px; border: 0; border-radius: 24px; background: transparent; color: {C["on_surface"]}; display: flex; align-items: center; justify-content: center;">{icon(lead)}</button>' if lead else '<span style="width: 12px;"></span>'
    subline = f'<div style="font-size: 14px; color: {C["variant"]};">{sub}</div>' if sub else ""
    return f"""<header style="height: 64px; flex-shrink: 0; box-sizing: border-box; padding: 0 4px; display: flex; align-items: center; gap: 4px;">
{lead_btn}
<div style="flex-grow: 1; display: flex; flex-direction: column;"><h1 style="margin: 0; font-size: 22px; font-weight: 400; line-height: 28px;">{title}</h1>{subline}</div>
{trail}
</header>"""


def btn(label, kind="filled", full=False, icon_name=None, danger=False, disabled=False, h=48):
    bg, fg, border = {
        "filled": (C["error"] if danger else C["primary"], "#FFFFFF", "transparent"),
        "tonal": (C["secondary_c"], C["on_secondary_c"], "transparent"),
        "outlined": ("transparent", C["error"] if danger else C["primary"], C["outline"]),
        "text": ("transparent", C["error"] if danger else C["primary"], "transparent"),
    }[kind]
    op = " opacity: 0.38;" if disabled else ""
    ic = icon(icon_name, 18) if icon_name else ""
    width = " width: 100%;" if full else ""
    return f'<button type="button"{" disabled" if disabled else ""} style="height: {h}px;{width} box-sizing: border-box; padding: 0 24px; border-radius: {h // 2}px; border: 1px solid {border}; background: {bg}; color: {fg}; font-family: {FONT}; font-size: 14px; font-weight: 500; letter-spacing: 0.1px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;{op}">{ic}{label}</button>'


def chip(label, selected=False, icon_name=None, trailing=None, h=32):
    bg = C["secondary_c"] if selected else "transparent"
    border = "transparent" if selected else C["outline"]
    fg = C["on_secondary_c"] if selected else C["variant"]
    lead = icon("check", 18) if selected else (icon(icon_name, 18) if icon_name else "")
    tr = icon(trailing, 18) if trailing else ""
    return f'<button type="button" aria-pressed="{"true" if selected else "false"}" style="height: {h}px; flex-shrink: 0; box-sizing: border-box; padding: 0 {12 if not (lead or tr) else 8}px 0 {8 if lead else 16}px; border-radius: 8px; border: 1px solid {border}; background: {bg}; color: {fg}; font-family: {FONT}; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;">{lead}<span style="padding-right: {8 if tr else 8}px;">{label}</span>{tr}</button>'


def avatar(initials, bg=None, fg=None, size=40):
    bg = bg or C["primary_c"]
    fg = fg or C["on_primary_c"]
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; border-radius: 50%; background: {bg}; color: {fg}; display: inline-flex; align-items: center; justify-content: center; font-size: {int(size * 0.4)}px; font-weight: 500;">{initials}</span>'


def field(label, value="", placeholder="", lead=None, trail=None, supporting=None, prefix=None, h=56, big=False, focused=False):
    border = f"2px solid {C['primary']}" if focused else f"1px solid {C['outline']}"
    lead_ic = f'<span style="color: {C["variant"]}; display: flex;">{icon(lead)}</span>' if lead else ""
    trail_ic = f'<span style="color: {C["variant"]}; display: flex;">{icon(trail)}</span>' if trail else ""
    pre = f'<span style="color: {C["variant"]};">{prefix}</span>' if prefix else ""
    text = value if value else f'<span style="color: {C["variant"]};">{placeholder}</span>'
    size = "font-size: 32px; font-weight: 400;" if big else "font-size: 16px;"
    sup = f'<div style="padding: 4px 16px 0; font-size: 12px; color: {C["variant"]};">{supporting}</div>' if supporting else ""
    lab = f'<span style="position: absolute; top: -9px; left: 12px; padding: 0 4px; background: inherit; font-size: 12px; color: {C["primary"] if focused else C["variant"]};">{label}</span>' if label else ""
    return f"""<div><div style="position: relative; height: {h}px; box-sizing: border-box; padding: 0 16px; border: {border}; border-radius: 4px; display: flex; align-items: center; gap: 12px; background: inherit;">{lab}{lead_ic}<span style="flex-grow: 1; display: flex; align-items: baseline; gap: 6px; {size}">{pre}{text}</span>{trail_ic}</div>{sup}</div>"""


def search_bar(placeholder, value=None, h=56):
    text = value if value else f'<span style="color: {C["variant"]};">{placeholder}</span>'
    return f"""<label style="height: {h}px; box-sizing: border-box; padding: 0 16px; border-radius: {h // 2}px; background: {C['high']}; display: flex; align-items: center; gap: 16px; font-size: 16px;">
<span style="color: {C['variant']}; display: flex;">{icon('search')}</span><span style="flex-grow: 1;">{text}</span></label>"""


def switch(on=True):
    track = C["primary"] if on else C["highest"]
    border = C["primary"] if on else C["outline"]
    knob = f'<span style="position: absolute; top: 4px; left: {24 if on else 6}px; width: {24 if on else 16}px; height: {24 if on else 16}px; margin-top: {0 if on else 4}px; border-radius: 50%; background: {"#FFFFFF" if on else C["outline"]}; display: flex; align-items: center; justify-content: center; color: {C["primary"]};">{icon("check", 16) if on else ""}</span>'
    return f'<span role="switch" aria-checked="{"true" if on else "false"}" style="position: relative; width: 52px; height: 32px; flex-shrink: 0; box-sizing: border-box; border-radius: 16px; background: {track}; border: 2px solid {border};">{knob}</span>'


def checkbox(on=False):
    if on:
        return f'<span role="checkbox" aria-checked="true" style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 2px; background: {C["primary"]}; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center;">{icon("check", 14, sw=3)}</span>'
    return f'<span role="checkbox" aria-checked="false" style="width: 18px; height: 18px; flex-shrink: 0; box-sizing: border-box; border-radius: 2px; border: 2px solid {C["variant"]};"></span>'


def receipt(rows, total=None, pad=16, bg=None):
    """Label/value rows, values right-aligned with tabular numbers (people read amounts from the right)."""
    bg = bg or C["cont"]
    r = "".join(
        f'<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px; font-size: 14px; line-height: 20px;"><span style="color: {C["variant"]};">{k}</span><span style="text-align: right; font-variant-numeric: tabular-nums;{" color: " + C["success"] + ";" if "Free" in v or "£0.00" == v else ""}">{v}</span></div>'
        for k, v in rows
    )
    t = ""
    if total:
        t = f'<div style="height: 1px; background: {C["outline_v"]};"></div><div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 16px; font-weight: 500;"><span>{total[0]}</span><span style="font-variant-numeric: tabular-nums;">{total[1]}</span></div>'
    return f'<div style="padding: {pad}px; border-radius: 16px; background: {bg}; display: flex; flex-direction: column; gap: 10px;">{r}{t}</div>'


def section_label(text, action=None):
    a = f'<a href="#" style="font-size: 14px; font-weight: 500; text-decoration: none;">{action}</a>' if action else ""
    return f'<div style="display: flex; justify-content: space-between; align-items: center; padding: 0 0 4px;"><h2 style="margin: 0; font-size: 14px; font-weight: 500; letter-spacing: 0.1px; color: {C["variant"]};">{text}</h2>{a}</div>'


def list_item(headline, supporting=None, lead=None, trail=None, h=None, pad="12px 16px"):
    sup = f'<div style="font-size: 14px; line-height: 20px; color: {C["variant"]};">{supporting}</div>' if supporting else ""
    return f'<div style="display: flex; align-items: center; gap: 16px; padding: {pad};{" min-height: " + str(h) + "px;" if h else ""} box-sizing: border-box;">{lead or ""}<div style="flex-grow: 1; min-width: 0;"><div style="font-size: 16px; line-height: 24px;">{headline}</div>{sup}</div>{trail or ""}</div>'


def bottom_bar(content, border=True):
    b = f"border-top: 1px solid {C['outline_v']};" if border else ""
    return f'<div style="flex-shrink: 0; margin-top: auto; padding: 12px 16px 24px; background: {C["surface"]}; {b} display: flex; flex-direction: column; gap: 10px;">{content}</div>'


def desktop_shell(title, body, crumbs=None, w=1280, h=900, subtitle=None):
    c = f'<div style="font-size: 14px; color: {C["variant"]};">{crumbs}</div>' if crumbs else ""
    s = f'<p style="margin: 4px 0 0; font-size: 16px; color: {C["variant"]};">{subtitle}</p>' if subtitle else ""
    return f"""<div style="flex-grow: 1; box-sizing: border-box; padding: 40px 64px; display: flex; flex-direction: column; gap: 28px;">
<div>{c}<h1 style="margin: 4px 0 0; font-size: 32px; font-weight: 400; line-height: 40px;">{title}</h1>{s}</div>
{body}
</div>"""


def card(inner, pad=20, bg=None, radius=16, border=False, extra=""):
    bg = bg or C["low"]
    b = f"border: 1px solid {C['outline_v']};" if border else ""
    return f'<div style="padding: {pad}px; border-radius: {radius}px; background: {bg}; {b} {extra}">{inner}</div>'


def image(label, w="100%", h=120, hue=260, radius=12):
    return f'<div role="img" aria-label="{label}" style="width: {w}; height: {h}px; flex-shrink: 0; border-radius: {radius}px; background: hsl({hue} 30% 80%); display: flex; align-items: flex-end; padding: 8px; box-sizing: border-box; font-size: 11px; color: hsl({hue} 30% 30%);"></div>'
