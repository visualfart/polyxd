"""Studio: signing up to signing out, your account, the shell's menus, patterns, and the states between."""
from kit import (S, TONE, BODY, DISPLAY, MONO, ic, doc, tag, dot, btn, avatar, label, field, textarea, select, switch,
                 checkbox, radio, segmented, swatch, meter, mono, card, h2, notice, table, search, filter_chip, tabs,
                 app, page_head, drawer, dialog, toast, mini_surface, mini_desktop, kbd, scrim)
from screens_a import home


# ---------------------------------------------------------------- the auth frame

def auth(title, form, aside=None):
    aside = aside or f'''<p style="margin: 0; font-family: {DISPLAY}; font-size: 28px; line-height: 36px; font-weight: 500; max-width: 440px;">Screens written on demand, in your design system, checked before anyone sees them.</p>
<p style="margin: 0; font-size: 14px; color: #CFCBC0; max-width: 420px;">Studio is where your design system team decides what those screens may look like, and reviews what they actually look like.</p>'''
    return doc(title, 1440, 900, f'''<main style="flex: 1 1 0; display: flex; flex-direction: column; background: {S["paper"]};">
<header style="height: 72px; padding: 0 48px; display: flex; align-items: center; gap: 10px;"><span aria-hidden="true" style="width: 28px; height: 28px; border-radius: 8px; background: {S["ink"]}; color: {S["signal"]}; display: inline-flex; align-items: center; justify-content: center; font-family: {DISPLAY}; font-weight: 700;">p</span><span style="font-family: {DISPLAY}; font-weight: 700; font-size: 16px;">Polyxd Studio</span></header>
<div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 72px;"><div style="width: 400px; display: flex; flex-direction: column; gap: 18px;">{form}</div></div>
</main>
<aside style="flex: 1 1 0; background: {S["night"]}; color: {S["night_text"]}; display: flex; flex-direction: column; justify-content: center; padding: 64px; gap: 20px;">{aside}</aside>''')


def title_block(t, sub=None):
    s = f'<p style="margin: 6px 0 0; font-size: 15px; color: {S["muted"]};">{sub}</p>' if sub else ""
    return f'<div><h1 style="margin: 0; font-family: {DISPLAY}; font-size: 30px; line-height: 36px; font-weight: 700; letter-spacing: -0.01em;">{t}</h1>{s}</div>'


def provider_btn(text, icon_name):
    return f'<button type="button" style="height: 44px; border: 1px solid {S["line"]}; border-radius: 10px; background: {S["paper"]}; font-family: {BODY}; font-size: 14px; font-weight: 500; color: {S["ink"]}; display: flex; align-items: center; justify-content: center; gap: 10px;">{ic(icon_name, 18)}{text}</button>'


def or_line():
    return f'<div style="display: flex; align-items: center; gap: 12px; color: {S["muted"]}; font-size: 12px;"><span style="flex-grow: 1; height: 1px; background: {S["line"]};"></span>or<span style="flex-grow: 1; height: 1px; background: {S["line"]};"></span></div>'


def primary_full(text, icon_name=None):
    return btn(text, "primary", icon_name, h=44, w=400)


def password_rules(met):
    return f'<ul style="list-style: none; margin: -8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 12px;">{"".join(f"<li style=\"display: flex; gap: 6px; align-items: center; color: {S['ok'] if m else S['muted']};\">{ic('check' if m else 'dot_small', 13) if m else '<span aria-hidden=\"true\" style=\"width: 13px; text-align: center;\">·</span>'}<span>{'<span style=\"position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);\">Met: </span>' if m else ''}{t}</span></li>" for t, m in met)}</ul>'


def code_boxes(value="482", n=6):
    boxes = "".join(f'<input aria-label="Digit {i + 1}" value="{value[i] if i < len(value) else ""}" maxlength="1" style="width: 52px; height: 60px; box-sizing: border-box; border: {"2px solid " + S["ink"] if i == len(value) else "1px solid " + S["line"]}; border-radius: 10px; text-align: center; font-family: {MONO}; font-size: 24px; color: {S["ink"]};">' for i in range(n))
    return f'<div role="group" aria-label="6-digit code" style="display: flex; gap: 10px;">{boxes}</div>'


def sign_up():
    form = f'''{title_block("Create your account", "Free for one workspace. No card needed.")}
{provider_btn("Continue with Google", "sparkle")}
{provider_btn("Continue with SSO", "key")}
{or_line()}
{field("Work email", "maya@northwind.io", "su-email", h=44)}
{field("Full name", "Maya Rao", "su-name", h=44)}
{field("Password", "••••••••••••", "su-pass", h=44, suffix="Show")}
{password_rules([("At least 12 characters", True), ("Not a password found in a data breach", True)])}
{primary_full("Create account")}
<p style="margin: 0; font-size: 12px; color: {S["muted"]};">By creating an account you agree to the <a href="#">Terms</a> and <a href="#">Privacy policy</a>.</p>
<p style="margin: 0; font-size: 14px; color: {S["ink2"]};">Already have an account? <a href="#">Sign in</a></p>'''
    return auth("Sign up", form)


def verify_email():
    form = f'''{title_block("Check your email", None)}
<p style="margin: -6px 0 0; font-size: 15px; color: {S["muted"]};">We sent a 6-digit code to <strong style="color: {S["ink"]};">maya@northwind.io</strong>. It works for 10 minutes.</p>
{code_boxes("482")}
{primary_full("Verify email")}
<div style="display: flex; justify-content: space-between; font-size: 14px;"><span style="color: {S["muted"]};">Nothing yet? <a href="#">Send a new code</a> in 0:42</span><a href="#">Change email</a></div>'''
    return auth("Verify your email", form)


def sign_in():
    form = f'''{title_block("Sign in to Studio")}
{provider_btn("Continue with Google", "sparkle")}
{provider_btn("Continue with SSO", "key")}
{or_line()}
{field("Email", "maya@northwind.io", "si-email", h=44)}
<div style="display: flex; flex-direction: column; gap: 6px;"><div style="display: flex; justify-content: space-between;">{label("Password", "si-pass")}<a href="#" style="font-size: 13px;">Forgot password?</a></div><div style="height: 44px; box-sizing: border-box; border: 1px solid {S["line"]}; border-radius: 8px; display: flex; align-items: center;"><input id="si-pass" type="password" value="••••••••••••" style="flex-grow: 1; height: 100%; border: 0; background: transparent; padding: 0 10px; font-family: {BODY}; font-size: 14px;"><button type="button" style="border: 0; background: transparent; font-family: {BODY}; font-size: 13px; color: {S["muted"]}; padding: 0 12px;">Show</button></div></div>
{checkbox(True, "", "Keep me signed in on this device")}
{primary_full("Sign in")}
<p style="margin: 0; font-size: 14px; color: {S["ink2"]};">New to Studio? <a href="#">Create an account</a></p>'''
    return auth("Sign in", form)


def sign_in_error():
    form = f'''{title_block("Sign in to Studio")}
{notice("That email and password don't match", "Check for typos, or reset your password. After 5 more tries we'll pause sign-in for 15 minutes.", "bad")}
{field("Email", "maya@northwind.io", "se-email", h=44)}
{field("Password", "", "se-pass", h=44, error="Enter your password again")}
{primary_full("Sign in")}
<p style="margin: 0; font-size: 14px; color: {S["ink2"]};"><a href="#">Reset your password</a> · <a href="#">Sign in with SSO instead</a></p>'''
    return auth("Sign in failed", form)


def sign_in_sso():
    form = f'''{title_block("Sign in with SSO", "Use your work email and we'll send you to your company's sign-in.")}
{field("Work email", "maya@northwind.io", "sso-email", h=44)}
<div style="display: flex; gap: 12px; align-items: center; padding: 12px 14px; border: 1px solid {S["line"]}; border-radius: 10px;">{ic("shield", 20, S["ok"])}<div><div style="font-weight: 600;">Northwind signs in with Okta</div><div style="font-size: 13px; color: {S["muted"]};">Required for everyone at northwind.io</div></div></div>
{primary_full("Continue to Okta", "arrow_r")}
<p style="margin: 0; font-size: 14px;"><a href="#">Back to other ways to sign in</a></p>'''
    return auth("Sign in with SSO", form)


def two_factor():
    form = f'''{title_block("Enter your 2-step code", "Open your authenticator app and enter the code for Polyxd Studio.")}
{code_boxes("")}
{checkbox(True, "", "Don't ask again on this device for 30 days")}
{primary_full("Verify")}
<p style="margin: 0; font-size: 14px; color: {S["ink2"]};">Lost your phone? <a href="#">Use a recovery code</a></p>'''
    return auth("Two-step verification", form)


def forgot_password():
    form = f'''{title_block("Reset your password", "Enter your email and we'll send a link to choose a new one.")}
{field("Email", "maya@northwind.io", "fp-email", h=44)}
{primary_full("Send reset link")}
{notice("Check your email", "If there's an account for maya@northwind.io, a link is on its way. It works for 1 hour.", "ok")}
<p style="margin: 0; font-size: 14px;"><a href="#">Back to sign in</a></p>'''
    return auth("Forgot password", form)


def reset_password():
    form = f'''{title_block("Choose a new password", "For maya@northwind.io.")}
{field("New password", "••••••••••••••", "rp-pass", h=44, suffix="Show")}
{password_rules([("At least 12 characters", True), ("Not a password found in a data breach", True), ("Not one you've used here before", True)])}
{checkbox(True, "", "Sign out of every other device")}
{primary_full("Save and sign in")}'''
    return auth("Reset password", form)


def invite_accept():
    form = f'''<div style="display: flex; gap: 12px; align-items: center;">{avatar("MR", "info", 40)}<span style="font-size: 14px; color: {S["ink2"]};"><strong style="color: {S["ink"]};">Maya Rao</strong> invited you to Northwind</span></div>
{title_block("Join Northwind on Studio", "You'll be a Designer: direction, reviews and exemplars.")}
<div style="padding: 12px 14px; border-radius: 10px; background: {S["sunk"]}; border: 1px solid {S["line"]}; font-size: 13px; color: {S["ink2"]};">“Joining to help review the new payment screens.”</div>
{provider_btn("Join with Google", "sparkle")}
{or_line()}
{field("Email", "ana@northwind.io", "ia-email", h=44, help_text="From the invite; it can't be changed.")}
{field("Full name", "", "ia-name", h=44, placeholder="Your name")}
{field("Password", "", "ia-pass", h=44)}
{primary_full("Accept and join")}
<p style="margin: 0; font-size: 12px; color: {S["muted"]};">Not you, or not expecting this? <a href="#">Decline the invite</a>. It expires in 6 days.</p>'''
    return auth("Accept an invite", form)


def signed_out():
    form = f'''<span style="display: inline-flex; width: 48px; height: 48px; border-radius: 12px; background: {S["soft"]}; align-items: center; justify-content: center;">{ic("check", 24)}</span>
{title_block("You're signed out", "Your drafts are saved. Anything waiting for review stays in the queue.")}
{primary_full("Sign in again")}
<p style="margin: 0; font-size: 14px;"><a href="#">Sign in with a different account</a></p>'''
    return auth("Signed out", form)


def session_expired():
    body = f'''<p style="margin: 0; font-size: 14px; color: {S["ink2"]};">For security, Studio signs you out after 12 hours. Your draft of <strong>Profile and voice</strong> is saved.</p>
{field("Password for maya@northwind.io", "", "se2-pass")}'''
    return home().replace("</main>", "</main>" + dialog("Sign in again to keep going", body, f'{btn("Sign out", "ghost")}{btn("Sign in", "primary")}', w=460), 1)


# ---------------------------------------------------------------- the shell: user menu, notifications, search, workspaces

def popover(html, left=None, right=None, top=None, bottom=None, w=300):
    pos = " ".join(f"{k}: {v}px;" for k, v in [("left", left), ("right", right), ("top", top), ("bottom", bottom)] if v is not None)
    return f'<div style="position: absolute; {pos} width: {w}px; box-sizing: border-box; background: {S["paper"]}; border: 1px solid {S["line"]}; border-radius: 12px; box-shadow: 0 16px 40px rgba(20,20,20,.16); padding: 6px; display: flex; flex-direction: column;">{html}</div>'


def menu_item(text, icon_name=None, kbd_=None, danger=False, sub=None):
    k = f'<span style="margin-left: auto;">{kbd(kbd_)}</span>' if kbd_ else ""
    s = f'<span style="display: block; font-size: 12px; color: {S["muted"]};">{sub}</span>' if sub else ""
    color = S["bad"] if danger else S["ink"]
    i = f'<span style="display: flex; color: {S["bad"] if danger else S["muted"]};">{ic(icon_name, 16)}</span>' if icon_name else ""
    return f'<button type="button" role="menuitem" style="display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 6px 10px; border: 0; border-radius: 8px; background: transparent; font-family: {BODY}; font-size: 14px; color: {color}; text-align: left;">{i}<span>{text}{s}</span>{k}</button>'


def sep():
    return f'<div role="separator" style="height: 1px; background: {S["soft"]}; margin: 6px 4px;"></div>'


def user_menu():
    m = f'''<div style="display: flex; gap: 10px; align-items: center; padding: 10px;">{avatar("MR", "info", 36)}<div><div style="font-weight: 600;">Maya Rao</div><div style="font-size: 12px; color: {S["muted"]};">maya@northwind.io</div></div></div>{sep()}
<div role="menu" aria-label="Account" style="display: flex; flex-direction: column;">
{menu_item("Your profile", "contact")}{menu_item("Sign-in and security", "lock")}{menu_item("Notifications", "bell")}{sep()}
{menu_item("Switch workspace", "repeat", sub="Northwind · 2 others")}{menu_item("Keyboard shortcuts", "grid", "?")}{menu_item("Docs and help", "book")}{sep()}
{menu_item("Sign out", "arrow_r")}
</div>'''
    return home().replace("</main>", "</main>" + popover(m, left=12, bottom=70, w=280), 1)


def workspace_switcher():
    ws = "".join(f'<button type="button" role="menuitemradio" aria-checked="{"true" if on else "false"}" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 0; border-radius: 8px; background: {S["soft"] if on else "transparent"}; font-family: {BODY}; text-align: left;"><span aria-hidden="true" style="width: 28px; height: 28px; border-radius: 8px; background: {c}; color: #FFFFFF; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;">{n[0]}</span><span style="flex-grow: 1;"><span style="display: block; font-size: 14px; font-weight: 600; color: {S["ink"]};">{n}</span><span style="font-size: 12px; color: {S["muted"]};">{r}</span></span>{ic("check", 16) if on else ""}</button>' for n, r, c, on in [("Northwind", "Design system lead · 5 people", "#1849A9", True), ("Northwind Marketing site", "Designer · 3 people", "#B8350A", False), ("Acme (client)", "Viewer · 12 people", "#1D6B3F", False)])
    m = f'''<div style="padding: 8px 10px 4px; font-size: 12px; font-weight: 600; color: {S["muted"]};">Workspaces</div><div role="menu" aria-label="Workspaces" style="display: flex; flex-direction: column; gap: 2px;">{ws}</div>{sep()}{menu_item("Create a workspace", "plus")}{menu_item("Join with an invite code", "link")}'''
    return home().replace("</main>", "</main>" + popover(m, left=12, top=62, w=300), 1)


def notifications_panel():
    items = "".join(f'<li style="display: flex; gap: 12px; padding: 12px 10px; border-radius: 8px; background: {S["signal_bg"] if unread else "transparent"};">{dot(t) if unread else "<span style=\"width: 8px;\"></span>"}<div style="flex-grow: 1; font-size: 13px; line-height: 18px;"><div>{text}</div><div style="color: {S["muted"]}; font-size: 12px; margin-top: 2px;">{when}</div></div></li>' for t, text, when, unread in [
        ("bad", "<strong>Release 14 paused itself</strong> at 50%: agent task success fell 6% on accounts.list.", "8 min ago", True),
        ("signal", "<strong>Jonas</strong> asked you to review 6 screens for transfer.create.", "1 hour ago", True),
        ("warn", "<strong>Figma sync</strong> found 14 broken references in Northwind · Tokens.", "3 hours ago", False),
        ("ok", "<strong>Release 13</strong> reached everyone. All guardrails held.", "Yesterday", False),
    ])
    m = f'''<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px;"><strong style="font-size: 15px;">Notifications</strong><div style="display: flex; gap: 4px;">{btn("Mark all read", "ghost", h=28)}{btn("Notification settings", "ghost", "gear", h=28, only_icon=True)}</div></div>
<div style="padding: 0 10px 8px;">{segmented(["All", "For you", "Releases"], "All", "Show")}</div>
<ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px;">{items}</ul>'''
    return home().replace("</main>", "</main>" + popover(m, right=28, top=50, w=400), 1)


def command_search():
    def res(icon_name, t, sub, kind, on=False):
        return f'<li role="option" aria-selected="{"true" if on else "false"}" style="display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 8px; background: {S["soft"] if on else "transparent"};"><span style="display: flex; color: {S["muted"]};">{ic(icon_name, 18)}</span><span style="flex-grow: 1;"><span style="display: block; font-size: 14px; font-weight: 500;">{t}</span><span style="font-size: 12px; color: {S["muted"]};">{sub}</span></span>{tag(kind, "gray")}</li>'
    box = f'''<div role="dialog" aria-modal="true" aria-label="Search Studio" style="position: absolute; left: 50%; top: 120px; transform: translateX(-50%); width: 640px; background: {S["paper"]}; border-radius: 14px; box-shadow: 0 24px 64px rgba(20,20,20,.28); display: flex; flex-direction: column;">
<div style="display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid {S["soft"]};">{ic("search", 18, S["muted"])}<input aria-label="Search Studio" value="primary" style="flex-grow: 1; border: 0; font-family: {BODY}; font-size: 16px; outline: none;">{kbd("Esc")}</div>
<ul role="listbox" aria-label="Results" style="list-style: none; margin: 0; padding: 8px; display: flex; flex-direction: column; gap: 2px;">
<li style="padding: 6px 12px; font-size: 12px; font-weight: 600; color: {S["muted"]};">Tokens and roles</li>
{res("palette", "color.action.primary", "Northwind · action/primary → brand/600", "Role", True)}
{res("palette", "button/primary/bg", "Northwind · component token", "Token")}
<li style="padding: 6px 12px; font-size: 12px; font-weight: 600; color: {S["muted"]};">Rules and screens</li>
{res("rule", "One primary action per view", "99.4% passing", "Rule")}
{res("eye", "“send Alex £40…”", "Waiting for review", "Screen")}
</ul>
<div style="padding: 10px 16px; border-top: 1px solid {S["soft"]}; font-size: 12px; color: {S["muted"]}; display: flex; gap: 16px;"><span>{kbd("↑")} {kbd("↓")} to move</span><span>{kbd("Enter")} to open</span><span>Type {kbd(">")} for actions</span></div>
</div>'''
    return home().replace("</main>", "</main>" + scrim() + box, 1)


# ---------------------------------------------------------------- your account

def account_nav(active):
    return f'<nav aria-label="Your account" style="width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px;">{"".join(f"<a href=\"#\" style=\"padding: 8px 10px; border-radius: 8px; font-size: 14px; color: {S['ink']}; background: {S['soft'] if n == active else 'transparent'}; font-weight: {600 if n == active else 500};\">{n}</a>" for n in ["Profile", "Sign-in and security", "Notifications"])}</nav>'


def account_profile():
    body = page_head("Your account") + f'''<div style="padding: 8px 32px 32px; display: flex; gap: 28px; align-items: flex-start;">{account_nav("Profile")}
<div style="flex-grow: 1; max-width: 680px; display: flex; flex-direction: column; gap: 18px;">
{card(h2("Profile") + f'<div style="display: flex; gap: 16px; align-items: center;">{avatar("MR", "info", 64)}<div style="display: flex; gap: 8px;">{btn("Upload a photo", "secondary", "upload", h=32)}{btn("Remove", "ghost", h=32)}</div></div>' + field("Full name", "Maya Rao", "ap-name") + field("Job title", "Design system lead", "ap-title", help_text="Shown next to your reviews and comments."), pad=20, gap=14)}
{card(h2("Email") + f'<div style="display: flex; justify-content: space-between; align-items: center;"><div><div style="font-weight: 500;">maya@northwind.io</div><div style="font-size: 12px; color: {S["muted"]};">Verified · managed by Northwind SSO</div></div>{btn("Change email", "secondary", h=32)}</div>', pad=20, gap=10)}
{card(h2("Region") + select("Time zone", "London (GMT+1)", "ap-tz") + select("Language", "English (UK)", "ap-lang"), pad=20, gap=14)}
<div>{btn("Save changes", "primary")}</div>
</div></div>'''
    return app("Your profile", "", ["Your account", "Profile"], body)


def account_security():
    sessions = table(["Device", "Where", "Last active", ""], [
        [f'<span style="display: inline-flex; gap: 8px; align-items: center;">{ic("monitor", 16)}Chrome on macOS</span>', "London, UK", tag("This device", "ok"), ""],
        [f'<span style="display: inline-flex; gap: 8px; align-items: center;">{ic("phone", 16)}Safari on iPhone</span>', "London, UK", "2 hours ago", btn("Sign out", "ghost", h=28)],
        [f'<span style="display: inline-flex; gap: 8px; align-items: center;">{ic("monitor", 16)}Firefox on Windows</span>', "Berlin, DE", "9 days ago", btn("Sign out", "ghost", h=28)],
    ], aligns=["left", "left", "left", "right"], widths=[None, 140, 130, 110], row_h=48, pad_x=0)
    body = page_head("Your account") + f'''<div style="padding: 8px 32px 32px; display: flex; gap: 28px; align-items: flex-start;">{account_nav("Sign-in and security")}
<div style="flex-grow: 1; max-width: 760px; display: flex; flex-direction: column; gap: 18px;">
{card(h2("Password", "Last changed 4 months ago.", btn("Change password", "secondary", h=32)), pad=20)}
{card(h2("2-step verification", "Required by Northwind.") + f'<div style="display: flex; flex-direction: column; gap: 10px;"><div style="display: flex; justify-content: space-between; align-items: center;"><span style="display: inline-flex; gap: 10px; align-items: center;">{ic("phone", 18)}Authenticator app</span>{tag("On", "ok")}</div><div style="display: flex; justify-content: space-between; align-items: center;"><span style="display: inline-flex; gap: 10px; align-items: center;">{ic("key", 18)}Recovery codes · 8 of 10 left</span>{btn("Show new codes", "secondary", h=30)}</div></div>', pad=20, gap=12)}
{card(h2("Where you're signed in", None, btn("Sign out everywhere else", "secondary", h=32)) + sessions, pad=20, gap=8)}
{card(h2("Leave or delete", "Leave a workspace from its settings. Deleting your account removes you from all 3 and can't be undone.") + f'<div>{btn("Delete my account", "danger_ghost", "trash")}</div>', pad=20, gap=10)}
</div></div>'''
    return app("Sign-in and security", "", ["Your account", "Sign-in and security"], body)


def account_notifications():
    rows = [[t, switch(a, "Email: " + t), switch(b, "In Studio: " + t)] for t, a, b in [("A release pauses or rolls back", True, True), ("Screens are assigned to me for review", True, True), ("Someone comments on my rule or review", False, True), ("A design system sync finds problems", True, True), ("Weekly quality summary", True, False)]]
    body = page_head("Your account") + f'''<div style="padding: 8px 32px 32px; display: flex; gap: 28px; align-items: flex-start;">{account_nav("Notifications")}
<div style="flex-grow: 1; max-width: 760px; display: flex; flex-direction: column; gap: 14px;">{h2("Notifications", "What reaches you, and where. Releases that pause always reach owners.")}
{table(["", "Email", "In Studio"], rows, aligns=["left", "center", "center"], widths=[None, 110, 110], row_h=52, pad_x=0, caption="Notification settings")}
</div></div>'''
    return app("Notification settings", "", ["Your account", "Notifications"], body)


# ---------------------------------------------------------------- patterns

PATTERNS = [
    ("Confirm destructive", "Deletes, cancels and removals show what is lost, before the button.", 4, 612, "confirm-destructive"),
    ("Undo over confirm", "Everyday, reversible actions happen at once and offer Undo.", 2, 1840, "undo-over-confirm"),
    ("Review and submit", "Money and access changes get a summary before they commit.", 5, 902, "review-and-submit"),
    ("Multi-step form", "Long tasks split into steps with progress and a way back.", 4, 244, "multi-step-form"),
    ("Results with filters", "Search and filters above results, with a count and an empty state.", 3, 1480, "results-with-filters"),
    ("Comparison", "A few options on the same attributes, one recommendation.", 3, 310, "comparison"),
]


def patterns():
    tiles = "".join(card(f'<div style="display: flex; justify-content: space-between; align-items: flex-start;"><h3 style="margin: 0; font-size: 15px;">{n}</h3>{switch(True, "Use " + n)}</div><p style="margin: 0; font-size: 13px; color: {S["ink2"]};">{d}</p><div style="display: flex; gap: 12px; font-size: 12px; color: {S["muted"]};"><span>{r} rules</span><span>{u:,} screens, 7 days</span></div><div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid {S["soft"]}; padding-top: 10px;">{mono(slug, 12)}<a href="#" style="font-size: 13px; font-weight: 500;">Open</a></div>', pad=18, gap=10) for n, d, r, u, slug in PATTERNS)
    body = page_head("Patterns", "Proven shapes for common jobs. Each brings rules every screen of that kind is checked against. Turn one off and generators stop using it.", btn("New pattern", "primary", "plus"), tabs_html=tabs([("Polyxd", 6), ("Yours", 0)], "Polyxd")) + f'<div style="padding: 20px 32px 32px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px;">{tiles}</div>'
    return app("Patterns", "Patterns", ["Northwind", "Foundations", "Patterns"], body)


def pattern_detail():
    rules = "".join(f'<li style="display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid {S["soft"]};">{tag(sev, "bad" if sev == "Error" else "warn")}<span style="flex-grow: 1;">{t}</span><span style="font-size: 13px; color: {S["muted"]};">{p}</span></li>' for sev, t, p in [("Error", "The title names what is deleted", "98.1%"), ("Error", "What is lost is listed before the button", "97.4%"), ("Error", "Irreversible and high impact: a typed check", "100%"), ("Warning", "The safe choice is as easy to reach as the risky one", "94.0%")])
    body = page_head("Confirm destructive", "Deletes, cancels and removals show what is lost, before the button.", f'{btn("Duplicate as yours", "secondary", "copy")}{switch(True, "Use this pattern")}', meta=f'{tag("Polyxd", "gray")}<span style="font-size: 13px; color: {S["muted"]};">Used by 612 screens in 7 days · 3 capabilities</span>') + f'''<div style="padding: 20px 32px 32px; display: flex; gap: 24px; align-items: flex-start;">
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 18px;">{card(h2("Rules it brings", "Checked on every screen that uses this pattern.") + f'<ul style="list-style: none; margin: 0; padding: 0;">{rules}</ul>', pad=20, gap=6)}
{card(h2("Applies when") + f'<p style="margin: 0; font-size: 14px;">A screen triggers a capability whose risk is <strong>High</strong> or <strong>Destructive</strong>, and the action removes something.</p><div style="display: flex; gap: 6px; flex-wrap: wrap;">{tag("account.delete", "gray", True)}{tag("subscription.cancel", "gray", True)}{tag("members.remove", "gray", True)}</div>', pad=20, gap=10)}</div>
<div style="display: flex; gap: 16px; flex-shrink: 0;">{mini_surface("delete", "northwind", 250, 460, "Phone")}{mini_desktop("delete", "northwind", 460, 320, "Desktop")}</div>
</div>'''
    return app("Confirm destructive pattern", "Patterns", ["Northwind", "Patterns", "Confirm destructive"], body)


# ---------------------------------------------------------------- states

def empty_state(icon_name, title, text, actions):
    return f'''<div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 48px;"><div style="max-width: 440px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px;">
<span style="width: 56px; height: 56px; border-radius: 16px; background: {S["soft"]}; display: inline-flex; align-items: center; justify-content: center; color: {S["ink2"]};">{ic(icon_name, 26)}</span>
<h2 style="margin: 0; font-family: {DISPLAY}; font-size: 22px; line-height: 28px; font-weight: 700;">{title}</h2>
<p style="margin: 0; font-size: 14px; color: {S["muted"]};">{text}</p>
<div style="display: flex; gap: 8px; margin-top: 6px;">{actions}</div></div></div>'''


def reviews_empty():
    body = page_head("Reviews", tabs_html=tabs([("To review", 0), ("Ranking", 0), ("Approved", 312), ("Changes asked", 27)], "To review")) + empty_state("check_circle", "You're all caught up", "New screens show up here when they use a new intent, score low, touch money or access, or are sampled. About 20 arrive on a normal day.", f'{btn("Review settings", "secondary", "gear")}{btn("Browse approved screens", "ghost")}')
    return app("Reviews: all caught up", "Reviews", ["Northwind", "Reviews"], body)


def rules_empty():
    sug = "".join(f'<li style="display: flex; gap: 12px; align-items: center; padding: 12px 14px; border: 1px solid {S["line"]}; border-radius: 10px; text-align: left;"><span style="flex-grow: 1; font-size: 14px;">{t}</span>{btn("Add", "secondary", "plus", h=30)}</li>' for t in ["Destructive actions name what is lost", "Never ask “Are you sure”", "Amounts are the largest text on a payment"])
    body = page_head("Rules", tabs_html="") + f'''<div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 48px;"><div style="width: 520px; display: flex; flex-direction: column; gap: 14px; text-align: center; align-items: center;">
<span style="width: 56px; height: 56px; border-radius: 16px; background: {S["soft"]}; display: inline-flex; align-items: center; justify-content: center; color: {S["ink2"]};">{ic("rule", 26)}</span>
<h2 style="margin: 0; font-family: {DISPLAY}; font-size: 22px; line-height: 28px; font-weight: 700;">No rules of your own yet</h2>
<p style="margin: 0; font-size: 14px; color: {S["muted"]};">Polyxd's 13 built-in rules already run on every screen. Add yours to hold screens to Northwind's standards. Teams usually start with these:</p>
<ul style="list-style: none; margin: 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 8px;">{sug}</ul>
<div>{btn("Write a rule", "primary", "plus")}</div></div></div>'''
    return app("Rules: none yet", "Rules", ["Northwind", "Direction", "Rules"], body)


def no_access():
    body = empty_state("lock", "You can't open Releases", "Your role, Designer, can review and set direction but not publish. A design system lead or owner can give you access.", f'{btn("Ask Maya for access", "primary", "send")}{btn("Go home", "secondary")}')
    return app("No access", "Releases", ["Northwind", "Releases"], body)


def not_found():
    body = empty_state("compass", "That page isn't here", "The rule, screen or release may have been deleted, or the link is from another workspace.", f'{btn("Go home", "primary")}{btn("Search Studio", "secondary", "search")}')
    return app("Page not found", "", ["Northwind"], body)
