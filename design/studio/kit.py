"""Building blocks for Polyxd Studio, in polyxd.com's own look: a warm ground, near-black ink, one
signal orange, Bricolage Grotesque for titles, Geist for everything read, Geist Mono for tokens and ids.

Every control is a real element (<button>, <input>, <label>, <select>, <a>) so the drawings are
accessible as drawn. Colours under text meet 4.5:1: the signal orange is for marks and focus, and
fills under white text use its darker ink.
"""
import importlib.util, os

# The flow designs' stroke icons, shared. Both folders call their module kit.py, so load theirs by path.
_spec = importlib.util.spec_from_file_location("flows_kit", os.path.join(os.path.dirname(__file__), "..", "flows", "kit.py"))
_flows = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_flows)
ICONS = dict(_flows.ICONS)

S = dict(
    ground="#F4F1EA", paper="#FFFFFF", sunk="#FAF8F3", ink="#141414", ink2="#3F3E3A", muted="#5E5C55",
    line="#DDD8CC", soft="#ECE8DE", signal="#FF5A1F", signal_ink="#B8350A", signal_bg="#FFE8DD",
    ok="#1D6B3F", ok_bg="#DFF2E5", warn="#7A4F00", warn_bg="#FBEFD2", bad="#B42318", bad_bg="#FDE4E1",
    info="#1F4FB8", info_bg="#E4ECFB", night="#141414", night_text="#F4F1EA", focus="#FF5A1F",
)
TONE = {
    "ok": (S["ok_bg"], S["ok"]), "warn": (S["warn_bg"], S["warn"]), "bad": (S["bad_bg"], S["bad"]),
    "info": (S["info_bg"], S["info"]), "gray": (S["soft"], S["ink2"]), "signal": (S["signal_bg"], S["signal_ink"]),
    "ink": (S["ink"], "#FFFFFF"),
}
BODY = "'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif"
DISPLAY = "'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif"
MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

ICONS.update({
    "home": '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
    "palette": '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 9.8C22 6 17.5 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    "blocks": '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><path d="M17 13v8"/><path d="M13 17h8"/>',
    "compass": '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    "rule": '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "route": '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8"/>',
    "rocket": '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 15l-3-3a13 13 0 0 1 13-9 13 13 0 0 1-9 13z"/><circle cx="14.5" cy="9.5" r="1.5"/>',
    "chart": '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
    "image": '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
    "wand": '<path d="M15 4V2"/><path d="M15 10V8"/><path d="M11 6h2"/><path d="M17 6h2"/><path d="M3 21 14 10"/>',
    "code": '<path d="m8 6-6 6 6 6"/><path d="m16 6 6 6-6 6"/>',
    "figma": '<path d="M9 3h3v6H9a3 3 0 0 1 0-6z"/><path d="M12 3h3a3 3 0 0 1 0 6h-3z"/><path d="M9 9h3v6H9a3 3 0 0 1 0-6z"/><circle cx="15" cy="12" r="3"/><path d="M9 15h3v3a3 3 0 1 1-3-3z"/>',
    "github": '<path d="M9 19c-4 1.5-4-2-6-2.5"/><path d="M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    "link": '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    "undo": '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    "drag": '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    "pin": '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    "sparkle": '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    "phone": '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    "monitor": '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1l1.4-1.4"/><path d="M17.7 6.3l1.4-1.4"/>',
    "history": '<path d="M3 3v6h6"/><path d="M3.5 13a9 9 0 1 0 2.1-6.4L3 9"/><path d="M12 7v5l3 2"/>',
    "x_circle": '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    "check_circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    "robot": '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/><path d="M2 14h2"/><path d="M20 14h2"/>',
    "comment": '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
    "copy": '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    "dots_h": '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    "dots": '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
    "filter": '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    "gear": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    "edit": '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    "key": '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2"/><path d="M16 7l3 3"/>',
    "plug": '<path d="M9 2v6"/><path d="M15 2v6"/><path d="M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v4"/>',
    "download": '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    "chev_l": '<path d="M15 18l-6-6 6-6"/>',
    "send": '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    "flask": '<path d="M9 3h6"/><path d="M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
    "layers": '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    "contact": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "repeat": '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
})


def ic(name, size=16, color="currentColor", sw=1.75):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0;">{ICONS[name]}</svg>'


def doc(title, w, h, body, bg=None):
    bg = bg or S["ground"]
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
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&amp;family=Geist:wght@400;500;600&amp;family=Geist+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0;font-family:{BODY};color:{S['ink']};background:{bg}}}
a{{color:{S['signal_ink']};text-decoration:none}}a:hover{{text-decoration:underline}}
table{{border-collapse:collapse}}
</style>
</helmet>
<div style="width: {w}px; height: {h}px; box-sizing: border-box; overflow: hidden; position: relative; background: {bg}; color: {S['ink']}; font-family: {BODY}; font-size: 14px; line-height: 20px; display: flex;">
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


# ---------------------------------------------------------------- atoms

def tag(label, tone="gray", mono=False):
    bg, fg = TONE[tone]
    font = f" font-family: {MONO}; font-size: 12px;" if mono else " font-size: 12px;"
    return f'<span style="display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 11px; background: {bg}; color: {fg};{font} font-weight: 500; line-height: 16px; white-space: nowrap;">{label}</span>'


def dot(tone="ok", size=8):
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; border-radius: 50%; background: {TONE[tone][1]}; flex-shrink: 0; display: inline-block;"></span>'


def btn(label, kind="secondary", icon_name=None, h=36, only_icon=False, trail_icon=None, w=None, href=None):
    bg, fg, border = {
        "primary": (S["ink"], "#FFFFFF", S["ink"]),
        "accent": (S["signal_ink"], "#FFFFFF", S["signal_ink"]),
        "secondary": (S["paper"], S["ink"], S["line"]),
        "ghost": ("transparent", S["ink2"], "transparent"),
        "danger": (S["bad"], "#FFFFFF", S["bad"]),
        "danger_ghost": ("transparent", S["bad"], "transparent"),
        "link": ("transparent", S["signal_ink"], "transparent"),
    }[kind]
    lead = ic(icon_name, 16) if icon_name else ""
    trail = ic(trail_icon, 16) if trail_icon else ""
    width = f" width: {w}px;" if w else ""
    tag_ = "a" if href else "button"
    extra = f' href="{href}"' if href else ' type="button"'
    if only_icon:
        return f'<{tag_}{extra} aria-label="{label}" title="{label}" style="width: {h}px; height: {h}px; flex-shrink: 0; box-sizing: border-box; border: 1px solid {border}; border-radius: 8px; background: {bg}; color: {fg}; display: inline-flex; align-items: center; justify-content: center; padding: 0;">{lead}</{tag_}>'
    pad = "0 10px" if kind in ("ghost", "link", "danger_ghost") else "0 14px"
    return f'<{tag_}{extra} style="height: {h}px;{width} flex-shrink: 0; box-sizing: border-box; padding: {pad}; border: 1px solid {border}; border-radius: 8px; background: {bg}; color: {fg}; font-family: {BODY}; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; text-decoration: none;">{lead}<span>{label}</span>{trail}</{tag_}>'


def avatar(initials, tone="signal", size=28):
    bg, fg = TONE[tone]
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; border-radius: 50%; background: {bg}; color: {fg}; display: inline-flex; align-items: center; justify-content: center; font-size: {max(10, int(size * 0.4))}px; font-weight: 600;">{initials}</span>'


def label(text, for_id=None, hint=None):
    h = f'<span style="color: {S["muted"]}; font-weight: 400;"> {hint}</span>' if hint else ""
    f = f' for="{for_id}"' if for_id else ""
    return f'<label{f} style="font-size: 13px; font-weight: 500; color: {S["ink"]};">{text}{h}</label>'


def field(lbl, value="", id_=None, placeholder="", help_text=None, mono=False, w=None, error=None, prefix=None, suffix=None, hint=None, h=36):
    id_ = id_ or lbl.lower().replace(" ", "-").replace("’", "")[:24]
    width = f"width: {w}px;" if w else ""
    font = MONO if mono else BODY
    border = S["bad"] if error else S["line"]
    pre = f'<span style="color: {S["muted"]}; font-size: 13px; padding-left: 10px; font-family: {font};">{prefix}</span>' if prefix else ""
    suf = f'<span style="color: {S["muted"]}; font-size: 13px; padding-right: 10px;">{suffix}</span>' if suffix else ""
    below = ""
    if error:
        below = f'<span style="font-size: 12px; color: {S["bad"]}; display: flex; gap: 6px; align-items: center;">{ic("alert", 14)}{error}</span>'
    elif help_text:
        below = f'<span style="font-size: 12px; color: {S["muted"]};">{help_text}</span>'
    return f'''<div style="display: flex; flex-direction: column; gap: 6px; {width}">
{label(lbl, id_, hint)}
<div style="height: {h}px; box-sizing: border-box; border: 1px solid {border}; border-radius: 8px; background: {S["paper"]}; display: flex; align-items: center;">{pre}<input id="{id_}" value="{value}" placeholder="{placeholder}" style="flex-grow: 1; min-width: 0; height: 100%; border: 0; background: transparent; padding: 0 10px; font-family: {font}; font-size: 14px; color: {S["ink"]}; outline: none;">{suf}</div>
{below}
</div>'''


def textarea(lbl, value="", id_=None, rows_h=88, help_text=None, w=None):
    id_ = id_ or lbl.lower().replace(" ", "-")[:24]
    width = f"width: {w}px;" if w else ""
    below = f'<span style="font-size: 12px; color: {S["muted"]};">{help_text}</span>' if help_text else ""
    return f'''<div style="display: flex; flex-direction: column; gap: 6px; {width}">
{label(lbl, id_)}
<textarea id="{id_}" style="height: {rows_h}px; box-sizing: border-box; resize: none; border: 1px solid {S["line"]}; border-radius: 8px; background: {S["paper"]}; padding: 8px 10px; font-family: {BODY}; font-size: 14px; line-height: 20px; color: {S["ink"]};">{value}</textarea>
{below}
</div>'''


def select(lbl, value, id_=None, w=None, help_text=None, mono=False):
    id_ = id_ or lbl.lower().replace(" ", "-")[:24]
    width = f"width: {w}px;" if w else ""
    font = MONO if mono else BODY
    below = f'<span style="font-size: 12px; color: {S["muted"]};">{help_text}</span>' if help_text else ""
    return f'''<div style="display: flex; flex-direction: column; gap: 6px; {width}">
{label(lbl, id_)}
<div style="position: relative; display: flex;"><select id="{id_}" style="appearance: none; flex-grow: 1; height: 36px; border: 1px solid {S["line"]}; border-radius: 8px; background: {S["paper"]}; padding: 0 32px 0 10px; font-family: {font}; font-size: 14px; color: {S["ink"]};"><option>{value}</option></select><span style="position: absolute; right: 10px; top: 10px; color: {S["muted"]}; display: flex; pointer-events: none;">{ic("chev_d", 16)}</span></div>
{below}
</div>'''


def switch(on=True, label_text="", id_=None):
    track = S["ink"] if on else S["line"]
    knob_x = "18px" if on else "2px"
    return f'<button type="button" role="switch" aria-checked="{"true" if on else "false"}" aria-label="{label_text}" style="width: 38px; height: 22px; flex-shrink: 0; border: 0; border-radius: 11px; background: {track}; position: relative; padding: 0;"><span style="position: absolute; top: 2px; left: {knob_x}; width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF;"></span></button>'


def checkbox(on=False, label_text="Select", visible_label=None, id_=None):
    lbl = f'<span style="font-size: 14px;">{visible_label}</span>' if visible_label else ""
    aria = "" if visible_label else f' aria-label="{label_text}"'
    return f'<label style="display: inline-flex; align-items: center; gap: 8px;"><input type="checkbox"{" checked" if on else ""}{aria} style="width: 16px; height: 16px; margin: 0; accent-color: {S["ink"]};">{lbl}</label>'


def radio(on, text, name="r", sub=None):
    s = f'<span style="display: block; font-size: 12px; color: {S["muted"]};">{sub}</span>' if sub else ""
    return f'<label style="display: flex; align-items: flex-start; gap: 10px;"><input type="radio" name="{name}"{" checked" if on else ""} style="width: 16px; height: 16px; margin: 2px 0 0; accent-color: {S["ink"]};"><span><span style="font-size: 14px;">{text}</span>{s}</span></label>'


def segmented(options, active, label_text):
    items = "".join(
        f'<button type="button" aria-pressed="{"true" if o == active else "false"}" style="height: 30px; padding: 0 12px; border: 0; border-radius: 6px; background: {S["paper"] if o == active else "transparent"}; color: {S["ink"] if o == active else S["ink2"]}; font-family: {BODY}; font-size: 13px; font-weight: {600 if o == active else 500}; box-shadow: {"0 1px 2px rgba(20,20,20,.12)" if o == active else "none"};">{o}</button>'
        for o in options
    )
    return f'<div role="group" aria-label="{label_text}" style="display: inline-flex; align-self: flex-start; gap: 2px; padding: 3px; border-radius: 8px; background: {S["soft"]};">{items}</div>'


def swatch(color, size=20, border=True):
    b = f"border: 1px solid rgba(20,20,20,.12);" if border else ""
    return f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; border-radius: 5px; background: {color}; {b} box-sizing: border-box; display: inline-block;"></span>'


def meter(pct, tone="ok", w=120, h=6):
    fg = TONE[tone][1]
    return f'<span aria-hidden="true" style="width: {w}px; height: {h}px; border-radius: {h}px; background: {S["soft"]}; display: inline-flex; overflow: hidden; flex-shrink: 0;"><span style="width: {pct}%; background: {fg};"></span></span>'


def mono(text, size=13, color=None):
    return f'<span style="font-family: {MONO}; font-size: {size}px; color: {color or S["ink2"]};">{text}</span>'


def kbd(text):
    return f'<kbd style="font-family: {MONO}; font-size: 11px; padding: 1px 5px; border: 1px solid {S["line"]}; border-bottom-width: 2px; border-radius: 4px; color: {S["ink2"]}; background: {S["paper"]};">{text}</kbd>'


def card(inner, pad=20, gap=12, extra="", bg=None):
    return f'<section style="box-sizing: border-box; background: {bg or S["paper"]}; border: 1px solid {S["line"]}; border-radius: 12px; padding: {pad}px; display: flex; flex-direction: column; gap: {gap}px; {extra}">{inner}</section>'


def h2(text, sub=None, action=""):
    s = f'<p style="margin: 2px 0 0; font-size: 13px; color: {S["muted"]};">{sub}</p>' if sub else ""
    return f'<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;"><div><h2 style="margin: 0; font-size: 15px; font-weight: 600; line-height: 22px;">{text}</h2>{s}</div>{action}</div>'


def notice(title, text, tone="info", action=""):
    bg, fg = TONE[tone]
    icon_name = {"info": "info", "warn": "alert", "bad": "alert", "ok": "check_circle", "signal": "sparkle", "gray": "info"}[tone]
    return f'<div role="{"alert" if tone == "bad" else "status"}" style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; background: {bg}; color: {S["ink"]};"><span style="color: {fg}; display: flex; padding-top: 2px;">{ic(icon_name, 18)}</span><div style="flex-grow: 1;"><strong style="font-weight: 600; font-size: 14px;">{title}</strong><div style="font-size: 13px; color: {S["ink2"]}; margin-top: 2px;">{text}</div></div>{action}</div>'


def table(head, rows, aligns=None, widths=None, row_h=48, selected=(), pad_x=16, first_sticky=False, caption=None):
    aligns = aligns or ["left"] * len(head)
    widths = widths or [None] * len(head)
    th = "".join(
        f'<th scope="col" style="text-align: {a}; font-size: 12px; font-weight: 500; color: {S["muted"]}; padding: 0 {pad_x}px; height: 36px; border-bottom: 1px solid {S["line"]}; white-space: nowrap;{f" width: {w}px;" if w else ""}">{h}</th>'
        for h, a, w in zip(head, aligns, widths)
    )
    body = ""
    for i, r in enumerate(rows):
        bg = S["signal_bg"] if i in selected else "transparent"
        tds = "".join(
            f'<td style="text-align: {a}; padding: 0 {pad_x}px; height: {row_h}px; border-bottom: 1px solid {S["soft"]}; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{c}</td>'
            for c, a in zip(r, aligns)
        )
        body += f'<tr style="background: {bg};">{tds}</tr>'
    cap = f'<caption style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);">{caption}</caption>' if caption else ""
    return f'<table style="width: 100%; border-collapse: collapse; table-layout: fixed;">{cap}<thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'


def search(placeholder, w=280, value=""):
    v = f' value="{value}"' if value else ""
    return f'<div style="width: {w}px; height: 36px; box-sizing: border-box; border: 1px solid {S["line"]}; border-radius: 8px; background: {S["paper"]}; display: flex; align-items: center; gap: 8px; padding: 0 10px; color: {S["muted"]};">{ic("search", 16)}<input aria-label="{placeholder}" placeholder="{placeholder}"{v} style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font-family: {BODY}; font-size: 14px; color: {S["ink"]}; outline: none;"></div>'


def filter_chip(text, on=False, count=None):
    c = f'<span style="color: {S["muted"] if not on else "#FFFFFF"}; font-weight: 400;">{count}</span>' if count is not None else ""
    return f'<button type="button" aria-pressed="{"true" if on else "false"}" style="height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid {S["ink"] if on else S["line"]}; background: {S["ink"] if on else S["paper"]}; color: {"#FFFFFF" if on else S["ink"]}; font-family: {BODY}; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;">{text}{c}</button>'


def tabs(items, active, label_text="Sections"):
    out = ""
    for t in items:
        name, count = (t if isinstance(t, tuple) else (t, None))
        on = name == active
        c = f'<span style="margin-left: 6px; font-size: 12px; color: {S["muted"]};">{count}</span>' if count is not None else ""
        out += f'<a href="#" role="tab" aria-selected="{"true" if on else "false"}" style="height: 40px; display: inline-flex; align-items: center; padding: 0 2px; margin-right: 22px; font-size: 14px; font-weight: {600 if on else 500}; color: {S["ink"] if on else S["muted"]}; border-bottom: 2px solid {S["signal"] if on else "transparent"}; text-decoration: none;">{name}{c}</a>'
    return f'<nav role="tablist" aria-label="{label_text}" style="display: flex; border-bottom: 1px solid {S["line"]};">{out}</nav>'


# ---------------------------------------------------------------- shell

NAV = [
    ("Home", "home", None),
    ("Foundations", None, [("Design systems", "palette"), ("Components", "blocks"), ("Patterns", "layers")]),
    ("Direction", None, [("Profile and voice", "compass"), ("Rules", "rule"), ("Exemplars", "image")]),
    ("Reviews", "eye", None),
    ("Product", None, [("Capabilities", "bolt"), ("Journeys", "route")]),
    ("Releases", "rocket", None),
    ("Insights", "chart", None),
]


def sidebar(active):
    def item(name, icon_name, badge=None):
        on = name == active
        b = f'<span style="margin-left: auto; font-size: 12px; font-weight: 600; min-width: 20px; height: 20px; border-radius: 10px; padding: 0 6px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; background: {S["signal_ink"]}; color: #FFFFFF;">{badge}</span>' if badge else ""
        cur = ' aria-current="page"' if on else ""
        return f'<a href="#"{cur} style="height: 34px; display: flex; align-items: center; gap: 10px; padding: 0 10px; border-radius: 8px; font-size: 14px; font-weight: {600 if on else 500}; color: {S["ink"] if on else S["ink2"]}; background: {S["paper"] if on else "transparent"}; box-shadow: {"0 1px 2px rgba(20,20,20,.08)" if on else "none"}; text-decoration: none;"><span style="color: {S["signal_ink"] if on else S["muted"]}; display: flex;">{ic(icon_name, 18)}</span>{name}{b}</a>'

    groups = ""
    badges = {"Reviews": "18"}
    for name, icon_name, children in NAV:
        if children is None:
            groups += item(name, icon_name, badges.get(name))
        else:
            groups += f'<div style="margin: 14px 10px 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: {S["muted"]};">{name}</div>'
            groups += "".join(item(n, i) for n, i in children)
    return f'''<aside style="width: 232px; flex-shrink: 0; box-sizing: border-box; padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; border-right: 1px solid {S["line"]}; background: {S["ground"]};">
<div style="display: flex; align-items: center; gap: 10px; padding: 4px 8px 14px;">
<span aria-hidden="true" style="width: 28px; height: 28px; border-radius: 8px; background: {S["ink"]}; color: {S["signal"]}; display: inline-flex; align-items: center; justify-content: center; font-family: {DISPLAY}; font-weight: 700; font-size: 16px;">p</span>
<div style="display: flex; flex-direction: column; line-height: 16px;"><span style="font-family: {DISPLAY}; font-weight: 700; font-size: 15px;">Polyxd Studio</span><span style="font-size: 12px; color: {S["muted"]};">Northwind</span></div>
<button type="button" aria-label="Switch workspace" style="margin-left: auto; border: 0; background: transparent; color: {S["muted"]}; display: flex; padding: 4px;">{ic("chev_d", 16)}</button>
</div>
<nav aria-label="Studio" style="display: flex; flex-direction: column; gap: 2px;">{groups}</nav>
<div style="margin-top: auto; display: flex; flex-direction: column; gap: 2px;">
{item("Settings", "gear")}
<button type="button" aria-haspopup="menu" aria-label="Account menu for Maya Rao" style="display: flex; align-items: center; gap: 10px; padding: 10px 8px 2px; border: 0; border-top: 1px solid {S["line"]}; margin-top: 8px; background: transparent; font-family: {BODY}; text-align: left; color: {S["ink"]};">{avatar("MR", "info", 28)}<span style="display: flex; flex-direction: column; line-height: 16px; flex-grow: 1;"><span style="font-size: 13px; font-weight: 600;">Maya Rao</span><span style="font-size: 12px; color: {S["muted"]};">Design system lead</span></span>{ic("dots", 16, S["muted"])}</button>
</div>
</aside>'''


def topbar(crumbs, actions=""):
    parts = []
    for i, c in enumerate(crumbs):
        last = i == len(crumbs) - 1
        if last:
            parts.append(f'<span aria-current="page" style="color: {S["ink"]}; font-weight: 500;">{c}</span>')
        else:
            parts.append(f'<a href="#" style="color: {S["muted"]};">{c}</a>')
    sep = f'<span aria-hidden="true" style="color: {S["line"]};">/</span>'
    return f'''<header style="height: 56px; flex-shrink: 0; box-sizing: border-box; padding: 0 28px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid {S["soft"]};">
<nav aria-label="Breadcrumb" style="display: flex; align-items: center; gap: 8px; font-size: 13px;">{sep.join(parts)}</nav>
<div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
<button type="button" style="height: 32px; box-sizing: border-box; padding: 0 10px; border: 1px solid {S["line"]}; border-radius: 8px; background: {S["sunk"]}; color: {S["muted"]}; font-family: {BODY}; font-size: 13px; display: inline-flex; align-items: center; gap: 8px; width: 220px;">{ic("search", 15)}<span>Search Studio</span><span style="margin-left: auto;">{kbd("⌘K")}</span></button>
{btn("Notifications", "ghost", "bell", h=32, only_icon=True)}
{actions}
</div>
</header>'''


def page_head(title, desc=None, actions="", meta=None, tabs_html="", pad="24px 32px 0"):
    d = f'<p style="margin: 6px 0 0; font-size: 14px; color: {S["muted"]}; max-width: 720px;">{desc}</p>' if desc else ""
    m = f'<div style="display: flex; gap: 8px; align-items: center; margin-top: 10px;">{meta}</div>' if meta else ""
    return f'''<div style="padding: {pad}; display: flex; flex-direction: column; gap: 16px;">
<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;">
<div><h1 style="margin: 0; font-family: {DISPLAY}; font-size: 28px; line-height: 34px; font-weight: 700; letter-spacing: -0.01em;">{title}</h1>{d}{m}</div>
<div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">{actions}</div>
</div>
{tabs_html}
</div>'''


HEIGHTS = {}


def app(title, active, crumbs, body, top_actions="", w=1440, h=None, overlay=""):
    h = h or HEIGHTS.get(title, 900)
    return doc(title, w, h, f'''{sidebar(active)}
<main style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; background: {S["paper"]};">
{topbar(crumbs, top_actions)}
<div style="flex-grow: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;">{body}</div>
</main>
{overlay}''')


def scrim():
    return '<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(20,20,20,.38);"></div>'


def drawer(title, body, footer, w=520, sub=None):
    s = f'<p style="margin: 4px 0 0; font-size: 13px; color: {S["muted"]};">{sub}</p>' if sub else ""
    return f'''{scrim()}
<aside role="dialog" aria-modal="true" aria-label="{title}" style="position: absolute; top: 0; right: 0; bottom: 0; width: {w}px; box-sizing: border-box; background: {S["paper"]}; display: flex; flex-direction: column; box-shadow: -12px 0 40px rgba(20,20,20,.18);">
<header style="padding: 20px 24px; border-bottom: 1px solid {S["soft"]}; display: flex; align-items: flex-start; gap: 12px;">
<div style="flex-grow: 1;"><h2 style="margin: 0; font-family: {DISPLAY}; font-size: 20px; line-height: 26px; font-weight: 700;">{title}</h2>{s}</div>
{btn("Close", "ghost", "close", h=32, only_icon=True)}
</header>
<div style="flex-grow: 1; min-height: 0; overflow: hidden; padding: 20px 24px; display: flex; flex-direction: column; gap: 18px;">{body}</div>
<footer style="padding: 16px 24px; border-top: 1px solid {S["soft"]}; display: flex; gap: 8px; justify-content: flex-end; align-items: center;">{footer}</footer>
</aside>'''


def dialog(title, body, footer, w=480):
    return f'''{scrim()}
<div role="dialog" aria-modal="true" aria-label="{title}" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: {w}px; box-sizing: border-box; background: {S["paper"]}; border-radius: 14px; box-shadow: 0 24px 64px rgba(20,20,20,.28); display: flex; flex-direction: column;">
<div style="padding: 24px 24px 8px; display: flex; flex-direction: column; gap: 14px;">
<h2 style="margin: 0; font-family: {DISPLAY}; font-size: 20px; line-height: 26px; font-weight: 700;">{title}</h2>
{body}
</div>
<footer style="padding: 16px 24px 24px; display: flex; gap: 8px; justify-content: flex-end;">{footer}</footer>
</div>'''


def toast(text, action="Undo"):
    return f'<div role="status" style="position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; padding: 10px 10px 10px 16px; border-radius: 10px; background: {S["ink"]}; color: {S["night_text"]}; font-size: 14px; box-shadow: 0 12px 32px rgba(20,20,20,.3);"><span>{text}</span><button type="button" style="height: 30px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: {S["signal"]}; font-family: {BODY}; font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">{ic("undo", 15)}{action}</button><button type="button" aria-label="Dismiss" style="border: 0; background: transparent; color: {S["night_text"]}; display: flex; padding: 6px;">{ic("close", 15)}</button></div>'


# ---------------------------------------------------------------- previews of generated surfaces

PACK = {
    "northwind": dict(bg="#FFFFFF", surface="#F5F7FA", ink="#101828", muted="#475467", primary="#1849A9", on_primary="#FFFFFF", line="#D0D5DD", radius=10, font=BODY),
    "northwind-dark": dict(bg="#0C111D", surface="#161B26", ink="#F5F5F6", muted="#94969C", primary="#84ADFF", on_primary="#0C111D", line="#333741", radius=10, font=BODY),
    "material3": dict(bg="#FDF7FF", surface="#F3EDF7", ink="#1D1B20", muted="#49454F", primary="#65558F", on_primary="#FFFFFF", line="#CAC4D0", radius=20, font="'Roboto', system-ui, sans-serif"),
    "carbon": dict(bg="#FFFFFF", surface="#F4F4F4", ink="#161616", muted="#525252", primary="#0F62FE", on_primary="#FFFFFF", line="#E0E0E0", radius=0, font="'IBM Plex Sans', system-ui, sans-serif"),
    "govuk": dict(bg="#FFFFFF", surface="#F3F2F1", ink="#0B0C0C", muted="#505A5F", primary="#00703C", on_primary="#FFFFFF", line="#B1B4B6", radius=0, font="Arial, sans-serif"),
}


def mini_surface(kind="send", pack="northwind", w=300, h=420, label_text=None):
    """A small rendering of a generated surface, drawn in a pack's colours, for previews and review."""
    p = PACK[pack]
    r = p["radius"]
    btn_r = min(r, 20) if r else 0

    def pbtn(t, primary=True, full=True):
        bg = p["primary"] if primary else "transparent"
        fg = p["on_primary"] if primary else p["primary"]
        bd = p["primary"] if not primary else p["primary"]
        width = "align-self: stretch;" if full else ""
        return f'<span style="{width} height: 36px; border-radius: {btn_r}px; border: 1px solid {bd}; background: {bg}; color: {fg}; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center; padding: 0 14px;">{t}</span>'

    def row(k, v, strong=False):
        return f'<div style="display: flex; justify-content: space-between; font-size: 12px; padding: 7px 0; border-bottom: 1px solid {p["line"]};"><span style="color: {p["muted"]};">{k}</span><span style="font-weight: {600 if strong else 500};">{v}</span></div>'

    if kind == "send":
        inner = f'''<div style="font-size: 12px; color: {p["muted"]};">Send to Alex Kim</div>
<div style="font-size: 34px; font-weight: 600; letter-spacing: -0.02em;">£40.00</div>
<div style="font-size: 12px; color: {p["muted"]}; margin-top: -6px;">For concert tickets</div>
<div style="background: {p["surface"]}; border-radius: {r}px; padding: 4px 12px;">{row("From", "Everyday ····4521")}{row("Arrives", "Instantly")}{row("Fee", "£0.00")}</div>
<div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px;">{pbtn("Send £40.00")}{pbtn("Cancel", False)}</div>'''
    elif kind == "plans":
        cards = ""
        for name, price, rec in [("Basic", "£2", False), ("Plus", "£5", True), ("Pro", "£9", False)]:
            border = f"2px solid {p['primary']}" if rec else f"1px solid {p['line']}"
            badge = f'<span style="font-size: 10px; font-weight: 700; color: {p["primary"]};">RECOMMENDED</span>' if rec else ""
            cards += f'<div style="border: {border}; border-radius: {r}px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;"><div style="display: flex; flex-direction: column;">{badge}<strong style="font-size: 13px;">{name}</strong><span style="font-size: 11px; color: {p["muted"]};">{ {"Basic": "100 GB", "Plus": "2 TB", "Pro": "5 TB"}[name]} storage</span></div><span style="font-size: 14px; font-weight: 600;">{price}<span style="font-size: 11px; color: {p["muted"]}; font-weight: 400;">/mo</span></span></div>'
        inner = f'<div style="font-size: 17px; font-weight: 600;">More storage: Plus fits</div><div style="font-size: 12px; color: {p["muted"]}; margin-top: -8px;">You use 180 GB of 200 GB.</div>{cards}<div style="margin-top: auto;">{pbtn("Switch to Plus")}</div>'
    elif kind == "delete":
        inner = f'''<div style="font-size: 17px; font-weight: 600;">Delete your account?</div>
<div style="font-size: 12px; color: {p["muted"]}; line-height: 17px;">Everything is kept for 30 days, then deleted for good.</div>
<div style="background: {p["surface"]}; border-radius: {r}px; padding: 4px 12px;">{row("Projects", "12")}{row("Files", "2,381")}{row("Shared with", "4 people")}</div>
<div style="font-size: 12px; font-weight: 600;">Type DELETE to confirm</div>
<div style="height: 36px; border: 1px solid {p["line"]}; border-radius: {min(r, 8)}px;"></div>
<div style="margin-top: auto; display: flex; flex-direction: column; gap: 8px;"><span style="height: 36px; border-radius: {btn_r}px; background: #B42318; color: #FFFFFF; font-size: 13px; font-weight: 600; display: flex; align-items: center; justify-content: center;">Delete account</span>{pbtn("Keep my account", False)}</div>'''
    elif kind == "blank":
        inner = f'''<div style="font-size: 17px; font-weight: 600;">Order details</div>
<div style="font-size: 12px; color: {p["muted"]}; margin-top: -8px;">Order details</div>
<div style="background: {p["surface"]}; border-radius: {r}px; padding: 4px 12px;">{row("Status", "—")}{row("Arrives", "—")}{row("Carrier", "—")}</div>
<div style="font-size: 12px; color: {p["muted"]};">{{label}}</div>'''
    elif kind == "table":
        rows = "".join(
            f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); font-size: 11px; padding: 7px 0; border-bottom: 1px solid {p["line"]};"><span style="font-weight: 600;">{a}</span><span>{b}</span><span style="text-align: right;">{c}</span></div>'
            for a, b, c in [("Acme Corp", "Past due", "£4,200"), ("Globex", "Past due", "£2,950"), ("Initech", "Past due", "£1,120"), ("Umbrella", "Past due", "£860")]
        )
        inner = f'<div style="font-size: 16px; font-weight: 600;">Past due accounts</div><div style="font-size: 11px; color: {p["muted"]}; margin-top: -8px;">4 accounts · £9,130 overdue</div><div>{rows}</div><div style="margin-top: auto;">{pbtn("Send reminders")}</div>'
    else:
        inner = ""
    lbl = f'<div style="font-size: 12px; color: {S["muted"]}; margin-top: 8px; text-align: center;">{label_text}</div>' if label_text else ""
    return f'''<div style="display: flex; flex-direction: column; flex-shrink: 0;">
<div style="width: {w}px; min-height: {h}px; box-sizing: border-box; border-radius: 14px; border: 1px solid {S["line"]}; background: {p["bg"]}; color: {p["ink"]}; font-family: {p["font"]}; padding: 18px; display: flex; flex-direction: column; gap: 12px;">{inner}</div>{lbl}
</div>'''


def mini_desktop(kind="send", pack="northwind", w=620, h=380, label_text=None):
    """The same generated surface at desktop width, in a browser frame: what a person on a laptop sees."""
    p = PACK[pack]
    r = p["radius"]
    br = min(r, 12) if r else 0

    def pbtn(t, primary=True):
        bg = p["primary"] if primary else "transparent"
        fg = p["on_primary"] if primary else p["primary"]
        return f'<span style="height: 30px; border-radius: {br}px; border: 1px solid {p["primary"]}; background: {bg}; color: {fg}; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; white-space: nowrap;">{t}</span>'

    def row(k, v):
        return f'<div style="display: flex; justify-content: space-between; font-size: 11px; padding: 6px 0; border-bottom: 1px solid {p["line"]};"><span style="color: {p["muted"]};">{k}</span><span style="font-weight: 500;">{v}</span></div>'

    if kind == "send":
        inner = f'''<div style="display: flex; gap: 20px; align-items: flex-start;">
<div style="flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 10px;"><div style="font-size: 16px; font-weight: 600;">Send money</div>
<div style="display: flex; gap: 10px; align-items: center; padding: 10px; border: 1px solid {p["line"]}; border-radius: {br}px;"><span style="width: 28px; height: 28px; border-radius: 50%; background: {p["surface"]}; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;">AK</span><div><div style="font-size: 12px; font-weight: 600;">Alex Kim</div><div style="font-size: 10px; color: {p["muted"]};">Monzo ····8812</div></div></div>
<div style="font-size: 36px; font-weight: 600; letter-spacing: -0.02em;">£40.00</div><div style="font-size: 11px; color: {p["muted"]}; margin-top: -8px;">For concert tickets</div></div>
<div style="flex: 0 1 46%; min-width: 0; background: {p["surface"]}; border-radius: {br}px; padding: 12px; display: flex; flex-direction: column; gap: 6px;"><div style="font-size: 12px; font-weight: 600;">Summary</div>{row("From", "Everyday ····4521")}{row("Arrives", "Instantly")}{row("Fee", "£0.00")}<div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">{pbtn("Send £40.00")}{pbtn("Cancel", False)}</div></div>
</div>'''
    elif kind == "plans":
        cards = ""
        for name, price, rec in [("Basic", "£2", False), ("Plus", "£5", True), ("Pro", "£9", False)]:
            border = f"2px solid {p['primary']}" if rec else f"1px solid {p['line']}"
            badge = f'<span style="font-size: 9px; font-weight: 700; color: {p["primary"]};">RECOMMENDED</span>' if rec else '<span style="font-size: 9px;">&#160;</span>'
            cards += f'<div style="flex: 1 1 0; min-width: 0; border: {border}; border-radius: {br}px; padding: 10px; display: flex; flex-direction: column; gap: 6px;">{badge}<strong style="font-size: 13px;">{name}</strong><span style="font-size: 18px; font-weight: 600;">{price}<span style="font-size: 10px; color: {p["muted"]}; font-weight: 400;">/mo</span></span><span style="font-size: 10px; color: {p["muted"]};">{ {"Basic": "100 GB", "Plus": "2 TB", "Pro": "5 TB"}[name]}</span>{pbtn("Choose", rec)}</div>'
        inner = f'<div style="font-size: 16px; font-weight: 600;">More storage: Plus fits</div><div style="font-size: 11px; color: {p["muted"]}; margin-top: -6px;">You use 180 GB of 200 GB.</div><div style="display: flex; gap: 12px;">{cards}</div>'
    elif kind == "delete":
        inner = f'''<div style="position: relative; flex-grow: 1; min-height: 240px;">
<div style="font-size: 16px; font-weight: 600; opacity: .35;">Account settings</div>
<div style="position: absolute; inset: 0; background: rgba(0,0,0,.25); border-radius: 6px;"></div>
<div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 300px; background: {p["bg"]}; border-radius: {br}px; padding: 16px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.2);"><div style="font-size: 14px; font-weight: 600;">Delete your account?</div><div style="font-size: 11px; color: {p["muted"]};">Kept for 30 days, then deleted for good.</div>{row("Projects", "12")}{row("Files", "2,381")}<div style="font-size: 11px; font-weight: 600;">Type DELETE to confirm</div><div style="height: 26px; border: 1px solid {p["line"]}; border-radius: {min(br, 6)}px;"></div><div style="display: flex; gap: 8px; justify-content: flex-end;">{pbtn("Keep my account", False)}<span style="height: 30px; border-radius: {br}px; background: #B42318; color: #FFFFFF; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; padding: 0 14px;">Delete account</span></div></div>
</div>'''
    elif kind == "table":
        head = f'<div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); font-size: 10px; color: {p["muted"]}; padding: 6px 0; border-bottom: 1px solid {p["line"]};"><span>Account</span><span>Owner</span><span>Plan</span><span style="text-align: right;">Overdue</span><span style="text-align: right;">Days late</span></div>'
        rows = "".join(f'<div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); font-size: 11px; padding: 7px 0; border-bottom: 1px solid {p["line"]};"><span style="font-weight: 600;">{a}</span><span>{o}</span><span>{pl}</span><span style="text-align: right;">{m}</span><span style="text-align: right;">{d}</span></div>' for a, o, pl, m, d in [("Acme Corp", "Rhea", "Enterprise", "£4,200", "41"), ("Globex", "Tom", "Growth", "£2,950", "18"), ("Initech", "Rhea", "Growth", "£1,120", "12"), ("Umbrella", "Sam", "Starter", "£860", "6")])
        inner = f'<div style="display: flex; justify-content: space-between; align-items: center;"><div><div style="font-size: 16px; font-weight: 600;">Past due accounts</div><div style="font-size: 11px; color: {p["muted"]};">4 accounts · £9,130 overdue</div></div>{pbtn("Send reminders")}</div><div>{head}{rows}</div>'
    elif kind == "blank":
        inner = f'<div style="font-size: 16px; font-weight: 600;">Order details</div><div style="font-size: 11px; color: {p["muted"]}; margin-top: -6px;">Order details</div><div style="display: flex; gap: 12px;"><div style="flex: 1 1 0; background: {p["surface"]}; border-radius: {br}px; padding: 6px 12px;">{row("Status", "—")}{row("Arrives", "—")}{row("Carrier", "—")}</div><div style="flex: 1 1 0; font-size: 11px; color: {p["muted"]};">{{label}}</div></div>'
    else:
        inner = ""
    nav = "" if w < 500 else f'<div style="width: 110px; flex-shrink: 0; border-right: 1px solid {p["line"]}; padding: 12px 10px; display: flex; flex-direction: column; gap: 8px;">{"".join(f"<span style=\"height: 8px; border-radius: 4px; background: {p['line']}; width: {x}%;\"></span>" for x in (80, 60, 70, 55, 65))}</div>'
    lbl = f'<div style="font-size: 12px; color: {S["muted"]}; margin-top: 8px; text-align: center;">{label_text}</div>' if label_text else ""
    return f'''<div style="display: flex; flex-direction: column; flex-shrink: 0;">
<div style="width: {w}px; min-height: {h}px; box-sizing: border-box; border-radius: 10px; border: 1px solid {S["line"]}; background: {p["bg"]}; overflow: hidden; display: flex; flex-direction: column;">
<div aria-hidden="true" style="height: 24px; flex-shrink: 0; display: flex; align-items: center; gap: 5px; padding: 0 10px; background: {S["soft"]};"><span style="width: 7px; height: 7px; border-radius: 50%; background: {S["line"]};"></span><span style="width: 7px; height: 7px; border-radius: 50%; background: {S["line"]};"></span><span style="width: 7px; height: 7px; border-radius: 50%; background: {S["line"]};"></span></div>
<div style="flex-grow: 1; display: flex; color: {p["ink"]}; font-family: {p["font"]};">{nav}<div style="flex-grow: 1; min-width: 0; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;">{inner}</div></div>
</div>{lbl}
</div>'''
