"""Studio: the design-system flows, sized for real token sets.

A real import is thousands of tokens in three tiers — primitives (brand/600), semantic tokens that
alias them (action/primary), and component tokens (button.primary.bg) — and of every type, not
just colour. Studio maps Polyxd's 87 roles onto your semantic tier, keeps the component tier for
your own components, and shows every alias chain down to the primitive.
"""
from kit import (S, TONE, BODY, DISPLAY, MONO, ic, doc, tag, dot, btn, avatar, label, field, textarea, select, switch,
                 checkbox, radio, segmented, swatch, meter, mono, card, h2, notice, table, search, filter_chip, tabs,
                 app, page_head, drawer, dialog, toast, mini_surface, mini_desktop, kbd)

CRUMB = ["Northwind", "Foundations", "Design systems"]


def chain(*steps, tone="gray"):
    """An alias chain: role ← semantic ← primitive."""
    arrow = f'<span aria-hidden="true" style="color: {S["muted"]}; font-size: 11px;">→</span>'
    return f'<span style="display: inline-flex; gap: 4px 6px; align-items: center; flex-wrap: wrap;">{arrow.join(mono(x, 12, S["ink"] if i == 0 else S["ink2"]) for i, x in enumerate(steps))}</span>'


def ds_list():
    def pack_card(name, sub, meta, colors, status, footer):
        sw = "".join(swatch(c, 22) for c in colors)
        return card(f'''<div style="display: flex; justify-content: space-between; align-items: flex-start;"><div style="display: flex; gap: 4px;">{sw}</div>{status}</div>
<div><h3 style="margin: 0; font-size: 15px; font-weight: 600;">{name}</h3><p style="margin: 2px 0 0; font-size: 13px; color: {S["muted"]};">{sub}</p></div>
<div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: {S["muted"]};">{meta}</div>
<div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid {S["soft"]}; padding-top: 12px;"><span style="font-size: 13px; color: {S["muted"]};">{footer}</span>{btn("More actions for " + name, "ghost", "dots_h", h=28, only_icon=True)}</div>''', pad=18)
    yours = f'''<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">
{pack_card("Northwind", "Figma variables · v7", "<span>3,142 tokens · light, dark, high contrast</span><span>87 of 87 roles · 34 of 34 contrast pairs</span>", ["#1849A9", "#101828", "#F5F7FA", "#079455", "#D92D20"], tag("Default", "ink"), "Web · 3 surfaces")}
{pack_card("Northwind Marketing", "Tokens Studio · v2", "<span>1,288 tokens · light</span><span>85 of 87 roles · 32 of 34 contrast pairs</span>", ["#E04F16", "#101828", "#FFF6ED", "#079455", "#D92D20"], tag("2 to fix", "warn"), "1 experiment")}
<button type="button" style="border: 1.5px dashed {S["line"]}; border-radius: 12px; background: {S["sunk"]}; color: {S["ink2"]}; font-family: {BODY}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 206px;">{ic("plus", 22)}<span style="font-weight: 600; font-size: 14px;">Import a design system</span><span style="font-size: 12px; color: {S["muted"]};">Figma variables, Tokens Studio, DTCG or CSS</span></button>
</div>'''
    lib = ""
    for n, c in [("Material 3", ["#65558F", "#1D1B20", "#FDF7FF"]), ("IBM Carbon", ["#0F62FE", "#161616", "#F4F4F4"]), ("Ant Design", ["#1677FF", "#000000", "#F5F5F5"]),
                 ("Fluent 2", ["#0F6CBD", "#242424", "#F5F5F5"]), ("shadcn/ui", ["#18181B", "#09090B", "#F4F4F5"]), ("Shopify Polaris", ["#303030", "#1A1A1A", "#F1F1F1"]),
                 ("GitHub Primer", ["#1F883D", "#1F2328", "#F6F8FA"]), ("GOV.UK Frontend", ["#00703C", "#0B0C0C", "#F3F2F1"])]:
        lib += f'<li style="display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid {S["soft"]};"><span style="display: flex; gap: 3px;">{"".join(swatch(x, 16) for x in c)}</span><span style="flex-grow: 1; min-width: 0; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{n}</span>{btn("Preview", "ghost", h=28)}</li>'
    body = page_head("Design systems", "The token sets your screens are drawn in. Each maps your tokens onto Polyxd's 87 roles and is checked for contrast in every mode.", btn("Import", "primary", "upload"), tabs_html=tabs([("Yours", 2), ("Built in", 13)], "Yours")) + f'''<div style="padding: 20px 32px 32px; display: flex; gap: 24px; align-items: flex-start;">
<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px;">{yours}
{notice("Northwind Marketing has 2 contrast pairs that fail", "Text on the orange action is 3.1:1 in light mode. Studio suggests a darker step from your own ramp.", "warn", btn("Fix", "secondary", h=32))}</div>
<div style="width: 320px; flex-shrink: 0;">{card(h2("Built-in design systems", "Preview your screens in one, or start from it.") + f'<ul style="list-style: none; margin: 0; padding: 0;">{lib}</ul><a href="#" style="font-size: 13px; font-weight: 500;">See all 13</a>', pad=20, gap=6)}</div>
</div>'''
    return app("Design systems", "Design systems", CRUMB, body)


def ds_import():
    sources = ""
    for name, sub, icon_name, on in [("Figma variables", "Connect a file: collections, modes and aliases come across", "figma", True),
                                     ("Tokens Studio", "Upload the JSON export, or point at the repo", "code", False),
                                     ("W3C design tokens (DTCG)", "Any .tokens.json, including Style Dictionary output", "code", False),
                                     ("CSS variables", "Paste or upload tokens.css", "code", False),
                                     ("Start from a built-in", "Pick one of the 13 and change what's yours", "layers", False)]:
        border = f"2px solid {S['ink']}" if on else f"1px solid {S['line']}"
        sources += f'<label style="box-sizing: border-box; border: {border}; border-radius: 12px; padding: 14px 16px; display: flex; gap: 14px; align-items: flex-start; background: {S["paper"]};"><input type="radio" name="source"{" checked" if on else ""} style="width: 16px; height: 16px; margin: 3px 0 0; accent-color: {S["ink"]};"><span style="display: flex; color: {S["ink2"]};">{ic(icon_name, 22)}</span><span><span style="display: block; font-weight: 600;">{name}</span><span style="font-size: 13px; color: {S["muted"]};">{sub}</span></span></label>'
    files = "".join(f'<li style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid {S["soft"]};">{ic("check_circle", 18, S["ok"])}<div style="flex-grow: 1;"><div style="font-weight: 500;">{n}</div><div style="font-size: 12px; color: {S["muted"]};">{d}</div></div>{checkbox(True, "Include " + n)}</li>' for n, d in [("Primitives", "1,846 variables · 1 mode"), ("Semantic", "904 variables · Light, Dark, High contrast"), ("Components", "392 variables · Light, Dark"), ("Density", "46 variables · Comfortable, Compact")])
    right = f'''<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px;"><h2 style="margin: 0 0 4px; font-size: 15px;">2. Which file and collections</h2>
<div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid {S["line"]}; border-radius: 10px;">{ic("figma", 20)}<div style="flex-grow: 1;"><div style="font-weight: 500;">Northwind · Tokens</div><div style="font-size: 12px; color: {S["muted"]};">figma.com/design/k7Q… · edited 2 hours ago</div></div>{btn("Change file", "ghost", h=30)}</div>
<ul style="list-style: none; margin: 0; padding: 0;">{files}</ul>
{field("Name this design system", "Northwind", "pack-name")}
{notice("Nothing is used until you've checked it", "Studio scans the file first, then shows every mapping before a single screen draws with it.", "gray")}
<div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">{btn("Cancel", "ghost")}{btn("Scan 4 collections", "primary", trail_icon="arrow_r")}</div></div>'''
    body = page_head("Import a design system", "Bring your tokens as they are: primitives, semantic tokens and component tokens, of every type.") + f'''<div style="padding: 8px 32px 32px; display: flex; gap: 32px; align-items: flex-start;">
<div style="width: 460px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px;"><h2 style="margin: 0 0 4px; font-size: 15px;">1. Where are your tokens?</h2>{sources}</div>
{right}
</div>'''
    return app("Import a design system", "Design systems", CRUMB + ["Import"], body)


def ds_scan():
    tiers = "".join(card(f'<span style="font-size: 13px; color: {S["muted"]};">{t}</span><span style="font-family: {DISPLAY}; font-size: 28px; font-weight: 700; line-height: 34px;">{n}</span><span style="font-size: 12px; color: {S["ink2"]};">{d}</span>', pad=16, gap=4) for t, n, d in [("Primitives", "1,846", "Raw values: brand/600, space/4, font/size/16"), ("Semantic", "904", "What things mean: action/primary, text/subtle"), ("Component", "392", "Per component: button/primary/bg, input/border")])
    types = [("Colour", 1204, 612, 468, 124), ("Dimension (space, size)", 612, 402, 132, 78), ("Typography (composite)", 188, 0, 96, 92), ("Font family, weight", 15, 15, 0, 0), ("Line height, letter spacing", 36, 36, 0, 0), ("Radius", 18, 10, 6, 2), ("Border", 48, 12, 22, 14), ("Shadow (elevation)", 36, 18, 12, 6), ("Opacity", 12, 12, 0, 0), ("Duration, easing", 22, 16, 6, 0), ("Z-index", 11, 0, 11, 0), ("Breakpoint", 6, 6, 0, 0)]
    rows = [[t, f"{a:,}", f"{b:,}", f"{c:,}", f"{d:,}"] for t, a, b, c, d in types]
    type_table = table(["Type", "Total", "Primitive", "Semantic", "Component"], rows, aligns=["left", "right", "right", "right", "right"], widths=[None, 90, 100, 100, 110], row_h=38, caption="Tokens by type")
    modes = "".join(f'<li style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid {S["soft"]};"><div style="flex-grow: 1;"><div style="font-weight: 500;">{n}</div><div style="font-size: 12px; color: {S["muted"]};">{d}</div></div><select aria-label="Use {n} as" style="height: 32px; border: 1px solid {S["line"]}; border-radius: 6px; padding: 0 8px; font-family: {BODY}; font-size: 13px;"><option>{u}</option></select></li>' for n, d, u in [("Light", "Semantic, Components", "Light mode"), ("Dark", "Semantic, Components", "Dark mode"), ("High contrast", "Semantic", "High-contrast mode"), ("Comfortable · Compact", "Density", "Density setting")])
    issues = "".join(f'<li style="display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid {S["soft"]};">{dot(t)}<div style="flex-grow: 1;"><div style="font-size: 14px; font-weight: 500;">{a}</div><div style="font-size: 12px; color: {S["muted"]};">{b}</div></div><a href="#" style="font-size: 13px;">Review</a></li>' for t, a, b in [("bad", "14 broken references", "{color.brand.650} doesn't exist; 9 are in Components"), ("bad", "3 circular aliases", "action/primary → brand/primary → action/primary"), ("warn", "22 deprecated tokens", "Marked $deprecated; Studio won't map to them"), ("gray", "5 types Polyxd doesn't use", "Gradients and asset URLs are kept, not mapped")])
    body = page_head("We found 3,142 tokens", "Northwind · Tokens, 4 collections. Here's what's in it before anything is mapped.", f'{btn("Back", "ghost")}{btn("Map to Polyxd roles", "primary", trail_icon="arrow_r")}') + f'''<div style="padding: 16px 32px 32px; display: flex; gap: 24px; align-items: flex-start;">
<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px;">
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px;">{tiers}</div>
{card(h2("By type and tier") + type_table, pad=20, gap=8)}
</div>
<div style="width: 400px; flex-shrink: 0; display: flex; flex-direction: column; gap: 18px;">
{card(h2("Modes and themes", "What each becomes in Polyxd.") + f'<ul style="list-style: none; margin: 0; padding: 0;">{modes}</ul>', pad=20, gap=6)}
{card(h2("To look at", "None of these stop the import.") + f'<ul style="list-style: none; margin: 0; padding: 0;">{issues}</ul>', pad=20, gap=6)}
</div>
</div>'''
    return app("Scan results", "Design systems", CRUMB + ["Import", "Scan"], body)


def ds_mapping():
    groups = "".join(
        f'<a href="#" aria-current="{"true" if on else "false"}" style="display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 10px; color: {S["ink"]}; background: {S["soft"] if on else "transparent"};"><span style="display: flex; justify-content: space-between; font-size: 14px; font-weight: {600 if on else 500};"><span>{n}</span><span style="color: {S["muted"]}; font-weight: 400;">{d} of {t}</span></span>{meter(round(d / t * 100), "ok" if d == t else "warn", 160, 4)}</a>'
        for n, d, t, on in [("Colour", 38, 43, True), ("Type", 8, 8, False), ("Space", 10, 10, False), ("Radius", 5, 5, False), ("Elevation", 2, 2, False), ("Motion", 5, 7, False), ("Size", 3, 3, False), ("Border and focus", 4, 4, False), ("Opacity", 4, 4, False), ("Layout", 2, 3, False)]
    )
    rows = [
        ("color.action.primary", ("action/primary", "brand/600"), ["#1849A9", "#84ADFF", "#0B2E7A"], tag("Exact", "ok")),
        ("color.action.primaryHover", ("action/primary-hover", "brand/700"), ["#1D3A8A", "#B2CCFF", "#081F57"], tag("Exact", "ok")),
        ("color.text.default", ("text/primary", "gray/900"), ["#101828", "#F5F5F6", "#000000"], tag("Exact", "ok")),
        ("color.text.subtle", ("text/tertiary", "gray/400"), ["#98A2B3", "#94969C", "#475467"], tag("Fails contrast", "bad")),
        ("color.status.danger", ("text/error", "error/600"), ["#D92D20", "#F97066", "#912018"], tag("Guessed", "info")),
        ("color.selection.fill", ("—",), ["", "", ""], tag("Missing", "warn")),
        ("color.data.positive", ("brand/success", ), ["#079455", "#47CD89", "#054F31"], tag("Primitive", "warn")),
    ]
    trs = ""
    for i, (role, ch, vals, st) in enumerate(rows):
        sel = i == 3
        cells = f'<td style="padding: 0 8px; border-bottom: 1px solid {S["soft"]};"><span style="display: inline-flex; gap: 4px;">{"".join(swatch(v, 18) if v else mono("—") for v in vals[:2])}</span></td>'
        tok = f'<span style="display: flex; flex-direction: column; gap: 2px;">{mono(ch[0], 12, S["ink"])}{mono("→ " + ch[1], 12, S["muted"]) if len(ch) > 1 else ""}</span>'
        trs += f'<tr style="background: {S["signal_bg"] if sel else "transparent"};"><td style="padding: 0 12px; height: 52px; border-bottom: 1px solid {S["soft"]}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{mono(role, 12, S["ink"])}</td><td style="padding: 0 12px; border-bottom: 1px solid {S["soft"]};">{tok}</td>{cells}<td style="padding: 0 12px; border-bottom: 1px solid {S["soft"]};">{st}</td></tr>'
    head = "".join(f'<th scope="col" style="text-align: left; font-size: 12px; font-weight: 500; color: {S["muted"]}; padding: 0 {8 if h == "Light · dark" else 12}px; white-space: nowrap; height: 36px; border-bottom: 1px solid {S["line"]}; width: {w};">{h}</th>' for h, w in [("Polyxd role", "186px"), ("Your token", "auto"), ("Light · dark", "56px"), ("Match", "104px")])
    table_html = f'<table style="width: 100%; border-collapse: collapse; table-layout: fixed;"><caption style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);">Role mapping</caption><thead><tr>{head}</tr></thead><tbody>{trs}</tbody></table>'
    panel = f'''<aside aria-label="Selected role" style="width: 320px; flex-shrink: 0; border-left: 1px solid {S["line"]}; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; background: {S["sunk"]};">
<div>{mono("color.text.subtle", 14, S["ink"])}<p style="margin: 6px 0 0; font-size: 13px; color: {S["muted"]};">Secondary text: captions, help, timestamps. Must reach 4.5:1 on every surface, in every mode.</p></div>
<div style="display: flex; flex-direction: column; gap: 6px;"><strong style="font-size: 13px;">Now</strong><div style="padding: 10px 12px; border-radius: 10px; background: {S["paper"]}; border: 1px solid {S["line"]}; display: flex; flex-direction: column; gap: 6px;">{chain("text/tertiary", "gray/400")}<span style="font-size: 12px; color: {S["bad"]};">2.6:1 on white · fails in light; passes in dark and high contrast</span></div></div>
<div style="display: flex; flex-direction: column; gap: 8px;"><strong style="font-size: 13px;">Candidates from your semantic tokens</strong>
{"".join(f'<label style="display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 10px; border: {"2px solid " + S["ink"] if on else "1px solid " + S["line"]}; background: {S["paper"]};"><input type="radio" name="fix"{" checked" if on else ""} style="margin: 0; width: 16px; height: 16px; accent-color: {S["ink"]};"><span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">{chain(a, b)}<span style="font-size: 12px; color: {S["muted"]};">{why}</span></span><span style="font-size: 13px; font-weight: 600; color: {S["ok"]};">{r}</span></label>' for a, b, why, r, on in [("text/secondary", "gray/500", "Passes in all three modes", "4.8:1", True), ("text/muted", "gray/600", "Used by 212 of your components", "7.4:1", False)])}
</div>
{notice("Prefer semantic tokens", "Mapping a role straight to a primitive (brand/success) works, but a rebrand then skips it. Studio flags those.", "gray")}
<div style="display: flex; flex-direction: column; gap: 8px; margin-top: auto;">{btn("Use text/secondary", "primary", w=272)}{btn("Search all your tokens", "secondary", "search", w=272)}</div>
</aside>'''
    component_note = notice("392 component tokens are kept for your own components", "button/*, input/*, card/* and 38 more groups. When you connect a component in Components, it draws with these, not with Polyxd's roles.", "info", btn("See them", "secondary", h=32))
    body = page_head("Map to Polyxd's roles", "Your 904 semantic tokens were matched to Polyxd's 87 roles by name, type and value. Accept the exact ones in one go and look only at the rest.", f'{btn("Save draft", "secondary")}{btn("Create design system", "primary")}', meta=f'<span style="font-size: 13px; color: {S["ink2"]};"><strong>81 of 87</strong> mapped · 71 exact · 10 guessed · 3 missing · 1 fails contrast · 2 point at primitives</span>') + f'''<div style="flex-grow: 1; min-height: 0; display: flex; margin-top: 14px; border-top: 1px solid {S["line"]};">
<nav aria-label="Role groups" style="width: 204px; flex-shrink: 0; padding: 16px 10px 16px 18px; display: flex; flex-direction: column; gap: 2px;">{groups}</nav>
<div style="flex-grow: 1; min-width: 0; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;">
<div style="display: flex; gap: 8px; align-items: center;">{search("Search roles or tokens", 200)}{filter_chip("Needs a look", True, 16)}<span style="margin-left: auto;">{btn("Accept 71 exact", "secondary", "check", h=32)}</span></div>
{table_html}
<div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: {S["muted"]};"><span>7 of 43 colour roles · {kbd("J")} {kbd("K")} to move, {kbd("Enter")} to accept</span><a href="#">Show all 43</a></div>
{component_note}
</div>
{panel}
</div>'''
    return app("Map tokens", "Design systems", CRUMB + ["Import", "Map"], body)


def detail_head(active):
    return page_head("Northwind", "Figma variables · synced 2 hours ago · default for web. Changes reach production only through a release.", f'{btn("Compare versions", "secondary", "history")}{btn("Sync from Figma", "secondary", "repeat")}{btn("More actions", "secondary", "dots_h", only_icon=True)}', meta=f'{tag("Default", "ink")}{tag("Draft: 2 changes", "signal")}<span style="font-size: 13px; color: {S["muted"]};">87 of 87 roles · 34 of 34 contrast pairs in light, dark and high contrast</span>', tabs_html=tabs([("Polyxd roles", 87), ("Your tokens", "3,142"), ("Contrast", 34), "Preview", ("Versions", 7)], active))


def ds_detail(overlay=""):
    groups = [
        ("Action", [("color.action.primary", "action/primary", "#1849A9", "#84ADFF", "5.9 · 6.1"), ("color.action.primaryHover", "action/primary-hover", "#1D3A8A", "#B2CCFF", "7.6 · 8.9"), ("color.action.danger", "action/destructive", "#D92D20", "#F97066", "4.5 · 5.2")]),
        ("Text", [("color.text.default", "text/primary", "#101828", "#F5F5F6", "17.4 · 16.1"), ("color.text.subtle", "text/secondary", "#667085", "#94969C", "4.8 · 6.3")]),
        ("Surface", [("color.surface.default", "bg/primary", "#FFFFFF", "#0C111D", "—"), ("color.surface.raised", "bg/secondary", "#FFFFFF", "#161B26", "—")]),
    ]
    rows = ""
    td = f'padding: 0 14px; border-bottom: 1px solid {S["soft"]};'
    for g, items in groups:
        rows += f'<tr><th colspan="6" scope="colgroup" style="text-align: left; font-size: 12px; font-weight: 600; color: {S["muted"]}; padding: 16px 14px 6px; letter-spacing: 0.04em; text-transform: uppercase;">{g}</th></tr>'
        for n, tok, l, d, c in items:
            sel = n == "color.action.primary" and overlay
            rows += f'<tr style="background: {S["signal_bg"] if sel else "transparent"};"><td style="{td} height: 44px;">{mono(n, 13, S["ink"])}</td><td style="{td}">{mono(tok)}</td><td style="{td}"><span style="display: inline-flex; gap: 8px; align-items: center;">{swatch(l, 18)}{mono(l)}</span></td><td style="{td}"><span style="display: inline-flex; gap: 8px; align-items: center;">{swatch(d, 18)}{mono(d)}</span></td><td style="{td} font-size: 13px; color: {S["muted"]};">{c}</td><td style="{td} text-align: right;">{btn("Edit " + n, "ghost", "edit", h=28, only_icon=True)}</td></tr>'
    head = "".join(f'<th scope="col" style="text-align: left; font-size: 12px; font-weight: 500; color: {S["muted"]}; padding: 0 14px; height: 36px; border-bottom: 1px solid {S["line"]};">{h}</th>' for h in ["Role", "Your token", "Light", "Dark", "Contrast", ""])
    tokens = f'<table style="width: 100%; border-collapse: collapse;"><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>'
    groupnav = "".join(f'<a href="#" style="display: flex; justify-content: space-between; padding: 7px 10px; border-radius: 8px; font-size: 14px; color: {S["ink"]}; background: {S["soft"] if on else "transparent"}; font-weight: {600 if on else 500};"><span>{n}</span><span style="color: {S["muted"]};">{c}</span></a>' for n, c, on in [("Colour", 43, True), ("Type", 8, False), ("Space", 10, False), ("Radius", 5, False), ("Elevation", 2, False), ("Motion", 7, False), ("Size", 3, False), ("Border and focus", 4, False), ("Opacity", 4, False), ("Layout", 3, False)])
    body = detail_head("Polyxd roles") + f'''<div style="display: flex; gap: 24px; padding: 16px 32px 32px;">
<nav aria-label="Role groups" style="width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px;">{groupnav}</nav>
<div style="flex-grow: 1; min-width: 0;">{tokens}</div>
</div>'''
    return app("Northwind design system", "Design systems", CRUMB + ["Northwind"], body, overlay=overlay)


def ds_source():
    def node(label_text, count, depth=0, open_=False, on=False, leaf=False):
        chev = "" if leaf else ic("chev_d" if open_ else "chev_r", 14)
        return f'<a href="#" aria-expanded="{"true" if open_ else "false"}" style="display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px {8 + depth * 16}px; border-radius: 6px; font-size: 13px; color: {S["ink"]}; background: {S["soft"] if on else "transparent"}; font-weight: {600 if on else 500};"><span style="width: 14px; display: flex; color: {S["muted"]};">{chev}</span><span style="flex-grow: 1;">{label_text}</span><span style="color: {S["muted"]}; font-weight: 400;">{count}</span></a>'
    tree = "".join([
        node("Primitive", "1,846", 0, True), node("color", "612", 1, True), node("brand", "12", 2, False, True), node("gray", "12", 2), node("error", "12", 2), node("…9 more", "576", 2, leaf=True),
        node("space", "32", 1), node("font", "54", 1), node("shadow", "18", 1),
        node("Semantic", "904", 0, True), node("action", "48", 1), node("text", "36", 1), node("bg", "42", 1),
        node("Component", "392", 0, True), node("button", "64", 1), node("input", "52", 1), node("…41 more", "276", 1, leaf=True),
    ])
    rows = [
        ["brand/500", "Colour", f'<span style="display: inline-flex; gap: 8px; align-items: center;">{swatch("#2970FF", 16)}{mono("#2970FF")}</span>', "—", "4"],
        ["brand/600", "Colour", f'<span style="display: inline-flex; gap: 8px; align-items: center;">{swatch("#1849A9", 16)}{mono("#1849A9")}</span>', "—", "31"],
        ["brand/650", "Colour", f'<span style="color: {S["bad"]}; font-size: 13px;">Missing</span>', "—", "9 broken"],
        ["brand/700", "Colour", f'<span style="display: inline-flex; gap: 8px; align-items: center;">{swatch("#1D3A8A", 16)}{mono("#1D3A8A")}</span>', "—", "18"],
        ["brand/800", "Colour", f'<span style="display: inline-flex; gap: 8px; align-items: center;">{swatch("#1D2F6F", 16)}{mono("#1D2F6F")}</span>', tag("Deprecated", "warn"), "0"],
    ]
    table_rows = [[mono(a, 13, S["ink"]), c, d, e] for a, b, c, d, e in rows]
    detail = f'''<aside aria-label="brand/600" style="width: 320px; flex-shrink: 0; border-left: 1px solid {S["line"]}; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; background: {S["sunk"]};">
<div style="display: flex; gap: 12px; align-items: center;">{swatch("#1849A9", 40)}<div>{mono("brand/600", 15, S["ink"])}<div style="font-size: 12px; color: {S["muted"]};">Primitive · colour · #1849A9</div></div></div>
<div style="display: flex; flex-direction: column; gap: 8px;"><strong style="font-size: 13px;">Referenced by 31 tokens</strong>
{"".join(f'<div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid {S["soft"]};">{mono(a, 12, S["ink"])}<span style="color: {S["muted"]};">{b}</span></div>' for a, b in [("action/primary", "Semantic · light"), ("border/brand", "Semantic · light"), ("button/primary/bg", "Component"), ("link/default", "Semantic · light"), ("+ 27 more", "")])}</div>
<div style="display: flex; flex-direction: column; gap: 8px;"><strong style="font-size: 13px;">Reaches Polyxd as</strong>{chain("color.action.primary", "action/primary", "brand/600")}{chain("color.border.focus", "border/brand", "brand/600")}</div>
<div style="font-size: 12px; color: {S["muted"]};">Edit primitives in Figma: Studio syncs them. Here you choose which of them your roles point at.</div>
</aside>'''
    body = detail_head("Your tokens") + f'''<div style="flex-grow: 1; min-height: 0; display: flex; border-top: 1px solid {S["line"]}; margin-top: 0;">
<nav aria-label="Token groups" style="width: 240px; flex-shrink: 0; padding: 14px 12px 14px 20px; display: flex; flex-direction: column; gap: 1px; border-right: 1px solid {S["soft"]};">{search("Filter 3,142 tokens", 208)}<div style="height: 10px;"></div>{tree}</nav>
<div style="flex-grow: 1; min-width: 0; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;">
<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;"><span style="font-weight: 600;">color / brand</span><span style="color: {S["muted"]}; font-size: 13px;">12 tokens</span><span style="margin-left: auto; display: flex; gap: 8px;">{filter_chip("Broken", False, 14)}{filter_chip("Deprecated", False, 22)}{filter_chip("Unused", False, 208)}</span></div>
{table(["Token", "Value", "Status", "Used by"], table_rows, aligns=["left", "left", "left", "right"], widths=[110, None, 110, 70], row_h=42, selected=(1,), caption="Tokens in color/brand")}
</div>
{detail}
</div>'''
    return app("Northwind tokens", "Design systems", CRUMB + ["Northwind"], body)


def ds_token_edit():
    ramp = "".join(f'<button type="button" aria-label="{n} {c}" aria-pressed="{"true" if n == "brand/700" else "false"}" style="width: 36px; height: 36px; border-radius: 8px; background: {c}; border: {"3px solid " + S["signal"] if n == "brand/700" else "1px solid rgba(20,20,20,.12)"}; box-sizing: border-box;"></button>' for n, c in [("brand/300", "#84ADFF"), ("brand/400", "#528BFF"), ("brand/500", "#2970FF"), ("brand/600", "#1849A9"), ("brand/700", "#1D3A8A"), ("brand/800", "#1D2F6F"), ("brand/900", "#172554")])
    impact = table(["Pair", "Now", "After"], [
        ["Text on action", mono("5.9:1"), mono("7.6:1", 13, S["ok"])],
        ["Action on surface", mono("5.9:1"), mono("7.6:1", 13, S["ok"])],
        ["Focus ring on action", mono("3.4:1"), mono("2.4:1", 13, S["bad"])],
    ], aligns=["left", "right", "right"], widths=[None, 80, 80], row_h=40, pad_x=0)
    body = f'''<div style="display: flex; flex-direction: column; gap: 6px;">{mono("color.action.primary", 15, S["ink"])}<span style="font-size: 13px; color: {S["muted"]};">The main action on a screen. Used by Action (primary), Form submit, Confirm and Steps.</span>{chain("color.action.primary", "action/primary", "brand/700")}</div>
{segmented(["Light", "Dark", "High contrast"], "Light", "Mode")}
<div style="display: flex; flex-direction: column; gap: 8px;">{label("Point action/primary at a step on your brand ramp")}<div style="display: flex; gap: 8px;">{ramp}</div><span style="font-size: 12px; color: {S["muted"]};">Selected {mono("brand/700")} · {mono("#1D3A8A")}. This changes your semantic token, so button/primary/bg follows.</span></div>
<div style="display: flex; flex-direction: column; gap: 6px;"><strong style="font-size: 13px;">Contrast after this change</strong>{impact}</div>
{notice("The focus ring would fail on this action", "Focus on brand/700 is 2.4:1. Change focus/ring too, or keep brand/600.", "bad", btn("Fix focus too", "secondary", h=30))}
<div style="display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: {S["muted"]};">{ic("layers", 16)}<span>Reaches 14 Polyxd components and 23 of your component tokens. Nothing changes in production until a release.</span></div>'''
    return ds_detail(drawer("Edit colour", body, f'{btn("Cancel", "ghost")}{btn("Save to draft", "primary")}', w=520))


def ds_preview():
    phones = "".join(mini_surface(k, p, 250, 440, n) for k, p, n in [("send", "northwind", "Send money · light"), ("send", "northwind-dark", "Send money · dark")])
    desks = "".join(mini_desktop(k, "northwind", 560, 300, n) for k, n in [("table", "Past due accounts · desktop"), ("plans", "Compare plans · desktop")])
    body = detail_head("Preview") + f'''<div style="padding: 16px 32px 32px; display: flex; flex-direction: column; gap: 18px;">
<div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">{segmented(["Draft", "Live v7"], "Draft", "Version")}{segmented(["All widths", "Phone", "Desktop"], "All widths", "Width")}{segmented(["All modes", "Light", "Dark", "High contrast"], "All modes", "Mode")}<span style="margin-left: auto; font-size: 13px; color: {S["muted"]};">Real screens from the last 7 days, redrawn with the draft</span></div>
<div style="display: flex; gap: 20px; align-items: flex-start;">{phones}<div style="display: flex; flex-direction: column; gap: 20px;">{desks}</div></div>
</div>'''
    return app("Preview a design system", "Design systems", CRUMB + ["Northwind"], body)


def ds_delete():
    body = f'''<p style="margin: 0; font-size: 14px; color: {S["ink2"]};">Northwind Marketing is in use. Deleting it:</p>
<ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 22px; color: {S["ink2"]};"><li>stops the <strong>Spring promo</strong> experiment, which draws 10% of screens in it</li><li>moves those screens to <strong>Northwind</strong>, your default</li><li>keeps its 2 versions for 30 days, then deletes them</li></ul>
{field("Type Northwind Marketing to confirm", "", "confirm-delete", placeholder="Northwind Marketing")}'''
    return ds_list().replace("</main>", "</main>" + dialog("Delete Northwind Marketing?", body, f'{btn("Cancel", "secondary")}{btn("Delete design system", "danger")}', w=500), 1)
