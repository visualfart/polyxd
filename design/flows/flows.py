from kit import C, FONT, icon, doc, app_bar, btn, chip, avatar, field, search_bar, switch, checkbox, receipt, section_label, list_item, bottom_bar, desktop_shell, card, image

M_W, M_H = 390, 844
D_W, D_H = 1280, 880

PEOPLE = [
    ("AK", "Alex Kim", "Monzo ·· 4821", C["primary_c"], C["on_primary_c"]),
    ("SP", "Sam Patel", "Barclays ·· 1190", C["tertiary_c"], C["on_tertiary_c"]),
    ("OL", "Oakwood Lettings", "Landlord · HSBC ·· 7730", C["secondary_c"], C["on_secondary_c"]),
    ("MS", "Mum", "Nationwide ·· 0042", C["success_c"], C["on_success_c"]),
    ("PR", "Priya Rao", "Starling ·· 5563", C["warn_c"], C["on_warn_c"]),
]


def scrim_sheet(behind, sheet, h=M_H):
    """A bottom sheet over a dimmed screen."""
    return f"""<div style="position: relative; width: 100%; height: {h}px; flex-shrink: 0;">
<div style="position: absolute; inset: 0; display: flex; flex-direction: column;">{behind}</div>
<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.32);"></div>
<div role="dialog" aria-modal="true" style="position: absolute; left: 0; right: 0; bottom: 0; max-height: {h - 60}px; box-sizing: border-box; background: {C['low']}; border-radius: 28px 28px 0 0; display: flex; flex-direction: column;">
<div style="display: flex; justify-content: center; padding: 16px 0 8px;"><span style="width: 32px; height: 4px; border-radius: 2px; background: {C['outline']};"></span></div>
{sheet}
</div>
</div>"""


# ---------------------------------------------------------------- 1 · Send money

def send_pick():
    recent = "".join(
        f'<a href="#" style="width: 64px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; text-decoration: none; color: {C["on_surface"]};">{avatar(i, bg, fg, 56)}<span style="font-size: 12px; line-height: 16px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 64px;">{n.split(" ")[0] if n != "Oakwood Lettings" else "Landlord"}</span></a>'
        for i, n, _, bg, fg in PEOPLE
    )
    rows = "".join(list_item(n, sub, avatar(i, bg, fg), f'<span style="color: {C["variant"]}; display: flex;">{icon("chev_r")}</span>') for i, n, sub, bg, fg in PEOPLE[:4])
    body = f"""{app_bar("Send money", "close")}
<div style="padding: 8px 16px 0; display: flex; flex-direction: column; gap: 20px; flex-grow: 1;">
{search_bar("Name, email or sort code")}
<div>{section_label("Recent")}<div style="display: flex; gap: 12px; padding-top: 8px;">{recent}</div></div>
<div style="margin: 0 -16px;">
<div style="padding: 0 16px;">{section_label("All payees", "12 people")}</div>
{rows}
{list_item("New payee", "Bank details or phone number", f'<span style="width: 40px; height: 40px; border-radius: 50%; border: 1px dashed {C["outline"]}; display: flex; align-items: center; justify-content: center; color: {C["primary"]};">{icon("plus")}</span>')}
</div>
</div>"""
    return doc("Send money · choose who", M_W, M_H, body)


def amount_screen(inner_only=False):
    body = f"""{app_bar("Send to Alex Kim", "back", f'<span style="margin-right: 12px;">{avatar("AK", size=32)}</span>', "Monzo ·· 4821")}
<div style="padding: 8px 24px 0; display: flex; flex-direction: column; gap: 24px; flex-grow: 1;">
<div style="padding: 28px 0 8px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
<label style="font-size: 14px; color: {C['variant']};">You send</label>
<div style="display: flex; align-items: baseline; gap: 4px; font-size: 64px; line-height: 72px; font-weight: 400; letter-spacing: -1px; font-variant-numeric: tabular-nums;"><span style="color: {C['variant']}; font-size: 40px;">£</span>250<span style="color: {C['variant']};">.00</span><span style="width: 2px; height: 56px; background: {C['primary']}; margin-left: 4px; align-self: center;"></span></div>
<div style="font-size: 14px; color: {C['variant']};">Balance £2,450.12 · £2,200.12 after</div>
</div>
<div style="display: flex; gap: 8px; justify-content: center;">{chip("£50")}{chip("£100")}{chip("£250", True)}{chip("Last: £240")}</div>
{field("Reference", "Rent share", supporting="Alex sees this on their statement")}
{receipt([("Fee", "Free"), ("Arrives", "In seconds"), ("Alex gets", "£250.00")])}
</div>
{bottom_bar(btn("Review payment", full=True))}"""
    return body if inner_only else doc("Send money · amount", M_W, M_H, body)


def send_confirm_sheet():
    sheet = f"""<div style="padding: 8px 24px 24px; display: flex; flex-direction: column; gap: 20px;">
<div style="display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;">
{avatar("AK", size=64)}
<h2 style="margin: 0; font-size: 16px; font-weight: 500; color: {C['variant']};">Send to Alex Kim</h2>
<div style="font-size: 48px; line-height: 56px; letter-spacing: -0.5px; font-variant-numeric: tabular-nums;">£250.00</div>
<div style="font-size: 14px; color: {C['variant']};">Monzo ·· 4821 · Sort code 04-00-04</div>
</div>
{receipt([("Reference", "Rent share"), ("Fee", "Free"), ("Arrives", "In seconds")], total=("Total", "£250.00"), bg=C["cont"])}
<div style="display: flex; flex-direction: column; gap: 10px;">
<p style="margin: 0; display: flex; gap: 8px; align-items: flex-start; font-size: 14px; line-height: 20px; color: {C['variant']};"><span style="display: flex; padding-top: 1px;">{icon("info", 18)}</span>Money leaves your account straight away and can't be recalled.</p>
{btn("Send £250.00", full=True)}
{btn("Cancel", "text", full=True)}
</div>
</div>"""
    return doc("Confirm payment · mobile", M_W, M_H, scrim_sheet(amount_screen(True), sheet))


def send_done():
    body = f"""{app_bar("", "close")}
<div style="flex-grow: 1; padding: 24px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; justify-content: center;">
<span style="width: 88px; height: 88px; border-radius: 50%; background: {C['success_c']}; color: {C['on_success_c']}; display: flex; align-items: center; justify-content: center;">{icon("check", 44, sw=2.5)}</span>
<h2 style="margin: 8px 0 0; font-size: 28px; font-weight: 400; line-height: 36px;">£250.00 sent to Alex</h2>
<p style="margin: 0; font-size: 16px; line-height: 24px; color: {C['variant']};">It arrived just now. Reference: Rent share.</p>
<div style="display: flex; gap: 8px; padding-top: 8px;">{chip("Share receipt", icon_name="upload")}{chip("Send again", icon_name="arrow_r")}</div>
</div>
{bottom_bar(btn("Done", full=True), border=False)}"""
    return doc("Payment sent · mobile", M_W, M_H, body)


def send_desktop():
    people = "".join(
        f'<button type="button" aria-pressed="{"true" if i == "AK" else "false"}" style="flex: 1; min-width: 0; box-sizing: border-box; padding: 16px 8px; border-radius: 16px; border: {"2px solid " + C["primary"] if i == "AK" else "1px solid " + C["outline_v"]}; background: {C["primary_c"] if i == "AK" else C["lowest"]}; display: flex; flex-direction: column; align-items: center; gap: 8px; font-family: {FONT}; color: {C["on_surface"]};">{avatar(i, bg, fg, 48)}<span style="font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">{n if n != "Oakwood Lettings" else "Landlord"}</span></button>'
        for i, n, _, bg, fg in PEOPLE
    )
    left = f"""<div style="flex: 1.4; display: flex; flex-direction: column; gap: 28px;">
<section style="display: flex; flex-direction: column; gap: 12px;">
<div style="display: flex; justify-content: space-between; align-items: center;"><h2 style="margin: 0; font-size: 22px; font-weight: 400;">1. Who are you paying?</h2><div style="width: 320px;">{search_bar("Search 12 payees", h=48)}</div></div>
<div style="display: flex; gap: 12px;">{people}</div>
</section>
<section style="display: flex; flex-direction: column; gap: 12px;">
<h2 style="margin: 0; font-size: 22px; font-weight: 400;">2. How much?</h2>
<div style="display: flex; align-items: baseline; gap: 6px; padding: 16px 24px; border: 2px solid {C['primary']}; border-radius: 16px; font-size: 56px; line-height: 64px; font-variant-numeric: tabular-nums; background: {C['lowest']};"><span style="color: {C['variant']}; font-size: 36px;">£</span>250<span style="color: {C['variant']};">.00</span><span style="margin-left: auto; font-size: 14px; color: {C['variant']}; align-self: center;">Balance £2,450.12</span></div>
<div style="display: flex; gap: 8px;">{chip("£50")}{chip("£100")}{chip("£250", True)}{chip("Last time: £240")}</div>
</section>
<section style="display: flex; flex-direction: column; gap: 12px;">
<h2 style="margin: 0; font-size: 22px; font-weight: 400;">3. Reference <span style="font-size: 16px; color: {C['variant']};">(optional)</span></h2>
<div style="max-width: 420px; background: {C['surface']};">{field("", "Rent share", supporting="Alex sees this on their statement")}</div>
</section>
</div>"""
    right = f"""<aside style="width: 380px; flex-shrink: 0;">{card(f'''<div style="display: flex; flex-direction: column; gap: 20px;">
<div style="display: flex; align-items: center; gap: 12px;">{avatar("AK", size=48)}<div><div style="font-size: 16px; font-weight: 500;">Alex Kim</div><div style="font-size: 14px; color: {C['variant']};">Monzo ·· 4821</div></div></div>
<div style="font-size: 44px; line-height: 52px; font-variant-numeric: tabular-nums;">£250.00</div>
{receipt([("Reference", "Rent share"), ("Fee", "Free"), ("Arrives", "In seconds")], total=("Total", "£250.00"), bg=C["lowest"], pad=16)}
<p style="margin: 0; font-size: 14px; line-height: 20px; color: {C['variant']};">Money leaves your account straight away and can't be recalled.</p>
{btn("Review and send £250.00", full=True)}
</div>''', pad=24, bg=C["cont"], radius=28)}</aside>"""
    body = desktop_shell("Send money", f'<div style="display: flex; gap: 48px; align-items: flex-start;">{left}{right}</div>', "Payments")
    return doc("Send money · desktop", D_W, D_H, body)


def confirm_desktop():
    behind = f'<div style="position: absolute; inset: 0; opacity: 1;">{send_desktop_inner()}</div>'
    dialog = f"""<div role="dialog" aria-modal="true" aria-labelledby="t" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 480px; box-sizing: border-box; padding: 28px; border-radius: 28px; background: {C['high']}; display: flex; flex-direction: column; gap: 20px;">
<div style="display: flex; align-items: center; gap: 16px;">{avatar("AK", size=56)}<div><h2 id="t" style="margin: 0; font-size: 24px; font-weight: 400;">Send £250.00 to Alex Kim?</h2><div style="font-size: 14px; color: {C['variant']}; padding-top: 4px;">Monzo ·· 4821 · 04-00-04</div></div></div>
{receipt([("Reference", "Rent share"), ("Fee", "Free"), ("Arrives", "In seconds")], total=("Total", "£250.00"), bg=C["cont"])}
<p style="margin: 0; display: flex; gap: 8px; font-size: 14px; line-height: 20px; color: {C['variant']};"><span style="display: flex; padding-top: 1px;">{icon("info", 18)}</span>Money leaves your account straight away and can't be recalled.</p>
<div style="display: flex; justify-content: flex-end; gap: 8px;">{btn("Cancel", "text")}{btn("Send £250.00")}</div>
</div>"""
    body = f'<div style="position: relative; width: {D_W}px; height: {D_H}px;">{behind}<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.32);"></div>{dialog}</div>'
    return doc("Confirm payment · desktop", D_W, D_H, body)


def send_desktop_inner():
    html = send_desktop()
    start = html.index('<div style="width: 1280px;')
    inner_start = html.index(">", start) + 1
    end = html.rindex("</div>\n</x-dc>")
    return html[inner_start:end]


# ---------------------------------------------------------------- 3 · Delete account

CONSEQUENCES = [
    ("lock", "You're signed out everywhere", "On every phone, tablet and browser, straight away."),
    ("trash", "Your data is erased after 30 days", "Payments history, payees and saved cards."),
    ("clock", "You can change your mind", "Sign in within 30 days to restore everything."),
    ("tag", "Your Plus subscription stops", "You won't be charged again."),
]


def consequence_list(compact=False):
    return "".join(
        f'<li style="display: flex; gap: 16px; align-items: flex-start;"><span style="width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; background: {C["cont"]}; color: {C["variant"]}; display: flex; align-items: center; justify-content: center;">{icon(ic, 20)}</span><div><div style="font-size: 16px; line-height: 24px;">{t}</div><div style="font-size: 14px; line-height: 20px; color: {C["variant"]};">{d}</div></div></li>'
        for ic, t, d in CONSEQUENCES
    )


def delete_mobile():
    body = f"""{app_bar("", "close")}
<div style="padding: 0 24px; display: flex; flex-direction: column; gap: 24px; flex-grow: 1;">
<div style="display: flex; flex-direction: column; gap: 12px;">
<span style="width: 56px; height: 56px; border-radius: 16px; background: {C['error_c']}; color: {C['on_error_c']}; display: flex; align-items: center; justify-content: center;">{icon("alert", 28)}</span>
<h2 style="margin: 0; font-size: 28px; line-height: 36px; font-weight: 400;">Delete your account?</h2>
<p style="margin: 0; font-size: 16px; line-height: 24px; color: {C['variant']};">This is for closing your account completely. To stop emails or pause Plus instead, use Settings.</p>
</div>
<ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 16px;">{consequence_list()}</ul>
<div>{field("Type DELETE to confirm", "", "DELETE", supporting="This is only asked for actions you can't easily undo.")}</div>
</div>
{bottom_bar(btn("Delete account", danger=True, full=True, disabled=True) + btn("Keep my account", "tonal", full=True))}"""
    return doc("Delete account · mobile", M_W, M_H, body)


def delete_desktop():
    behind = f'<div style="position: absolute; inset: 0; padding: 40px 64px; box-sizing: border-box;"><div style="font-size: 14px; color: {C["variant"]};">Settings</div><h1 style="margin: 4px 0 0; font-size: 32px; font-weight: 400;">Account</h1></div>'
    dialog = f"""<div role="alertdialog" aria-modal="true" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 560px; box-sizing: border-box; padding: 32px; border-radius: 28px; background: {C['high']}; display: flex; flex-direction: column; gap: 24px;">
<div style="display: flex; gap: 16px; align-items: center;"><span style="width: 48px; height: 48px; border-radius: 14px; background: {C['error_c']}; color: {C['on_error_c']}; display: flex; align-items: center; justify-content: center;">{icon("alert", 24)}</span><h2 style="margin: 0; font-size: 24px; font-weight: 400;">Delete your account?</h2></div>
<ul style="margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px;">{consequence_list()}</ul>
<div style="background: {C['high']};">{field("Type DELETE to confirm", "DEL", focused=True)}</div>
<div style="display: flex; justify-content: flex-end; gap: 8px;">{btn("Keep my account", "text")}{btn("Delete account", danger=True, disabled=True)}</div>
</div>"""
    body = f'<div style="position: relative; width: {D_W}px; height: {D_H}px;">{behind}<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.32);"></div>{dialog}</div>'
    return doc("Delete account · desktop", D_W, D_H, body)


def delete_low_risk():
    msgs = [("Sam Patel", "Dinner on Friday?", "10:42"), ("Oakwood Lettings", "Your rent receipt for September", "Yesterday"), ("Priya Rao", "Here are the photos", "Tue")]
    rows = "".join(list_item(n, t, avatar("".join(w[0] for w in n.split()[:2]), size=40), f'<span style="font-size: 12px; color: {C["variant"]};">{d}</span>') for n, t, d in msgs)
    body = f"""{app_bar("Messages", "back")}
<div style="flex-grow: 1;">{rows}</div>
<div style="margin: 0 16px 24px; padding: 14px 16px; border-radius: 8px; background: {C['inverse']}; color: #F5EFF7; display: flex; align-items: center; gap: 12px; font-size: 14px;" role="status"><span style="flex-grow: 1;">Message deleted</span><button type="button" style="border: 0; background: none; color: #D0BCFF; font-family: {FONT}; font-size: 14px; font-weight: 500; height: 40px; padding: 0 8px;">Undo</button></div>"""
    return doc("Low-risk delete · undo instead of confirm", M_W, 560, body)


# ---------------------------------------------------------------- 4 · Browse and filter

LAMPS = [
    ("Arc desk lamp", "£49", "4.6", "212", 250),
    ("Mini clamp lamp", "£22", "4.3", "88", 30),
    ("Linen table lamp", "£65", "4.8", "140", 40),
    ("Studio task light", "£119", "4.7", "57", 200),
    ("Brass reading lamp", "£84", "4.5", "96", 45),
    ("Mushroom lamp", "£38", "4.4", "310", 20),
    ("Swing-arm lamp", "£72", "4.6", "63", 210),
    ("Globe desk lamp", "£55", "4.2", "41", 280),
]


def product_card(name, price, rating, count, hue, img_h=140):
    return f"""<a href="#" style="display: flex; flex-direction: column; gap: 8px; text-decoration: none; color: {C['on_surface']};">
{image(name, h=img_h, hue=hue)}
<div style="display: flex; flex-direction: column; gap: 2px; padding: 0 2px;"><span style="font-size: 14px; line-height: 20px;">{name}</span><span style="font-size: 16px; font-weight: 500; font-variant-numeric: tabular-nums;">{price}</span><span style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: {C['variant']};"><span style="color: {C['on_warn_c']}; display: flex;">{icon("star", 14)}</span>{rating} ({count})</span></div>
</a>"""


def browse_mobile_inner():
    cards = "".join(product_card(*l) for l in LAMPS[:6])
    return f"""<div style="padding: 8px 16px 12px; display: flex; flex-direction: column; gap: 12px;">
<div style="display: flex; align-items: center; gap: 8px;"><button type="button" aria-label="Back" style="width: 40px; height: 40px; border: 0; background: none; color: {C['on_surface']}; display: flex; align-items: center; justify-content: center; padding: 0;">{icon("back")}</button><div style="flex-grow: 1;">{search_bar("Search lamps", "desk lamp", h=48)}</div></div>
<div style="display: flex; gap: 8px; overflow: hidden;">{chip("Filters · 2", True, trailing="tune")}{chip("Desk", True)}{chip("Floor")}{chip("Clip-on")}{chip("Under £120", True)}</div>
</div>
<div style="padding: 0 16px 8px; display: flex; justify-content: space-between; align-items: center;"><span style="font-size: 14px; color: {C['variant']};">24 lamps</span><button type="button" style="border: 0; background: none; font-family: {FONT}; font-size: 14px; font-weight: 500; color: {C['primary']}; display: flex; align-items: center; gap: 6px; height: 40px;">{icon("sort", 18)}Most popular</button></div>
<div style="padding: 0 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 12px;">{cards}</div>"""


def browse_mobile():
    return doc("Browse lamps · mobile", M_W, 1060, browse_mobile_inner())


def price_range(min_v="£20", max_v="£120", width="100%"):
    return f"""<div style="display: flex; flex-direction: column; gap: 14px; width: {width};">
<div role="group" aria-label="Price range" style="position: relative; height: 24px;">
<span style="position: absolute; left: 0; right: 0; top: 10px; height: 4px; border-radius: 2px; background: {C['highest']};"></span>
<span style="position: absolute; left: 8%; right: 42%; top: 10px; height: 4px; border-radius: 2px; background: {C['primary']};"></span>
<span role="slider" aria-label="Minimum price" aria-valuetext="{min_v}" style="position: absolute; left: calc(8% - 10px); top: 2px; width: 20px; height: 20px; border-radius: 50%; background: {C['primary']};"></span>
<span role="slider" aria-label="Maximum price" aria-valuetext="{max_v}" style="position: absolute; left: calc(58% - 10px); top: 2px; width: 20px; height: 20px; border-radius: 50%; background: {C['primary']};"></span>
</div>
<div style="display: flex; gap: 12px; align-items: center;"><div style="flex: 1;">{field("Min", min_v, h=48)}</div><span style="color: {C['variant']};">–</span><div style="flex: 1;">{field("Max", max_v, h=48)}</div></div>
</div>"""


def check_row(label, on=False, count=None):
    c = f'<span style="margin-left: auto; font-size: 14px; color: {C["variant"]};">{count}</span>' if count else ""
    return f'<label style="display: flex; align-items: center; gap: 16px; min-height: 44px; font-size: 16px;">{checkbox(on)}<span>{label}</span>{c}</label>'


def browse_sheet():
    sheet = f"""<div style="padding: 0 24px; display: flex; justify-content: space-between; align-items: center;"><h2 style="margin: 0; font-size: 22px; font-weight: 400;">Filters</h2><button type="button" style="border: 0; background: none; font-family: {FONT}; font-size: 14px; font-weight: 500; color: {C['primary']}; height: 40px;">Clear all</button></div>
<div style="padding: 16px 24px; display: flex; flex-direction: column; gap: 24px; overflow: hidden;">
<section style="display: flex; flex-direction: column; gap: 12px;"><h3 style="margin: 0; font-size: 16px; font-weight: 500;">Type</h3><div style="display: flex; flex-wrap: wrap; gap: 8px;">{chip("Desk", True)}{chip("Floor")}{chip("Clip-on")}{chip("Table")}{chip("Wall")}</div></section>
<section style="display: flex; flex-direction: column; gap: 12px;"><h3 style="margin: 0; font-size: 16px; font-weight: 500;">Price</h3>{price_range()}</section>
<section style="display: flex; flex-direction: column; gap: 0;"><h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 500;">Features</h3>{check_row("Dimmable", True, 18)}{check_row("USB charging", False, 7)}{check_row("Warm light", False, 21)}</section>
</div>
{bottom_bar(btn("Show 24 lamps", full=True))}"""
    return doc("Filters · bottom sheet", M_W, M_H, scrim_sheet(browse_mobile_inner(), sheet))


def browse_desktop():
    cards = "".join(product_card(*l, img_h=180) for l in LAMPS)
    sidebar = f"""<aside style="width: 248px; flex-shrink: 0; display: flex; flex-direction: column; gap: 28px;">
<section style="display: flex; flex-direction: column; gap: 4px;"><h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 500;">Type</h2>{check_row("Desk", True, 24)}{check_row("Floor", False, 31)}{check_row("Clip-on", False, 9)}{check_row("Table", False, 17)}{check_row("Wall", False, 6)}</section>
<section style="display: flex; flex-direction: column; gap: 12px;"><h2 style="margin: 0; font-size: 16px; font-weight: 500;">Price</h2>{price_range()}</section>
<section style="display: flex; flex-direction: column; gap: 4px;"><h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 500;">Features</h2>{check_row("Dimmable", True, 18)}{check_row("USB charging", False, 7)}{check_row("Warm light", False, 21)}</section>
</aside>"""
    main = f"""<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 20px; min-width: 0;">
<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;"><span style="font-size: 14px; color: {C['variant']}; margin-right: 8px;">24 lamps</span>{chip("Desk", True, trailing="close")}{chip("£20–£120", True, trailing="close")}{chip("Dimmable", True, trailing="close")}<button type="button" style="border: 0; background: none; font-family: {FONT}; font-size: 14px; font-weight: 500; color: {C['primary']}; height: 32px;">Clear all</button><button type="button" style="margin-left: auto; border: 0; background: none; font-family: {FONT}; font-size: 14px; font-weight: 500; color: {C['primary']}; display: flex; align-items: center; gap: 6px; height: 40px;">{icon("sort", 18)}Most popular</button></div>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px 20px;">{cards}</div>
</div>"""
    body = f"""<div style="padding: 24px 64px 0; display: flex; align-items: center; gap: 32px;"><h1 style="margin: 0; font-size: 32px; font-weight: 400; white-space: nowrap;">Lamps</h1><div style="flex-grow: 1; max-width: 640px;">{search_bar("Search lamps", "desk lamp")}</div></div>
<div style="padding: 32px 64px; display: flex; gap: 48px; align-items: flex-start;">{sidebar}{main}</div>"""
    return doc("Browse lamps · desktop", D_W, 1000, body)


# ---------------------------------------------------------------- 5 · Compare plans

PLANS = [
    ("Basic", "£0", "Free forever", ["5 GB storage", "2 devices", "Community help"], False),
    ("Plus", "£4.99", "per month", ["200 GB storage", "5 devices", "Email help in 1 day"], True),
    ("Pro", "£11.99", "per month", ["2 TB storage", "Unlimited devices", "Priority help in 1 hour"], False),
]


def plan_card_mobile(name, price, per, facts, rec, current=False):
    bg = C["primary_c"] if rec else C["low"]
    border = f"2px solid {C['primary']}" if rec else f"1px solid {C['outline_v']}"
    badge = f'<span style="align-self: flex-start; padding: 4px 10px; border-radius: 8px; background: {C["primary"]}; color: #FFFFFF; font-size: 12px; font-weight: 500;">Recommended for you</span>' if rec else ""
    why = f'<p style="margin: 0; font-size: 14px; line-height: 20px; color: {C["on_primary_c"]};">You use 146 GB now. Plus leaves room to grow for less than Pro.</p>' if rec else ""
    li = "".join(f'<li style="display: flex; gap: 10px; align-items: center; font-size: 14px;"><span style="color: {C["primary"]}; display: flex;">{icon("check", 18)}</span>{f}</li>' for f in facts)
    cta = btn(f"Choose {name}", "filled" if rec else "outlined", full=True, h=44) if name != "Basic" else btn("Your current plan", "text", full=True, h=44, disabled=True)
    return f"""<article style="padding: 20px; border-radius: 24px; background: {bg}; border: {border}; display: flex; flex-direction: column; gap: 14px;">
{badge}
<div style="display: flex; justify-content: space-between; align-items: baseline;"><h2 style="margin: 0; font-size: 22px; font-weight: 500;">{name}</h2><div style="text-align: right;"><span style="font-size: 28px; font-variant-numeric: tabular-nums;">{price}</span> <span style="font-size: 14px; color: {C['variant']};">{per}</span></div></div>
{why}
<ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;">{li}</ul>
{cta}
</article>"""


def compare_mobile():
    order = [PLANS[1], PLANS[0], PLANS[2]]
    cards = "".join(plan_card_mobile(*p) for p in order)
    body = f"""{app_bar("Choose a plan", "back")}
<div style="padding: 0 16px 24px; display: flex; flex-direction: column; gap: 16px;">
<div role="radiogroup" aria-label="Billing" style="display: flex; border: 1px solid {C['outline']}; border-radius: 20px; overflow: hidden; height: 40px;"><button type="button" role="radio" aria-checked="true" style="flex: 1; border: 0; background: {C['secondary_c']}; color: {C['on_secondary_c']}; font-family: {FONT}; font-size: 14px; font-weight: 500;">Monthly</button><button type="button" role="radio" aria-checked="false" style="flex: 1; border: 0; border-left: 1px solid {C['outline']}; background: transparent; color: {C['on_surface']}; font-family: {FONT}; font-size: 14px; font-weight: 500;">Yearly · save 20%</button></div>
{cards}
<button type="button" style="height: 48px; border: 0; background: none; font-family: {FONT}; font-size: 14px; font-weight: 500; color: {C['primary']}; display: flex; align-items: center; justify-content: center; gap: 8px;">Compare all 14 features{icon("chev_d", 18)}</button>
</div>"""
    return doc("Compare plans · mobile", M_W, 1260, body)


FEATURE_GROUPS = [
    ("Storage", [("Storage", "5 GB", "200 GB", "2 TB"), ("Largest file", "250 MB", "10 GB", "50 GB"), ("Version history", "7 days", "30 days", "1 year")]),
    ("Sharing", [("Devices", "2", "5", "Unlimited"), ("Shared folders", "—", "✓", "✓"), ("Password-protected links", "—", "—", "✓")]),
    ("Help", [("How to reach us", "Community", "Email", "Email and chat"), ("Reply within", "—", "1 day", "1 hour")]),
]


def cell(v, rec=False):
    if v == "✓":
        inner = f'<span style="color: {C["primary"]}; display: inline-flex;" aria-label="Included">{icon("check", 20)}</span>'
    elif v == "—":
        inner = f'<span style="color: {C["outline"]};" aria-label="Not included">—</span>'
    else:
        inner = v
    bg = f"background: {C['primary_c']};" if rec else ""
    return f'<td style="padding: 14px 16px; text-align: center; font-size: 14px; font-variant-numeric: tabular-nums; {bg}">{inner}</td>'


def compare_desktop():
    head = "".join(
        f"""<th scope="col" style="width: 22%; padding: 24px 16px 20px; vertical-align: top; {'background: ' + C['primary_c'] + '; border-radius: 24px 24px 0 0;' if rec else ''}">
<div style="display: flex; flex-direction: column; align-items: center; gap: 8px; font-weight: 400;">
{'<span style="padding: 4px 10px; border-radius: 8px; background: ' + C['primary'] + '; color: #FFFFFF; font-size: 12px; font-weight: 500;">Recommended for you</span>' if rec else '<span style="height: 24px;"></span>'}
<span style="font-size: 22px; font-weight: 500;">{name}</span>
<span><span style="font-size: 36px; font-variant-numeric: tabular-nums;">{price}</span> <span style="font-size: 14px; color: {C['variant']};">{per}</span></span>
{btn(f"Choose {name}", "filled" if rec else "outlined", h=40) if name != "Basic" else btn("Current plan", "text", h=40, disabled=True)}
</div></th>"""
        for name, price, per, facts, rec in PLANS
    )
    rows = ""
    for group, feats in FEATURE_GROUPS:
        rows += f'<tr><th colspan="4" scope="colgroup" style="padding: 24px 16px 8px; text-align: left; font-size: 14px; font-weight: 500; color: {C["variant"]}; letter-spacing: 0.1px;">{group}</th></tr>'
        for f, a, b, c in feats:
            rows += f'<tr style="border-top: 1px solid {C["outline_v"]};"><th scope="row" style="padding: 14px 16px; text-align: left; font-size: 14px; font-weight: 400;">{f}</th>{cell(a)}{cell(b, True)}{cell(c)}</tr>'
    table = f"""<table style="width: 100%; border-collapse: collapse; font-family: {FONT};">
<caption style="text-align: left; padding-bottom: 8px; font-size: 16px; color: {C['variant']};">You use 146 GB today. Plus fits with room to grow, for less than Pro.</caption>
<thead><tr><th scope="col" style="text-align: left; vertical-align: bottom; padding: 16px; font-size: 14px; font-weight: 400; color: {C['variant']};"><div role="radiogroup" aria-label="Billing" style="display: inline-flex; border: 1px solid {C['outline']}; border-radius: 20px; overflow: hidden; height: 40px;"><button type="button" role="radio" aria-checked="true" style="padding: 0 16px; border: 0; background: {C['secondary_c']}; color: {C['on_secondary_c']}; font-family: {FONT}; font-size: 14px; font-weight: 500;">Monthly</button><button type="button" role="radio" aria-checked="false" style="padding: 0 16px; border: 0; border-left: 1px solid {C['outline']}; background: transparent; font-family: {FONT}; font-size: 14px; font-weight: 500; color: {C['on_surface']};">Yearly · save 20%</button></div></th>{head}</tr></thead>
<tbody>{rows}</tbody>
</table>"""
    body = desktop_shell("Choose a plan", table, "Account")
    return doc("Compare plans · desktop", D_W, 1040, body)


# ---------------------------------------------------------------- 6 · Hotel review

def stay_block(cols=2):
    return f"""<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: 12px;">
{card(f'<div style="font-size: 12px; color: {C["variant"]};">Check-in</div><div style="font-size: 16px; font-weight: 500; padding-top: 4px;">Fri 3 Oct</div><div style="font-size: 14px; color: {C["variant"]};">from 15:00</div>', pad=16, bg=C["cont"])}
{card(f'<div style="font-size: 12px; color: {C["variant"]};">Check-out</div><div style="font-size: 16px; font-weight: 500; padding-top: 4px;">Mon 6 Oct</div><div style="font-size: 14px; color: {C["variant"]};">by 11:00</div>', pad=16, bg=C["cont"])}
</div>"""


def hotel_header(img_h=160):
    return f"""<div style="display: flex; flex-direction: column; gap: 12px;">{image("Hotel Alfama, a room with a city view", h=img_h, hue=30, radius=20)}
<div><h2 style="margin: 0; font-size: 22px; font-weight: 400;">Hotel Alfama</h2><div style="display: flex; align-items: center; gap: 6px; font-size: 14px; color: {C['variant']}; padding-top: 4px;"><span style="color: {C['on_warn_c']}; display: flex;">{icon("star", 14)}</span>4.6 · Lisbon · Double room, city view · 2 adults</div></div></div>"""


PRICE_ROWS = [("3 nights × £96", "£288.00"), ("City tax", "£12.00"), ("Service fee", "£12.00")]


def free_cancel():
    return f'<div style="display: flex; gap: 10px; align-items: flex-start; padding: 12px 16px; border-radius: 12px; background: {C["success_c"]}; color: {C["on_success_c"]}; font-size: 14px; line-height: 20px;"><span style="display: flex; padding-top: 1px;">{icon("check", 18)}</span><span><strong style="font-weight: 500;">Free cancellation until Wed 1 Oct.</strong> After that, the first night (£96) isn\'t refunded.</span></div>'


def terms_and_cta(label):
    return f"""<label style="display: flex; gap: 12px; align-items: flex-start; font-size: 14px; line-height: 20px;">{checkbox(True)}<span>I agree to the hotel's <a href="#">booking terms</a> and the <a href="#">cancellation policy</a></span></label>
{btn(label, full=True)}"""


def hotel_mobile():
    body = f"""{app_bar("Check your booking", "back")}
<div style="padding: 0 16px 16px; display: flex; flex-direction: column; gap: 20px;">
{hotel_header(150)}
{stay_block()}
<div style="margin: 0 -16px;">{list_item("Neel Sachan", "neel@example.com · For confirmation", avatar("NS", size=40), '<a href="#" style="font-size: 14px; font-weight: 500; text-decoration: none;">Edit</a>')}</div>
{receipt(PRICE_ROWS, total=("Total", "£312.00"))}
{free_cancel()}
</div>
{bottom_bar(terms_and_cta("Book and pay £312.00"))}"""
    return doc("Hotel review · mobile", M_W, 1000, body)


def hotel_desktop():
    left = f"""<div style="flex: 1.3; display: flex; flex-direction: column; gap: 24px;">
{hotel_header(260)}
{stay_block()}
<section style="display: flex; flex-direction: column; gap: 4px;"><h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 500;">Guest</h2><div style="margin: 0 -16px;">{list_item("Neel Sachan", "neel@example.com · We'll send the confirmation here", avatar("NS"), '<a href="#" style="font-size: 14px; font-weight: 500; text-decoration: none;">Edit</a>', pad="8px 16px")}</div></section>
</div>"""
    right = f"""<aside style="width: 400px; flex-shrink: 0;">{card(f'''<div style="display: flex; flex-direction: column; gap: 20px;"><h2 style="margin: 0; font-size: 22px; font-weight: 400;">Price</h2>{receipt(PRICE_ROWS, total=("Total", "£312.00"), bg=C["lowest"])}{free_cancel()}{terms_and_cta("Book and pay £312.00")}</div>''', pad=24, bg=C["cont"], radius=28)}</aside>"""
    body = desktop_shell("Check your booking", f'<div style="display: flex; gap: 48px; align-items: flex-start;">{left}{right}</div>', "Lisbon trip")
    return doc("Hotel review · desktop", D_W, D_H, body)


# ---------------------------------------------------------------- 7 · Add task

def task_fields(expanded):
    more_rows = [("folder", "Project", "Personal"), ("user_plus", "Assignee", "Me"), ("tag", "Tags", "Add tags"), ("timer", "Estimate", "Not set")]
    more = "".join(list_item(t, None, f'<span style="color: {C["variant"]}; display: flex;">{icon(ic)}</span>', f'<span style="font-size: 14px; color: {C["variant"]};">{v}</span>', pad="4px 0", h=48) for ic, t, v in more_rows)
    toggle = f'<button type="button" aria-expanded="{"true" if expanded else "false"}" style="height: 44px; border: 0; background: none; padding: 0; font-family: {FONT}; font-size: 14px; font-weight: 500; color: {C["primary"]}; display: flex; align-items: center; gap: 6px;">{"Fewer options" if expanded else "Project, assignee, tags and estimate"}<span style="display: flex; transform: rotate({180 if expanded else 0}deg);">{icon("chev_d", 18)}</span></button>'
    return f"""<div style="display: flex; flex-direction: column; gap: 4px;">
<label style="font-size: 12px; color: {C['primary']};">Task</label>
<div style="font-size: 24px; line-height: 32px; padding-bottom: 8px; border-bottom: 2px solid {C['primary']};">Pay rent<span style="display: inline-block; width: 2px; height: 26px; background: {C['primary']}; vertical-align: -5px; margin-left: 2px;"></span></div>
</div>
<div style="display: flex; gap: 12px; align-items: flex-start; font-size: 16px; line-height: 24px; color: {C['variant']};"><span style="display: flex; padding-top: 2px;">{icon("note", 20)}</span>Add notes</div>
<div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 14px; font-weight: 500; color: {C['variant']};">Due</span><div style="display: flex; gap: 8px; flex-wrap: wrap;">{chip("Today")}{chip("Tomorrow", True)}{chip("Next week")}{chip("Pick a date", icon_name="calendar")}</div></div>
<div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 14px; font-weight: 500; color: {C['variant']};">Priority</span><div style="display: flex; gap: 8px;">{chip("Low")}{chip("Normal")}{chip("High", True, "flag")}</div></div>
{toggle}
{('<div style="display: flex; flex-direction: column;">' + more + '</div>') if expanded else ''}"""


def task_mobile(expanded=False):
    behind = f'{app_bar("Today", "back")}<div style="padding: 0 0;">{list_item("Send invoice", "Freelance · Due today", checkbox())}{list_item("Book dentist", "Personal", checkbox())}</div>'
    sheet = f"""<div style="padding: 0 24px 8px; display: flex; flex-direction: column; gap: 20px;">
<h2 style="margin: 0; font-size: 22px; font-weight: 400;">New task</h2>
{task_fields(expanded)}
</div>
{bottom_bar(btn("Add task", full=True))}"""
    return doc(f"Add task · mobile{' · more options' if expanded else ''}", M_W, M_H, scrim_sheet(behind, sheet))


def task_desktop():
    props = [("calendar", "Due", "Tomorrow, 30 Sep"), ("flag", "Priority", "High"), ("folder", "Project", "Personal"), ("user_plus", "Assignee", "Me"), ("tag", "Tags", "Add tags"), ("timer", "Estimate", "Not set")]
    side = "".join(f'<div style="display: flex; align-items: center; gap: 12px; min-height: 44px;"><span style="color: {C["variant"]}; display: flex;">{icon(ic, 20)}</span><span style="width: 88px; font-size: 14px; color: {C["variant"]};">{k}</span><button type="button" style="border: 0; background: none; padding: 0; font-family: {FONT}; font-size: 14px; color: {C["on_surface"] if v not in ("Add tags", "Not set") else C["variant"]}; text-align: left;">{v}</button></div>' for ic, k, v in props)
    dialog = f"""<div role="dialog" aria-modal="true" style="position: absolute; left: 50%; top: 80px; transform: translateX(-50%); width: 820px; box-sizing: border-box; border-radius: 28px; background: {C['high']}; display: flex; flex-direction: column;">
<div style="display: flex; gap: 32px; padding: 28px 28px 20px;">
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 16px;">
<div style="font-size: 28px; line-height: 36px;">Pay rent<span style="display: inline-block; width: 2px; height: 30px; background: {C['primary']}; vertical-align: -6px; margin-left: 2px;"></span></div>
<div style="min-height: 140px; padding: 12px 16px; border-radius: 12px; background: {C['cont']}; font-size: 16px; line-height: 24px; color: {C['variant']};">Add notes: what needs doing, links, context</div>
</div>
<div style="width: 280px; flex-shrink: 0; padding-left: 24px; border-left: 1px solid {C['outline_v']};">{side}</div>
</div>
<div style="display: flex; justify-content: flex-end; gap: 8px; padding: 16px 28px 24px;">{btn("Cancel", "text")}{btn("Add task")}</div>
</div>"""
    behind = f'<div style="position: absolute; inset: 0; padding: 40px 64px; box-sizing: border-box;"><h1 style="margin: 0; font-size: 32px; font-weight: 400;">Today</h1></div>'
    body = f'<div style="position: relative; width: {D_W}px; height: {D_H}px;">{behind}<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.32);"></div>{dialog}</div>'
    return doc("Add task · desktop", D_W, D_H, body)


# ---------------------------------------------------------------- 8 · Notifications

NOTIFY = [
    ("bolt", "Money in and out", "When you pay or get paid, straight away", True, True),
    ("flag", "Budget warnings", "When you're close to a limit you've set", True, False),
    ("calendar", "Bills due", "Two days before a bill is due", True, True),
    ("mail", "Weekly summary", "Mondays: what you spent and saved", False, True),
    ("star", "Offers and news", "New features and partner offers, now and then", False, False),
]


def notify_group(ic, title, desc, push, email):
    return f"""<article style="padding: 16px; border-radius: 16px; background: {C['low']}; display: flex; flex-direction: column; gap: 8px;">
<div style="display: flex; gap: 12px; align-items: flex-start;"><span style="width: 36px; height: 36px; flex-shrink: 0; border-radius: 10px; background: {C['cont']}; color: {C['variant']}; display: flex; align-items: center; justify-content: center;">{icon(ic, 20)}</span><div><h3 style="margin: 0; font-size: 16px; font-weight: 500; line-height: 24px;">{title}</h3><p style="margin: 0; font-size: 14px; line-height: 20px; color: {C['variant']};">{desc}</p></div></div>
<div style="display: flex; flex-direction: column; padding-left: 48px;">
<label style="display: flex; align-items: center; justify-content: space-between; min-height: 44px; font-size: 14px;">On your phone{switch(push)}</label>
<label style="display: flex; align-items: center; justify-content: space-between; min-height: 44px; font-size: 14px;">By email{switch(email)}</label>
</div></article>"""


def security_note():
    return f'<article style="padding: 16px; border-radius: 16px; background: {C["cont"]}; display: flex; gap: 12px; align-items: flex-start;"><span style="color: {C["variant"]}; display: flex; padding-top: 2px;">{icon("shield", 20)}</span><div><h3 style="margin: 0; font-size: 16px; font-weight: 500;">Security alerts</h3><p style="margin: 0; font-size: 14px; line-height: 20px; color: {C["variant"]};">Always on, by phone and email. We only send these when something needs you, like a new sign-in.</p></div></article>'


def notify_mobile():
    groups = "".join(notify_group(*n) for n in NOTIFY[:4])
    quiet = f'<article style="padding: 16px; border-radius: 16px; background: {C["low"]}; display: flex; align-items: center; gap: 12px;"><span style="color: {C["variant"]}; display: flex;">{icon("moon", 20)}</span><div style="flex-grow: 1;"><h3 style="margin: 0; font-size: 16px; font-weight: 500;">Quiet hours</h3><p style="margin: 0; font-size: 14px; color: {C["variant"]};">22:00–07:00 · Security alerts still come through</p></div>{switch(True)}</article>'
    body = f"""{app_bar("Notifications", "back")}
<div style="padding: 0 16px 24px; display: flex; flex-direction: column; gap: 12px;">
{security_note()}
{groups}
{quiet}
</div>"""
    return doc("Notifications · mobile", M_W, 1300, body)


def notify_desktop():
    nav = "".join(f'<a href="#" style="display: flex; align-items: center; height: 48px; padding: 0 16px; border-radius: 24px; text-decoration: none; font-size: 14px; font-weight: 500; {("background: " + C["secondary_c"] + "; color: " + C["on_secondary_c"] + ";") if n == "Notifications" else "color: " + C["variant"] + ";"}">{n}</a>' for n in ["Account", "Security", "Notifications", "Payments", "Privacy"])
    rows = "".join(
        f"""<tr style="border-top: 1px solid {C['outline_v']};"><th scope="row" style="padding: 16px; text-align: left; font-weight: 400;"><div style="display: flex; gap: 12px; align-items: center;"><span style="color: {C['variant']}; display: flex;">{icon(ic, 20)}</span><div><div style="font-size: 16px;">{t}</div><div style="font-size: 14px; color: {C['variant']};">{d}</div></div></div></th>
<td style="padding: 16px; text-align: center;">{switch(p)}</td><td style="padding: 16px; text-align: center;">{switch(e)}</td></tr>"""
        for ic, t, d, p, e in NOTIFY
    )
    table = f"""<div style="display: flex; flex-direction: column; gap: 16px; max-width: 820px;">{security_note()}
<table style="width: 100%; border-collapse: collapse; font-family: {FONT};"><thead><tr><th scope="col" style="text-align: left; padding: 8px 16px; font-size: 14px; font-weight: 500; color: {C['variant']};">What we tell you about</th><th scope="col" style="width: 120px; font-size: 14px; font-weight: 500; color: {C['variant']};">On your phone</th><th scope="col" style="width: 120px; font-size: 14px; font-weight: 500; color: {C['variant']};">By email</th></tr></thead><tbody>{rows}</tbody></table>
<div style="display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: 16px; background: {C['low']};"><span style="color: {C['variant']}; display: flex;">{icon("moon", 20)}</span><div style="flex-grow: 1;"><div style="font-size: 16px; font-weight: 500;">Quiet hours</div><div style="font-size: 14px; color: {C['variant']};">22:00–07:00. Security alerts still come through.</div></div>{switch(True)}</div></div>"""
    body = f"""<div style="display: flex; flex-grow: 1;"><nav aria-label="Settings" style="width: 240px; padding: 40px 16px; display: flex; flex-direction: column; gap: 4px;"><div style="padding: 0 16px 12px; font-size: 22px;">Settings</div>{nav}</nav>
<main style="flex-grow: 1; padding: 40px 48px; display: flex; flex-direction: column; gap: 24px;"><h1 style="margin: 0; font-size: 32px; font-weight: 400;">Notifications</h1>{table}</main></div>"""
    return doc("Notifications · desktop", D_W, 960, body)


# ---------------------------------------------------------------- 9 · Find a time

def people_row():
    ppl = [("PR", "Priya", C["warn_c"], C["on_warn_c"]), ("TO", "Tom", C["tertiary_c"], C["on_tertiary_c"])]
    chips = "".join(f'<span style="height: 32px; padding: 0 12px 0 4px; border-radius: 16px; background: {C["secondary_c"]}; color: {C["on_secondary_c"]}; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;">{avatar(i, bg, fg, 24)}{n}<span aria-label="Remove {n}" style="display: flex;">{icon("close", 16)}</span></span>' for i, n, bg, fg in ppl)
    return f'<div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">{chips}{chip("Add people", icon_name="user_plus")}</div>'


def day_strip():
    days = [("Mon", "22", 3, True), ("Tue", "23", 1, False), ("Wed", "24", 0, False), ("Thu", "25", 2, False), ("Fri", "26", 4, False)]
    cells = "".join(
        f'<button type="button" aria-pressed="{"true" if sel else "false"}" style="flex: 1; height: 72px; border-radius: 16px; border: {"0" if sel else "1px solid " + C["outline_v"]}; background: {C["primary"] if sel else "transparent"}; color: {"#FFFFFF" if sel else C["on_surface"]}; font-family: {FONT}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;"><span style="font-size: 12px;">{d}</span><span style="font-size: 20px;">{n}</span><span style="font-size: 11px; opacity: 0.85;">{str(free) + " free" if free else "busy"}</span></button>'
        for d, n, free, sel in days
    )
    return f'<div style="display: flex; gap: 8px;">{cells}</div>'


def slots():
    return f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;">{chip("09:30")}{chip("13:00", True)}{chip("16:00")}</div>'


def find_mobile():
    body = f"""{app_bar("New meeting", "close")}
<div style="padding: 0 16px 16px; display: flex; flex-direction: column; gap: 22px;">
{field("Title", "Design review")}
<section style="display: flex; flex-direction: column; gap: 10px;"><h2 style="margin: 0; font-size: 14px; font-weight: 500; color: {C['variant']};">Who's coming</h2>{people_row()}</section>
<section style="display: flex; flex-direction: column; gap: 10px;"><h2 style="margin: 0; font-size: 14px; font-weight: 500; color: {C['variant']};">How long</h2><div style="display: flex; gap: 8px;">{chip("15 min")}{chip("30 min", True)}{chip("45 min")}{chip("1 hour")}</div></section>
<section style="display: flex; flex-direction: column; gap: 12px;"><h2 style="margin: 0; font-size: 14px; font-weight: 500; color: {C['variant']};">When you're all free</h2>{day_strip()}{slots()}
<button type="button" style="align-self: flex-start; height: 40px; border: 0; background: none; padding: 0; font-family: {FONT}; font-size: 14px; font-weight: 500; color: {C['primary']}; display: flex; align-items: center; gap: 8px;">{icon("calendar", 18)}Propose a different time</button></section>
</div>
{bottom_bar(btn("Send invite · Mon 22 Sep, 13:00", full=True))}"""
    return doc("Find a time · mobile", M_W, 920, body)


def find_desktop():
    hours = ["09", "10", "11", "12", "13", "14", "15", "16", "17"]
    rows_def = [("You", "NS", [(0, 1), (3, 4)]), ("Priya", "PR", [(1, 3), (6, 7)]), ("Tom", "TO", [(2, 3), (5, 6.5)])]
    cols = len(hours)
    def row(name, ini, busy):
        blocks = "".join(f'<span style="position: absolute; top: 8px; bottom: 8px; left: {a / cols * 100}%; width: {(b - a) / cols * 100}%; border-radius: 8px; background: {C["highest"]}; border: 1px solid {C["outline_v"]};" aria-label="Busy"></span>' for a, b in busy)
        return f'<div style="display: flex; align-items: center; height: 56px;"><div style="width: 140px; display: flex; align-items: center; gap: 10px; font-size: 14px;">{avatar(ini, size=32)}{name}</div><div style="position: relative; flex-grow: 1; height: 56px; border-top: 1px solid {C["outline_v"]};">{blocks}</div></div>'
    scale = "".join(f'<span style="flex: 1; font-size: 12px; color: {C["variant"]};">{h}:00</span>' for h in hours)
    free = f'<div aria-label="Everyone free, 13:00 to 13:30" style="position: absolute; top: 0; bottom: 0; left: calc(140px + (100% - 140px) * {4 / cols}); width: calc((100% - 140px) * {0.5 / cols}); background: {C["primary_c"]}; border: 2px solid {C["primary"]}; border-radius: 8px;"></div>'
    grid = f"""<div style="position: relative; padding-top: 8px;">
<div style="display: flex; padding-left: 140px; padding-bottom: 8px;">{scale}</div>
<div style="position: relative;">{free}{''.join(row(*r) for r in rows_def)}</div>
</div>"""
    left = f"""<div style="width: 360px; flex-shrink: 0; display: flex; flex-direction: column; gap: 22px;">
{field("Title", "Design review")}
<section style="display: flex; flex-direction: column; gap: 10px;"><h2 style="margin: 0; font-size: 14px; font-weight: 500; color: {C['variant']};">Who's coming</h2>{people_row()}</section>
<section style="display: flex; flex-direction: column; gap: 10px;"><h2 style="margin: 0; font-size: 14px; font-weight: 500; color: {C['variant']};">How long</h2><div style="display: flex; gap: 8px;">{chip("15 min")}{chip("30 min", True)}{chip("45 min")}{chip("1 hour")}</div></section>
<section style="display: flex; flex-direction: column; gap: 10px;"><h2 style="margin: 0; font-size: 14px; font-weight: 500; color: {C['variant']};">Suggested times</h2>{slots()}</section>
{btn("Send invite · Mon 22 Sep, 13:00", full=True)}
</div>"""
    right = f"""<div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px;">{day_strip()}{card(grid, pad=20, bg=C['lowest'], border=True)}
<p style="margin: 0; font-size: 14px; color: {C['variant']};">Drag on the timeline to propose a different time.</p></div>"""
    body = desktop_shell("New meeting", f'<div style="display: flex; gap: 48px; align-items: flex-start;">{left}{right}</div>', "Calendar")
    return doc("Find a time · desktop", D_W, D_H, body)


# ---------------------------------------------------------------- 10 · Reading list

BOOKS = [("Piranesi", "Susanna Clarke", 160, None), ("Tomorrow, and Tomorrow, and Tomorrow", "Gabrielle Zevin", 20, 0.42), ("The Overstory", "Richard Powers", 120, None), ("Braiding Sweetgrass", "Robin Wall Kimmerer", 90, None)]


def cover(title, hue, w=48, h=72):
    return f'<span role="img" aria-label="Cover of {title}" style="width: {w}px; height: {h}px; flex-shrink: 0; border-radius: 6px; background: hsl({hue} 35% 72%);"></span>'


def reading_empty():
    body = f"""{app_bar("Reading list", "back")}
<div style="flex-grow: 1; padding: 24px 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 16px;">
<span style="width: 96px; height: 96px; border-radius: 28px; background: {C['primary_c']}; color: {C['on_primary_c']}; display: flex; align-items: center; justify-content: center;">{icon("book", 44, sw=1.75)}</span>
<h2 style="margin: 8px 0 0; font-size: 24px; font-weight: 400; line-height: 32px;">Start your reading list</h2>
<p style="margin: 0; font-size: 16px; line-height: 24px; color: {C['variant']};">Add a book you've been meaning to read. We'll keep your place and remind you where you left off.</p>
<div style="display: flex; flex-direction: column; gap: 10px; width: 100%; padding-top: 8px;">{btn("Add a book", full=True, icon_name="plus")}{btn("Import from Goodreads", "outlined", full=True)}</div>
</div>"""
    return doc("Reading list · empty", M_W, M_H, body)


def reading_list():
    items = ""
    for t, a, hue, prog in BOOKS:
        progress = f'<div style="display: flex; align-items: center; gap: 8px; padding-top: 6px;"><span style="flex-grow: 1; height: 4px; border-radius: 2px; background: {C["highest"]};"><span style="display: block; width: {int(prog * 100)}%; height: 4px; border-radius: 2px; background: {C["primary"]};"></span></span><span style="font-size: 12px; color: {C["variant"]};">{int(prog * 100)}%</span></div>' if prog else ""
        items += f'<a href="#" style="display: flex; gap: 16px; padding: 12px 16px; text-decoration: none; color: {C["on_surface"]};">{cover(t, hue)}<div style="flex-grow: 1; min-width: 0;"><div style="font-size: 16px; line-height: 24px;">{t}</div><div style="font-size: 14px; color: {C["variant"]};">{a}</div>{progress}</div></a>'
    tabs = f'<div role="tablist" style="display: flex; border-bottom: 1px solid {C["outline_v"]};">' + "".join(f'<button type="button" role="tab" aria-selected="{"true" if i == 0 else "false"}" style="flex: 1; height: 48px; border: 0; border-bottom: 3px solid {C["primary"] if i == 0 else "transparent"}; background: none; font-family: {FONT}; font-size: 14px; font-weight: 500; color: {C["primary"] if i == 0 else C["variant"]};">{t}</button>' for i, t in enumerate(["To read · 3", "Reading · 1", "Finished · 12"])) + "</div>"
    fab = f'<button type="button" style="position: absolute; right: 16px; bottom: 24px; height: 56px; padding: 0 20px; border: 0; border-radius: 16px; background: {C["primary_c"]}; color: {C["on_primary_c"]}; font-family: {FONT}; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 4px 8px 3px rgba(0,0,0,0.15);">{icon("plus")}Add a book</button>'
    body = f'<div style="position: relative; flex-grow: 1; display: flex; flex-direction: column;">{app_bar("Reading list", "back")}{tabs}<div style="padding-top: 4px;">{items}</div>{fab}</div>'
    return doc("Reading list · with books", M_W, M_H, body)


def reading_desktop():
    covers = "".join(f'<a href="#" style="display: flex; flex-direction: column; gap: 10px; text-decoration: none; color: {C["on_surface"]};">{cover(t, hue, w="100%", h=240).replace("width: 100%px", "width: 100%")}<div><div style="font-size: 16px; line-height: 22px;">{t}</div><div style="font-size: 14px; color: {C["variant"]};">{a}</div></div></a>' for t, a, hue, _ in BOOKS)
    tabs = "".join(f'<button type="button" role="tab" aria-selected="{"true" if i == 0 else "false"}" style="height: 40px; padding: 0 16px; border-radius: 20px; border: 0; background: {C["secondary_c"] if i == 0 else "transparent"}; color: {C["on_secondary_c"] if i == 0 else C["variant"]}; font-family: {FONT}; font-size: 14px; font-weight: 500;">{t}</button>' for i, t in enumerate(["To read · 3", "Reading · 1", "Finished · 12"]))
    body = desktop_shell("Reading list", f'<div style="display: flex; justify-content: space-between; align-items: center;"><div role="tablist" style="display: flex; gap: 8px;">{tabs}</div>{btn("Add a book", icon_name="plus")}</div><div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 32px 24px;">{covers}</div>')
    return doc("Reading list · desktop", D_W, 760, body)
