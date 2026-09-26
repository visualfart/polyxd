"""Studio, first half: getting started, the design system (tokens) and components."""
from kit import (mini_desktop, S, TONE, BODY, DISPLAY, MONO, ic, doc, tag, dot, btn, avatar, label, field, textarea, select, switch,
                 checkbox, radio, segmented, swatch, meter, mono, card, h2, notice, table, search, filter_chip, tabs,
                 app, page_head, drawer, dialog, toast, mini_surface, kbd, scrim)


def stat(label_text, value, sub=None, tone=None, spark=None):
    s = f'<span style="font-size: 12px; color: {TONE[tone][1] if tone else S["muted"]};">{sub}</span>' if sub else ""
    return card(f'<span style="font-size: 13px; color: {S["muted"]};">{label_text}</span><div style="display: flex; align-items: baseline; gap: 10px;"><span style="font-family: {DISPLAY}; font-size: 30px; line-height: 36px; font-weight: 700;">{value}</span>{s}</div>{spark or ""}', pad=18, gap=6)


def spark(points, w=240, h=40, color=None):
    color = color or S["signal"]
    mx, mn = max(points), min(points)
    step = w / (len(points) - 1)
    pts = " ".join(f"{i * step:.1f},{h - 4 - (p - mn) / (mx - mn or 1) * (h - 8):.1f}" for i, p in enumerate(points))
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-hidden="true"><polyline points="{pts}" fill="none" stroke="{color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>'


# ---------------------------------------------------------------- getting started

def home():
    steps = [
        (True, "Connect your design system", "Northwind · 3,142 tokens · 87 of 87 roles mapped", "Design systems"),
        (True, "Map your components", "18 of 26 connected to @northwind/ui", "Components"),
        (False, "Set your direction", "Density, voice and the rules your screens follow", "Set direction"),
        (False, "Register what the product can do", "12 capabilities, 3 still need a risk level", "Capabilities"),
        (False, "Review your first 20 screens", "Your reviews teach Studio what good looks like", "Start reviewing"),
    ]
    rows = ""
    for done, t, sub, cta in steps:
        mark = f'<span style="width: 24px; height: 24px; border-radius: 50%; background: {S["ok"]}; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">{ic("check", 14, sw=2.5)}</span>' if done else f'<span aria-hidden="true" style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 50%; border: 2px solid {S["line"]}; flex-shrink: 0;"></span>'
        state = '<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);">Done: </span>' if done else ""
        action = f'<a href="#" style="font-size: 13px; font-weight: 500;">Open {cta.lower()}</a>' if done else btn(cta, "secondary", h=32)
        rows += f'<li style="display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid {S["soft"]};">{mark}<div style="flex-grow: 1;">{state}<div style="font-weight: 600; color: {S["muted"] if done else S["ink"]};">{t}</div><div style="font-size: 13px; color: {S["muted"]};">{sub}</div></div>{action}</li>'
    checklist = card(f'{h2("Get Northwind ready", "2 of 5 done. Screens generate as soon as a design system is connected; the rest makes them yours.", meter(40, "ok", 120))}<ol style="list-style: none; margin: 0; padding: 0;">{rows}</ol>', pad=24, gap=4)
    activity = "".join(
        f'<li style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid {S["soft"]};">{avatar(a, t, 26)}<div style="font-size: 13px; line-height: 18px;"><span style="font-weight: 600;">{who}</span> {what}<div style="color: {S["muted"]}; font-size: 12px;">{when}</div></div></li>'
        for a, t, who, what, when in [
            ("MR", "info", "Maya", "changed <strong>color.action.primary</strong> in Northwind", "12 min ago"),
            ("JL", "ok", "Jonas", "approved 6 screens for <em>transfer.confirm</em>", "1 hour ago"),
            ("PK", "signal", "Priya", "added the rule <em>Destructive actions name what is lost</em>", "Yesterday"),
            ("TA", "gray", "Tom", "connected <strong>Choice</strong> to @northwind/ui Select", "Yesterday"),
        ]
    )
    right = f'''<div style="display: flex; flex-direction: column; gap: 16px; width: 380px; flex-shrink: 0;">
{card(h2("Needs you") + f'<ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;"><li style="display: flex; gap: 10px; align-items: center;">{dot("signal")}<a href="#" style="color: {S["ink"]}; font-size: 14px;">18 screens waiting for review</a></li><li style="display: flex; gap: 10px; align-items: center;">{dot("warn")}<a href="#" style="color: {S["ink"]}; font-size: 14px;">2 contrast pairs fail in dark mode</a></li><li style="display: flex; gap: 10px; align-items: center;">{dot("bad")}<a href="#" style="color: {S["ink"]}; font-size: 14px;">Release 14 paused: agent task success fell 6%</a></li></ul>', pad=20)}
{card(h2("Recent activity") + f'<ul style="list-style: none; margin: 0; padding: 0;">{activity}</ul>', pad=20, gap=4)}
</div>'''
    stats = f'''<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;">
{stat("Screens generated, 7 days", "48,210", "+12%", "ok", spark([30, 34, 31, 38, 41, 40, 46]))}
{stat("Verifier score", "91", "+3", "ok", spark([84, 85, 87, 86, 88, 90, 91]))}
{stat("Accessibility checks passed", "99.2%", "−0.3%", "warn", spark([99.6, 99.5, 99.5, 99.4, 99.3, 99.4, 99.2], color=S["warn"]))}
{stat("Agent tasks completed", "87%", "+5%", "ok", spark([79, 80, 82, 83, 84, 86, 87]))}
</div>'''
    body = page_head("Good morning, Maya", "Here is how Northwind's generated screens are doing, and what's left to set up.", btn("Try a request", "secondary", "sparkle")) + f'''<div style="padding: 20px 32px 32px; display: flex; flex-direction: column; gap: 20px;">{stats}<div style="display: flex; gap: 20px; align-items: flex-start;"><div style="flex-grow: 1;">{checklist}</div>{right}</div></div>'''
    return app("Studio home", "Home", ["Northwind", "Home"], body)


def workspace_new():
    platforms = "".join(
        f'<label style="flex: 1 1 0; box-sizing: border-box; border: {"2px solid " + S["ink"] if on else "1px solid " + S["line"]}; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: {S["paper"]};"><span style="display: flex; justify-content: space-between; align-items: center;"><span style="display: flex; color: {S["ink2"]};">{ic(icon_name, 22)}</span><input type="checkbox"{" checked" if on else ""} style="width: 16px; height: 16px; margin: 0; accent-color: {S["ink"]};"></span><span style="font-weight: 600;">{name}</span><span style="font-size: 12px; color: {S["muted"]};">{sub}</span></label>'
        for name, sub, icon_name, on in [("Web", "React renderer", "monitor", True), ("iOS", "SwiftUI, coming", "phone", False), ("Android", "Compose, coming", "phone", False)]
    )
    steps = "".join(
        f'<li style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: {S["ink"] if i == 0 else S["muted"]}; font-weight: {600 if i == 0 else 500};"><span style="width: 22px; height: 22px; border-radius: 50%; background: {S["ink"] if i == 0 else S["soft"]}; color: {"#FFFFFF" if i == 0 else S["muted"]}; display: inline-flex; align-items: center; justify-content: center; font-size: 12px;">{i + 1}</span>{t}</li>'
        for i, t in enumerate(["Your product", "Design system", "Invite your team"])
    )
    form = f'''<div style="width: 560px; display: flex; flex-direction: column; gap: 22px;">
<ol aria-label="Setup steps" style="list-style: none; margin: 0; padding: 0; display: flex; gap: 24px;">{steps}</ol>
<div><h1 style="margin: 0; font-family: {DISPLAY}; font-size: 36px; line-height: 42px; font-weight: 700; letter-spacing: -0.02em;">Tell us about your product</h1>
<p style="margin: 8px 0 0; color: {S["muted"]}; font-size: 15px;">Studio sets up a workspace for one product. Everything here can be changed later.</p></div>
{field("Product name", "Northwind", "product")}
{field("Workspace address", "northwind", "address", prefix="studio.polyxd.com/", help_text="Your team signs in here.")}
<div style="display: flex; flex-direction: column; gap: 8px;">{label("Where do your screens appear?")}<div style="display: flex; gap: 12px;">{platforms}</div></div>
{select("What kind of product is it?", "Business software: dense tables, records, settings", "kind", help_text="Sets sensible starting defaults for density and patterns.")}
<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px;">{btn("Back", "ghost", "chev_l")}{btn("Continue", "primary", trail_icon="arrow_r", h=40)}</div>
</div>'''
    aside = f'''<div style="flex: 1 1 0; background: {S["night"]}; color: {S["night_text"]}; display: flex; flex-direction: column; justify-content: center; padding: 64px; gap: 20px;">
<span style="font-family: {DISPLAY}; font-size: 22px; font-weight: 700; color: {S["signal"]};">p</span>
<p style="margin: 0; font-family: {DISPLAY}; font-size: 30px; line-height: 38px; font-weight: 500; max-width: 440px;">Screens written on demand, in your design system, checked before anyone sees them.</p>
<p style="margin: 0; font-size: 14px; color: #CFCBC0; max-width: 420px;">Studio is where your design system team decides what those screens are allowed to look like, and reviews what they actually look like.</p>
</div>'''
    return doc("Create a workspace", 1440, 900, f'<main style="flex: 1 1 0; display: flex; align-items: center; justify-content: center; background: {S["paper"]};">{form}</main>{aside}')


# ---------------------------------------------------------------- components

COMPONENTS = [
    ("Actions", [("Action", "@northwind/ui Button", 3120, True), ("ActionBar", "Default renderer", 1840, True), ("Confirm", "@northwind/ui Dialog", 612, True)]),
    ("Inputs", [("TextInput", "@northwind/ui Input", 2210, True), ("Choice", "@northwind/ui Select", 1904, True), ("Toggle", "@northwind/ui Switch", 380, True), ("DateInput", "Default renderer", 402, True), ("RangeInput", "Default renderer", 96, False)]),
    ("Content", [("Metric", "Default renderer", 1210, True), ("DetailList", "@northwind/ui DescriptionList", 2890, True), ("Table", "@northwind/ui DataTable", 1480, True), ("Chart", "Default renderer", 344, True), ("Status", "@northwind/ui Alert", 902, True)]),
    ("Custom", [("northwind:OrderTimeline", "@northwind/ui Timeline", 210, True)]),
]


def components_list(overlay=""):
    rows = []
    for g, items in COMPONENTS:
        rows.append(("group", g))
        rows.extend(items)
    body_rows = ""
    for r in rows:
        if r[0] == "group":
            body_rows += f'<tr><th colspan="6" scope="colgroup" style="text-align: left; font-size: 12px; font-weight: 600; color: {S["muted"]}; padding: 16px 16px 6px; letter-spacing: 0.04em; text-transform: uppercase;">{r[1]}</th></tr>'
            continue
        name, impl, uses, on = r
        custom = ":" in name
        impl_html = f'<span style="display: inline-flex; gap: 6px; align-items: center;">{dot("ok" if impl != "Default renderer" else "gray")}{mono(impl) if impl != "Default renderer" else f"<span style=\"color: {S["muted"]};\">Default renderer</span>"}</span>'
        kind = tag("Custom", "signal") if custom else tag("Built in", "gray")
        body_rows += f'<tr><td style="padding: 0 16px; height: 48px; border-bottom: 1px solid {S["soft"]};"><a href="#" style="font-weight: 600; color: {S["ink"]};">{mono(name, 14, S["ink"]) if custom else name}</a></td><td style="padding: 0 16px; border-bottom: 1px solid {S["soft"]};">{kind}</td><td style="padding: 0 16px; border-bottom: 1px solid {S["soft"]};">{impl_html}</td><td style="padding: 0 16px; border-bottom: 1px solid {S["soft"]}; text-align: right; font-variant-numeric: tabular-nums;">{uses:,}</td><td style="padding: 0 16px; border-bottom: 1px solid {S["soft"]};"><span style="display: inline-flex; gap: 8px; align-items: center;">{switch(on, "Allow generators to use " + name)}<span style="font-size: 13px; color: {S["muted"]};">{"On" if on else "Off"}</span></span></td><td style="padding: 0 16px; border-bottom: 1px solid {S["soft"]}; text-align: right;">{btn("Actions for " + name, "ghost", "dots_h", h=28, only_icon=True)}</td></tr>'
    head = "".join(f'<th scope="col" style="text-align: {a}; font-size: 12px; font-weight: 500; color: {S["muted"]}; padding: 0 16px; height: 36px; border-bottom: 1px solid {S["line"]};">{h}</th>' for h, a in [("Component", "left"), ("Kind", "left"), ("Rendered with", "left"), ("Used, 7 days", "right"), ("Generators may use it", "left"), ("", "right")])
    body = page_head("Components", "What generated screens are built from. Use Polyxd's renderer for any of them, connect your own, or add components only your product has.", f'{btn("Connect your library", "secondary", "plug")}{btn("New component", "primary", "plus")}', tabs_html=tabs([("All", 27), ("Connected", 18), ("Default renderer", 8), ("Custom", 1)], "All")) + f'''<div style="padding: 16px 32px; display: flex; flex-direction: column; gap: 12px;">
<div style="display: flex; gap: 8px; align-items: center;">{search("Search components", 260)}{filter_chip("Needs attention", False, 2)}{filter_chip("Turned off", False, 1)}<span style="margin-left: auto; font-size: 13px; color: {S["muted"]};">Showing 14 of 27</span></div>
<table style="width: 100%; border-collapse: collapse;"><caption style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);">Components</caption><thead><tr>{head}</tr></thead><tbody>{body_rows}</tbody></table>
</div>'''
    return app("Components", "Components", ["Northwind", "Foundations", "Components"], body, overlay=overlay)


def components_undo():
    return components_list(toast("Deleted northwind:ReturnLabel. Screens that used it fall back to DetailList."))


def component_detail():
    previews = f'<div style="display: flex; flex-direction: column; gap: 16px;"><div style="display: flex; gap: 16px;">{mini_surface("plans", "northwind", 250, 400, "Phone · light")}{mini_surface("plans", "northwind-dark", 250, 400, "Phone · dark")}</div>{mini_desktop("plans", "northwind", 516, 250, "Desktop · light")}</div>'
    guidance = f'''{h2("When to use it", None, btn("Edit guidance", "ghost", "edit", h=28))}
<ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 22px;"><li>Picking one or several of a known set of options</li><li>Up to 5 options: show them all as chips or radios</li></ul>
<h3 style="margin: 6px 0 0; font-size: 14px;">Not for</h3>
<ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 22px; color: {S["ink2"]};"><li>Turning one thing on or off: use Toggle</li><li>Choosing a date: use DateInput</li></ul>
<div style="display: flex; gap: 8px; align-items: center; font-size: 12px; color: {S["muted"]};">{ic("sparkle", 14)}Generators read this guidance. Changes go out with the next release.</div>'''
    impl = f'''{h2("Rendered with", None, btn("Change", "ghost", h=28))}
<div style="display: flex; gap: 12px; align-items: center;"><span style="display: flex; width: 36px; height: 36px; border-radius: 8px; background: {S["soft"]}; align-items: center; justify-content: center;">{ic("code", 18)}</span><div>{mono("@northwind/ui · Select", 14, S["ink"])}<div style="font-size: 12px; color: {S["muted"]};">v4.2.0 · connected by Tom, yesterday</div></div></div>
<ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
<li style="display: flex; gap: 8px; align-items: center;">{ic("check_circle", 16, S["ok"])}Accessibility: 0 issues in 12 renders</li>
<li style="display: flex; gap: 8px; align-items: center;">{ic("check_circle", 16, S["ok"])}Agents chose an option by its name in 36 of 36 tasks</li>
<li style="display: flex; gap: 8px; align-items: center;">{ic("alert", 16, S["warn"])}Touch target 40px on phones; your minimum is 44px</li>
</ul>'''
    props = table(["Prop", "Type", "Maps to"], [[mono("label", 13, S["ink"]), "Text", mono("label")], [mono("options", 13, S["ink"]), "List or binding", mono("items")], [mono("value", 13, S["ink"]), "Binding", mono("value · onValueChange")], [mono("multiple", 13, S["ink"]), "Yes or no", mono("mode=\"multi\"")], [mono("presentation", 13, S["ink"]), "chips · list · menu", mono("variant")]], row_h=40, pad_x=0)
    body = page_head("Choice", "Pick one or several from a set.", f'{btn("Try it in a preview", "secondary", "eye")}{btn("More actions", "secondary", "dots_h", only_icon=True)}', meta=f'{tag("Built in", "gray")}{tag("Connected", "ok")}<span style="font-size: 13px; color: {S["muted"]};">Used 1,904 times in 7 days · 11 intents</span>', tabs_html=tabs(["Overview", "Props", ("Screens", "1,904"), "Accessibility", "History"], "Overview")) + f'''<div style="padding: 20px 32px; display: flex; gap: 24px;">
<div style="width: 560px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px;">{card(previews, pad=20)}{card(h2("Props and mapping") + props, pad=20, gap=8)}</div>
<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px;">{card(guidance, pad=20)}{card(impl, pad=20)}</div>
</div>'''
    return app("Choice component", "Components", ["Northwind", "Components", "Choice"], body)


def component_connect():
    rows = [
        [mono("label", 13, S["ink"]), mono("label"), tag("Matched", "ok")],
        [mono("options", 13, S["ink"]), mono("items"), tag("Matched", "ok")],
        [mono("value", 13, S["ink"]), mono("value · onValueChange"), tag("Matched", "ok")],
        [mono("multiple", 13, S["ink"]), f'<select aria-label="Maps to" style="height: 30px; border: 1px solid {S["line"]}; border-radius: 6px; font-family: {MONO}; font-size: 13px; padding: 0 6px;"><option>mode="multi"</option></select>', tag("Check", "info")],
        [mono("disabled", 13, S["ink"]), mono("isDisabled"), tag("Matched", "ok")],
    ]
    body = f'''{field("Package", "@northwind/ui", "pkg", mono=True, help_text="Studio reads its types; nothing is uploaded.")}
{field("Component", "Select", "export", mono=True)}
<div style="display: flex; flex-direction: column; gap: 6px;"><strong style="font-size: 13px;">Props</strong>{table(["Polyxd", "Yours", ""], rows, row_h=42, pad_x=0)}</div>
{card(f'<div style="display: flex; gap: 10px; align-items: center;"><span style="display: flex; color: {S["ok"]};">{ic("check_circle", 18)}</span><strong style="font-size: 14px;">Test render passed in 11 of 12 targets</strong></div><div style="font-size: 13px; color: {S["ink2"]};">Northwind light and dark, 390 and 1100 px, 3 sample screens. On phones the options are 40px tall; your minimum is 44px.</div><a href="#" style="font-size: 13px; font-weight: 500;">See all 12 renders</a>', pad=14, gap=6, bg=S["sunk"])}'''
    return component_detail_with(drawer("Connect Choice to your library", body, f'{btn("Cancel", "ghost")}{btn("Run test again", "secondary", "repeat")}{btn("Connect", "primary")}', w=560, sub="Screens use your component; the verifier checks what you ship."))


def component_detail_with(overlay):
    html = component_detail()
    return html.replace("</main>", "</main>" + overlay, 1)


def component_new():
    prop_rows = "".join(
        f'<tr><td style="padding: 6px 8px 6px 0;"><input aria-label="Prop name" value="{n}" style="width: 150px; height: 32px; box-sizing: border-box; border: 1px solid {S["line"]}; border-radius: 6px; padding: 0 8px; font-family: {MONO}; font-size: 13px;"></td><td style="padding: 6px 8px;"><select aria-label="Type" style="height: 32px; border: 1px solid {S["line"]}; border-radius: 6px; padding: 0 8px; font-family: {BODY}; font-size: 13px;"><option>{t}</option></select></td><td style="padding: 6px 8px;">{checkbox(req, "Required")}</td><td style="padding: 6px 0 6px 8px;">{btn("Remove " + n, "ghost", "trash", h=28, only_icon=True)}</td></tr>'
        for n, t, req in [("events", "List bound to data", True), ("title", "Text", True), ("current", "Binding", False)]
    )
    left = f'''<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 18px; max-width: 640px;">
{field("Name", "northwind:OrderTimeline", "cname", mono=True, help_text="Namespaced, so it never collides with Polyxd's own components.")}
{textarea("What it's for", "The steps an order goes through, with where it is now.", "purpose", 64)}
{textarea("When generators should use it", "Where is my order; delivery status; return progress.\\nNot for: a list of orders (use Collection).", "when", 72)}
<div style="display: flex; flex-direction: column; gap: 8px;">{label("Props")}<table style="border-collapse: collapse;"><thead><tr>{"".join(f'<th scope="col" style="text-align: left; font-size: 12px; font-weight: 500; color: {S["muted"]}; padding: 0 8px 4px 0;">{h}</th>' for h in ["Name", "Type", "Required", ""])}</tr></thead><tbody>{prop_rows}</tbody></table>{btn("Add a prop", "ghost", "plus", h=30)}</div>
<div style="display: flex; gap: 16px;">{select("Accessibility role", "list, with the current step marked", "role", w=300)}{select("What an agent can do", "Read the steps and the current one", "agent", w=300)}</div>
{select("If a renderer doesn't have it, show", "DetailList: one row per step", "fallback", help_text="Documents stay readable everywhere, including in A2UI and on platforms you haven't built it for.")}
</div>'''
    right = f'''<aside aria-label="Preview" style="width: 360px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px;">
<strong style="font-size: 13px;">Preview</strong>
<div style="border: 1px solid {S["line"]}; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 14px; background: #FFFFFF;">
<div style="font-size: 16px; font-weight: 600; color: #101828;">Your order is out for delivery</div>
{"".join(f'<div style="display: flex; gap: 12px; align-items: flex-start;"><span style="width: 14px; height: 14px; margin-top: 3px; border-radius: 50%; flex-shrink: 0; background: {"#1849A9" if s != "todo" else "#FFFFFF"}; border: 2px solid {"#1849A9" if s != "todo" else "#D0D5DD"}; box-sizing: border-box;"></span><div><div style="font-size: 13px; font-weight: {600 if s == "now" else 500}; color: #101828;">{t}</div><div style="font-size: 12px; color: #475467;">{d}</div></div></div>' for t, d, s in [("Ordered", "Mon 22 Sep", "done"), ("Shipped", "Tue 23 Sep", "done"), ("Out for delivery", "Today, 14:00–16:00", "now"), ("Delivered", "", "todo")])}
</div>
<div style="font-size: 12px; color: {S["muted"]};">Drawn by your connected {mono("Timeline")} in Northwind light.</div>
{notice("Checked like everything else", "The verifier audits it by its role, and agents are tested against it.", "gray")}
</aside>'''
    body = page_head("New component", "For something only your product has. Generators see it once it's saved and released.", f'{btn("Cancel", "ghost")}{btn("Save component", "primary")}') + f'<div style="padding: 20px 32px; display: flex; gap: 40px;">{left}{right}</div>'
    return app("New custom component", "Components", ["Northwind", "Components", "New"], body)
