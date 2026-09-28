"""Studio, second half: direction, reviews, product (capabilities, journeys), releases, insights, settings."""
from kit import (mini_desktop, S, TONE, MARK, BODY, DISPLAY, MONO, ic, doc, tag, dot, btn, avatar, label, field, textarea, select, switch,
                 checkbox, radio, segmented, swatch, meter, mono, card, h2, notice, table, search, filter_chip, tabs,
                 app, page_head, drawer, dialog, toast, mini_surface, kbd, scrim)
from screens_a import stat, spark


def with_overlay(html, overlay):
    return html.replace("</main>", "</main>" + overlay, 1)


# ---------------------------------------------------------------- direction

def slider(lbl, left, right, pct, id_):
    return f'''<div style="display: flex; flex-direction: column; gap: 8px;">
{label(lbl, id_)}
<input id="{id_}" type="range" min="0" max="100" value="{pct}" style="width: 100%; accent-color: {S["ink"]}; margin: 0;">
<div style="display: flex; justify-content: space-between; font-size: 12px; color: {S["muted"]};"><span>{left}</span><span>{right}</span></div>
</div>'''


def direction():
    principles = textarea("Principles", "Say what will happen, not whether they are sure.\nName the thing: &quot;Delete Acme Corp&quot;, not &quot;Delete item&quot;.\nNo exclamation marks, no &quot;oops&quot;.", "principles", 84)
    words = "".join(
        f'<tr><td style="padding: 8px 12px 8px 0; border-bottom: 1px solid {S["soft"]};">{a}</td><td style="padding: 8px 12px; border-bottom: 1px solid {S["soft"]}; color: {S["muted"]}; text-decoration: line-through;">{b}</td><td style="padding: 8px 0; border-bottom: 1px solid {S["soft"]}; text-align: right;">{btn("Remove " + a, "ghost", "close", h=26, only_icon=True)}</td></tr>'
        for a, b in [("Sign in", "Log in"), ("Account", "Profile"), ("Delete", "Remove (for data)"), ("Customer", "Client")]
    )
    left = f'''<div style="width: 560px; flex-shrink: 0; display: flex; flex-direction: column; gap: 18px;">
{card(h2("Profile", "How dense and how emphatic Northwind's screens are.") + f'''
<div style="display: flex; flex-direction: column; gap: 8px;">{label("Density")}{segmented(["Comfortable", "Default", "Compact"], "Compact", "Density")}<span style="font-size: 12px; color: {S["muted"]};">Rows 32px, controls 32px. Touch screens keep a 44px floor.</span></div>
<div style="display: flex; gap: 20px;">{field("Primary actions per view", "1", "budget", w=180, help_text="One main thing to do")}{select("Reading level", "Plain: grade 8", "grade", w=240)}</div>''', pad=20, gap=14)}
{card(h2("Voice", "Generators write copy to this. Reviewers check it.") + f'''
{slider("Tone", "Formal", "Casual", 62, "tone")}
{slider("Detail", "Say only what's needed", "Explain", 30, "detail")}
{principles}''', pad=20, gap=14)}
</div>'''
    right = f'''<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 18px;">
{card(h2("Words we use", "Generators use the left column; the verifier flags the right.", btn("Add a word", "secondary", "plus", h=30)) + f'<table style="width: 100%; border-collapse: collapse; font-size: 14px;"><thead><tr><th scope="col" style="text-align: left; font-size: 12px; font-weight: 500; color: {S["muted"]}; padding-bottom: 6px;">Say</th><th scope="col" style="text-align: left; font-size: 12px; font-weight: 500; color: {S["muted"]}; padding: 0 12px 6px;">Instead of</th><th></th></tr></thead><tbody>{words}</tbody></table>', pad=20, gap=10)}
{card(h2("Live preview", "A real request, redrawn with this draft.") + f'<div style="display: flex; gap: 16px; align-items: flex-start;">{mini_surface("delete", "northwind", 250, 360, "Draft")}<div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: {S["ink2"]};"><span style="font-weight: 600; color: {S["ink"]};">What changed</span><span>Title names what\'s lost</span><span>Consequences before the button</span><span>No "Are you sure"</span></div></div>', pad=20)}
</div>'''
    body = page_head("Profile and voice", "Northwind's taste, in settings a generator can follow and a reviewer can check.", f'{btn("Discard draft", "ghost")}{btn("Save draft", "primary")}', meta=f'{tag("Draft · 3 changes", "signal")}<span style="font-size: 13px; color: {S["muted"]};">Live since Release 13</span>') + f'<div style="padding: 20px 32px; display: flex; gap: 24px;">{left}{right}</div>'
    return app("Profile and voice", "Profile and voice", ["Northwind", "Direction", "Profile and voice"], body)


RULES = [
    ("Destructive actions name what is lost", "Designer", "Error", 97.8, "Priya", True),
    ("One primary action per view", "Polyxd", "Error", 99.4, "—", True),
    ("Amounts are the largest text on a payment", "Designer", "Warning", 91.2, "Maya", True),
    ("Tables over 8 rows get search", "Pattern", "Warning", 88.5, "Jonas", True),
    ("Never ask \"Are you sure\"", "Voice", "Warning", 96.1, "Maya", True),
    ("Status colour always has a label", "Accessibility", "Error", 100.0, "—", True),
    ("Empty states offer the next step", "Designer", "Warning", 72.4, "Tom", False),
]


def rules(overlay=""):
    rows = []
    for n, src, sev, pr, owner, on in RULES:
        tone = "ok" if pr >= 95 else ("warn" if pr >= 85 else "bad")
        rows.append([
            f'<a href="#" style="font-weight: 600; color: {S["ink"]};">{n}</a>',
            tag(src, "signal" if src == "Designer" else "gray"),
            tag(sev, "bad" if sev == "Error" else "warn"),
            f'<span style="display: inline-flex; gap: 8px; align-items: center;">{meter(pr, tone, 80)}<span style="font-variant-numeric: tabular-nums; font-size: 13px;">{pr:.1f}%</span></span>',
            owner,
            f'<span style="display: inline-flex; gap: 8px; align-items: center;">{switch(on, "Enforce " + n)}</span>',
            btn("Actions for " + n, "ghost", "dots_h", h=28, only_icon=True),
        ])
    body = page_head("Rules", "What every generated screen has to follow. Each rule is checked on every screen, and its pass rate is from the last 10,000.", btn("New rule", "primary", "plus"), tabs_html=tabs([("All", 24), ("Yours", 11), ("From patterns", 9), ("Accessibility", 4)], "All")) + f'''<div style="padding: 16px 32px; display: flex; flex-direction: column; gap: 12px;">
<div style="display: flex; gap: 8px; align-items: center;">{search("Search rules", 260)}{filter_chip("Errors", False, 9)}{filter_chip("Warnings", False, 15)}{filter_chip("Below 90%", False, 3)}</div>
{table(["Rule", "Source", "Severity", "Passing", "Owner", "On", ""], rows, aligns=["left", "left", "left", "left", "left", "left", "right"], widths=[None, 130, 110, 170, 100, 70, 50], caption="Rules")}
{notice("Suggested from reviews: “Show what’s left in the budget”", "Reviewers asked for it on 6 spending screens this week. Turn it into a rule?", "signal", f'{btn("Dismiss", "ghost", h=32)}{btn("Review suggestion", "secondary", h=32)}')}
</div>'''
    return app("Rules", "Rules", ["Northwind", "Direction", "Rules"], body, overlay=overlay)


def rules_undo():
    return rules(toast("Deleted the rule \"Tables over 8 rows get search\"."))


def rule_edit():
    cond = f'''<div style="display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 10px; background: {S["sunk"]}; border: 1px solid {S["line"]}; font-size: 14px;">
<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;"><strong>When</strong><select aria-label="Component" style="height: 32px; border: 1px solid {S["line"]}; border-radius: 6px; padding: 0 8px; font-family: {BODY}; font-size: 13px;"><option>Confirm</option></select><span>has</span><select aria-label="Property" style="height: 32px; border: 1px solid {S["line"]}; border-radius: 6px; padding: 0 8px; font-family: {BODY}; font-size: 13px;"><option>severity</option></select><span>=</span><select aria-label="Value" style="height: 32px; border: 1px solid {S["line"]}; border-radius: 6px; padding: 0 8px; font-family: {BODY}; font-size: 13px;"><option>destructive</option></select></div>
<div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;"><strong>it must</strong><select aria-label="Check" style="height: 32px; border: 1px solid {S["line"]}; border-radius: 6px; padding: 0 8px; font-family: {BODY}; font-size: 13px;"><option>name the thing in its title</option></select><span>and</span><select aria-label="Check" style="height: 32px; border: 1px solid {S["line"]}; border-radius: 6px; padding: 0 8px; font-family: {BODY}; font-size: 13px;"><option>list what is lost before the button</option></select></div>
{btn("Add a condition", "ghost", "plus", h=28)}
</div>'''
    fails = "".join(
        f'<li style="display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid {S["soft"]};">{dot("bad")}<div style="flex-grow: 1;"><div style="font-size: 13px; font-weight: 500;">{t}</div><div style="font-size: 12px; color: {S["muted"]};">{why}</div></div><a href="#" style="font-size: 13px;">Open</a></li>'
        for t, why in [("\"Delete item?\" on projects.delete", "Title doesn't name the project"), ("\"Remove Dan?\" on members.remove", "Nothing about what Dan loses access to"), ("\"Cancel subscription?\" on subscriptions.cancel", "No end date before the button")]
    )
    left = f'''<div style="width: 620px; flex-shrink: 0; display: flex; flex-direction: column; gap: 18px;">
{field("Rule", "Destructive actions name what is lost", "rule-name")}
{textarea("Why", "People confirm what they can see. A title that names the account and a list of what goes with it stops the wrong thing being deleted.", "why", 64, help_text="Shown to reviewers, and to generators as guidance.")}
<div style="display: flex; flex-direction: column; gap: 8px;">{label("Check")}{cond}</div>
<div style="display: flex; gap: 16px;">{select("Severity", "Error: the screen isn't shown", "sev", w=300)}{select("Applies to", "Every intent", "scope", w=300)}</div>
</div>'''
    right = card(h2("Tested against the last 500 screens", None, btn("Run again", "ghost", "repeat", h=28)) + f'''<div style="display: flex; gap: 24px;"><div><div style="font-family: {DISPLAY}; font-size: 28px; font-weight: 400;">23</div><div style="font-size: 12px; color: {S["muted"]};">would fail</div></div><div><div style="font-family: {DISPLAY}; font-size: 28px; font-weight: 400;">4</div><div style="font-size: 12px; color: {S["muted"]};">intents affected</div></div></div>
<ul style="list-style: none; margin: 0; padding: 0;">{fails}</ul><a href="#" style="font-size: 13px; font-weight: 500;">See all 23</a>''', pad=20, gap=12, extra="flex-grow: 1;")
    body = page_head("Edit rule", None, f'{btn("Delete rule", "danger_ghost", "trash")}{btn("Cancel", "ghost")}{btn("Save rule", "primary")}') + f'<div style="padding: 16px 32px; display: flex; gap: 28px; align-items: flex-start;">{left}{right}</div>'
    return app("Edit rule", "Rules", ["Northwind", "Rules", "Destructive actions name what is lost"], body)


def exemplars():
    tiles = ""
    for kind, pack, t, intent, desk in [("send", "northwind", "Send money: amount first", "transfer.create", False), ("plans", "northwind", "One recommendation", "plans.compare", False), ("delete", "northwind", "Typed check for high risk", "account.delete", False), ("table", "northwind", "Dense list with bulk action", "accounts.list", True), ("plans", "northwind", "Plans side by side", "plans.compare", True)]:
        preview = mini_desktop(kind, pack, 480, 280) if desk else mini_surface(kind, pack, 240, 440)
        tiles += f'<div style="display: flex; flex-direction: column; gap: 10px;">{preview}<div><div style="font-weight: 600; font-size: 14px;">{t}</div><div style="display: flex; gap: 6px; margin-top: 4px;">{tag(intent, "gray", mono=True)}{tag("Desktop" if desk else "Phone", "gray")}</div></div></div>'
    body = page_head("Exemplars", "Screens that show what good looks like. Generators get the closest ones as examples; reviewers compare against them.", f'{btn("Upload a design", "secondary", "upload")}{btn("Add from reviews", "primary", "plus")}', tabs_html=tabs([("All", 38), ("Payments", 9), ("Settings", 7), ("Lists and records", 12)], "All")) + f'<div style="padding: 20px 32px; display: flex; gap: 24px; flex-wrap: wrap;">{tiles}</div>'
    return app("Exemplars", "Exemplars", ["Northwind", "Direction", "Exemplars"], body)


# ---------------------------------------------------------------- reviews

def reviews():
    rows = []
    for t, intent, score, why, who, kind in [
        ("send Alex £40 for the concert tickets", "transfer.create", 96, "New intent", "Maya", "send"),
        ("where's my order??", "orders.status", 58, "Low score", "—", "blank"),
        ("which plan should I get? I mostly need storage", "plans.compare", 92, "Sampled", "Jonas", "plans"),
        ("delete my account", "account.delete", 100, "High risk", "Priya", "delete"),
        ("show me accounts that are past due", "accounts.list", 88, "Sampled", "—", "table"),
    ]:
        thumb = f'<span style="display: inline-flex; width: 36px; height: 48px; border-radius: 6px; border: 1px solid {S["line"]}; background: {S["sunk"]}; flex-shrink: 0;"></span>'
        tone = "ok" if score >= 90 else ("warn" if score >= 70 else "bad")
        rows.append([
            f'<span style="display: inline-flex; gap: 12px; align-items: center;">{thumb}<span style="display: flex; flex-direction: column;"><a href="#" style="font-weight: 600; color: {S["ink"]};">“{t}”</a>{mono(intent, 12)}</span></span>',
            f'<span style="font-weight: 600; color: {TONE[tone][1]}; font-variant-numeric: tabular-nums;">{score}</span>',
            tag(why, {"New intent": "info", "Low score": "bad", "Sampled": "gray", "High risk": "warn"}[why]),
            who,
            btn("Review", "secondary", h=30),
        ])
    body = page_head("Reviews", "Generated screens picked for a designer to look at. What you approve becomes exemplars; what you flag becomes rules.", btn("Review settings", "secondary", "gear"), tabs_html=tabs([("To review", 18), ("Ranking", 4), ("Approved", 312), ("Changes asked", 27)], "To review")) + f'''<div style="padding: 16px 32px; display: flex; flex-direction: column; gap: 12px;">
<div style="display: flex; gap: 8px; align-items: center;">{search("Search requests", 260)}{filter_chip("Assigned to me", True, 6)}{filter_chip("High risk", False, 3)}{filter_chip("Low score", False, 5)}{filter_chip("New intents", False, 4)}</div>
{table(["Request", "Score", "Why it's here", "Assigned", ""], rows, aligns=["left", "right", "left", "left", "right"], widths=[None, 80, 150, 110, 100], row_h=64, caption="Screens to review")}
</div>'''
    return app("Reviews", "Reviews", ["Northwind", "Reviews"], body)


def review_surface():
    findings = "".join(
        f'<li style="display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid {S["soft"]};">{dot(t)}<div style="font-size: 13px; line-height: 18px;"><div style="font-weight: 600;">{a}</div><div style="color: {S["muted"]};">{b}</div></div></li>'
        for t, a, b in [("ok", "Accessibility", "0 issues in light and dark, 390 and 1100 px"), ("ok", "Agent task", "Sent £40 to Alex by name in 2 steps"), ("warn", "Rule: amounts are the largest text", "£40.00 is 34px; the title is 17px. Passes."), ("gray", "Closest exemplar", "Send money: amount first · 91% similar")]
    )
    left = f'''<aside aria-label="Request" style="width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px;">
{card(f'<span style="font-size: 12px; color: {S["muted"]};">Request</span><p style="margin: 0; font-family: {DISPLAY}; font-size: 20px; line-height: 26px; font-weight: 400;">“send Alex £40 for the concert tickets”</p><div style="display: flex; gap: 6px; flex-wrap: wrap;">{tag("transfer.create", "gray", True)}{tag("New intent", "info")}</div>', pad=18)}
{card(h2("Data it was given") + f'<pre style="margin: 0; font-family: {MONO}; font-size: 12px; line-height: 18px; color: {S["ink2"]}; white-space: pre-wrap;">{{ "payee": {{ "name": "Alex Kim" }},\n  "amount": 40, "currency": "GBP",\n  "from": "Everyday ····4521" }}</pre>', pad=18, gap=8)}
{card(h2("Checks") + f'<ul style="list-style: none; margin: 0; padding: 0;">{findings}</ul>', pad=18, gap=4)}
</aside>'''
    center = f'''<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; gap: 12px; padding-top: 8px;">
<div style="display: flex; gap: 8px;">{segmented(["Phone", "Desktop"], "Phone", "Width")}{segmented(["Light", "Dark"], "Light", "Mode")}</div>
<div style="position: relative;">{mini_surface("send", "northwind", 340, 600)}
<span aria-label="Comment 1" style="position: absolute; left: 150px; top: 76px; width: 26px; height: 26px; border-radius: 50% 50% 50% 4px; background: {S["signal_ink"]}; color: #FFFFFF; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center;">1</span></div>
</div>'''
    right = f'''<aside aria-label="Your verdict" style="width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 14px;">
{card(h2("Comment 1") + f'<p style="margin: 0; font-size: 14px;">Say who it\'s to before how much. The design leads with Alex, then the amount.</p><div style="display: flex; gap: 8px;">{btn("Make it a rule", "secondary", "wand", h=30)}{btn("Resolve", "ghost", h=30)}</div>', pad=18, gap=10)}
{textarea("Add a comment", "", "comment", 70)}
<div style="display: flex; flex-direction: column; gap: 8px; margin-top: auto;">
{btn("Approve", "primary", "check", w=340)}
{btn("Ask for changes", "secondary", w=340)}
{btn("Save as an exemplar", "ghost", "image", w=340)}
</div>
<div style="display: flex; justify-content: space-between; font-size: 12px; color: {S["muted"]};"><span>3 of 18</span><span>{kbd("A")} approve · {kbd("C")} changes · {kbd("J")} next</span></div>
</aside>'''
    body = f'<div style="padding: 20px 32px; display: flex; gap: 24px; flex-grow: 1; min-height: 0;">{left}{center}{right}</div>'
    return app("Review a screen", "Reviews", ["Northwind", "Reviews", "send Alex £40…"], body, top_actions=f'{btn("Previous", "ghost", "chev_l", h=32, only_icon=True)}{btn("Next", "ghost", "chev_r", h=32, only_icon=True)}')


def review_rank():
    opts = ""
    for i, (kind, letter, rank) in enumerate([("plans", "A", 1), ("plans", "B", 3), ("plans", "C", 2)]):
        on = rank == 1
        opts += f'''<div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
<div style="border-radius: 16px; padding: 6px; border: {"2px solid " + S["ink"] if on else "2px solid transparent"};">{mini_surface(kind, "northwind", 300, 440)}</div>
<div style="display: flex; gap: 8px; align-items: center;"><strong>Option {letter}</strong>{"".join(f'<button type="button" aria-pressed="{"true" if n == rank else "false"}" aria-label="Rank option {letter} {n}" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid {S["ink"] if n == rank else S["line"]}; background: {S["ink"] if n == rank else S["paper"]}; color: {"#FFFFFF" if n == rank else S["ink"]}; font-family: {BODY}; font-weight: 600;">{n}</button>' for n in (1, 2, 3))}</div>
</div>'''
    body = page_head("Rank three options", "“which plan should I get? I mostly need storage” · plans.compare. Best first. The winner becomes an exemplar, and rankings over time show how well your generator is doing.", f'{btn("Skip", "ghost")}{btn("Save ranking", "primary")}', tabs_html="") + f'''<div style="padding: 8px 32px; display: flex; flex-direction: column; gap: 16px;">
<div style="display: flex; gap: 28px; justify-content: center;">{opts}</div>
<div style="display: flex; gap: 16px; justify-content: center; align-items: center;">{checkbox(False, "", "B and C are about the same")}<span style="font-size: 13px; color: {S["muted"]};">Options are shuffled, so nothing hints which came from where.</span></div>
</div>'''
    return app("Rank options", "Reviews", ["Northwind", "Reviews", "Ranking"], body)


def review_rule():
    body = f'''<p style="margin: 0; font-size: 14px; color: {S["ink2"]};">From your comment on 1 screen, and 5 similar comments this month.</p>
{field("Rule", "Say who a payment is to before how much", "sugg")}
<div style="padding: 12px 14px; border-radius: 10px; background: {S["sunk"]}; border: 1px solid {S["line"]}; font-size: 14px;"><strong>When</strong> a screen sends money, <strong>the</strong> recipient <strong>comes before</strong> the amount.</div>
<div style="display: flex; gap: 20px; font-size: 13px;"><span><strong>41</strong> of the last 500 payment screens would fail</span><a href="#">See them</a></div>
{select("Severity", "Warning: shown, and flagged for review", "sev2")}'''
    return with_overlay(review_surface(), drawer("Turn this into a rule", body, f'{btn("Cancel", "ghost")}{btn("Create rule", "primary")}', w=500))


# ---------------------------------------------------------------- product: capabilities and journeys

def capabilities(overlay=""):
    rows = [[mono(n, 13, S["ink"]), d, tag(r, {"None": "gray", "Low": "info", "Medium": "warn", "High": "bad", "Destructive": "bad"}[r]), c, u, btn("Edit " + n, "ghost", "edit", h=28, only_icon=True)]
            for n, d, r, c, u in [
                ("transfer.confirm", "Send money that was reviewed", "High", "Review screen", "6 intents"),
                ("account.delete", "Delete the customer's account", "Destructive", "Typed check", "1 intent"),
                ("subscription.cancel", "Cancel a customer's plan", "High", "Review screen", "2 intents"),
                ("invoice.remind", "Email a payment reminder", "Medium", "Confirm", "3 intents"),
                ("task.create", "Add a task", "Low", "None", "4 intents"),
                ("orders.track", "Open tracking for an order", "None", "None", "2 intents"),
            ]]
    body = page_head("Capabilities", "What generated screens are allowed to make happen. Risk decides what a screen must show before the action runs.", btn("New capability", "primary", "plus"), tabs_html=tabs([("All", 12), ("Needs a risk level", 3)], "All")) + f'''<div style="padding: 16px 32px; display: flex; flex-direction: column; gap: 12px;">
{notice("3 capabilities have no risk level yet", "Screens can't use them until they do. Engineering added them from the API on Tuesday.", "warn", btn("Set risk levels", "secondary", h=32))}
{table(["Capability", "What it does", "Risk", "Screen must show", "Used by", ""], rows, aligns=["left", "left", "left", "left", "left", "right"], widths=[200, None, 130, 150, 110, 50], caption="Capabilities")}
</div>'''
    return app("Capabilities", "Capabilities", ["Northwind", "Product", "Capabilities"], body, overlay=overlay)


def capability_edit():
    risks = "".join(radio(n == "High", n, "risk", sub) for n, sub in [("None", "Opens or shows something"), ("Low", "Easy to undo"), ("Medium", "Visible to others, or hard to undo"), ("High", "Money moves, or access changes"), ("Destructive", "Can't be undone")])
    body = f'''{field("Name", "subscription.cancel", "cap-name", mono=True, help_text="From Northwind's API. Engineering owns the name.")}
{field("What it does", "Cancel a customer's plan at the end of the billing period", "cap-desc")}
<fieldset style="border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;"><legend style="font-size: 13px; font-weight: 500; margin-bottom: 8px;">Risk</legend>{risks}</fieldset>
{notice("High risk: a review screen is required", "Screens must show the plan, when access ends and what the customer keeps, on the same screen as the button.", "gray")}
{select("Inputs", "customerId, endOfPeriod (yes or no)", "inputs", mono=True)}'''
    return capabilities(drawer("Edit capability", body, f'{btn("Cancel", "ghost")}{btn("Save", "primary")}', w=520))


def journeys():
    rows = [[f'<a href="#" style="font-weight: 600; color: {S["ink"]};">{n}</a>', g, f'<span style="display: inline-flex; gap: 8px; align-items: center;">{meter(c, "ok" if c > 80 else "warn", 80)}<span style="font-size: 13px;">{c}%</span></span>', f'<span style="display: inline-flex; gap: 8px; align-items: center;">{meter(a, "ok" if a > 80 else "warn", 80)}<span style="font-size: 13px;">{a}%</span></span>', s]
            for n, g, c, a, s in [("Pay a bill", "The bill is paid and the person has a receipt", 91, 88, "4 steps"), ("Cancel a subscription", "Cancelled, with the end date confirmed", 74, 92, "3 steps"), ("Invite a teammate", "Invite sent with the right role", 95, 97, "2 steps"), ("Find a meeting time", "Invite sent for a time everyone's free", 68, 71, "3 steps")]]
    body = page_head("Journeys", "Goals people come to do. Each has a done event, so Studio knows whether generated screens got them there, for people and for agents.", btn("New journey", "primary", "plus")) + f'<div style="padding: 16px 32px;">{table(["Journey", "Done when", "People finish", "Agents finish", "Checkpoints"], rows, widths=[220, None, 170, 170, 120], caption="Journeys")}</div>'
    return app("Journeys", "Journeys", ["Northwind", "Product", "Journeys"], body)


def journey_edit():
    steps = "".join(
        f'<li style="display: flex; gap: 12px; align-items: center; padding: 12px 14px; border: 1px solid {S["line"]}; border-radius: 10px; background: {S["paper"]};"><span style="display: flex; color: {S["muted"]};">{ic("drag", 16)}</span><span style="width: 24px; height: 24px; border-radius: 50%; background: {S["soft"]}; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center;">{i + 1}</span><div style="flex-grow: 1;"><div style="font-weight: 600; font-size: 14px;">{t}</div><div style="font-size: 12px; color: {S["muted"]};">{sub}</div></div>{mono(ev, 12)}{btn("Edit checkpoint " + t, "ghost", "edit", h=28, only_icon=True)}</li>'
        for i, (t, sub, ev) in enumerate([("See the plan and what cancelling means", "Plan, end date and what they keep are visible", "subscription.viewed"), ("Choose when it ends", "End of period is the default", "subscription.end_chosen"), ("Confirm", "The done event", "subscription.cancel")])
    )
    left = f'''<div style="width: 620px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px;">
{field("Journey", "Cancel a subscription", "j-name")}
{field("Goal", "The subscription is cancelled and the customer knows when access ends", "j-goal")}
<div style="display: flex; flex-direction: column; gap: 8px;">{label("Checkpoints")}<ol style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px;">{steps}</ol>{btn("Add a checkpoint", "ghost", "plus", h=30)}</div>
{textarea("Acceptance", "Shows the end date before the button.\\nOffers to keep the plan without guilt-tripping.", "accept", 64)}
</div>'''
    right = card(h2("Agent test", "Run by the verifier on every release.") + f'''<pre style="margin: 0; padding: 12px; border-radius: 8px; background: {S["night"]}; color: {S["night_text"]}; font-family: {MONO}; font-size: 12px; line-height: 19px; white-space: pre-wrap;">press   "Cancel subscription"
choose  "At the end of the billing period"
press   "Cancel Acme's plan"
expect  subscription.cancel
        {{ endOfPeriod: true }}</pre><div style="display: flex; gap: 8px; align-items: center; font-size: 13px;">{ic("check_circle", 16, S["ok"])}Passed in 13 of 13 design systems</div>''', pad=20, gap=12, extra="flex-grow: 1;")
    body = page_head("Edit journey", None, f'{btn("Delete journey", "danger_ghost", "trash")}{btn("Cancel", "ghost")}{btn("Save", "primary")}') + f'<div style="padding: 16px 32px; display: flex; gap: 28px; align-items: flex-start;">{left}{right}</div>'
    return app("Edit journey", "Journeys", ["Northwind", "Journeys", "Cancel a subscription"], body)


def flow_map():
    nodes = [(80, 180, "Request", "“cancel Acme…”", 1000), (330, 90, "Review screen", "subscription.review", 820), (330, 280, "Account record", "accounts.open", 180), (600, 90, "Choose end date", "", 760), (870, 90, "Done", "subscription.cancel", 700), (600, 280, "Left", "no done event", 240)]
    svg_edges = ""
    for (x1, y1), (x2, y2), wdt, col in [((230, 205), (330, 115), 14, S["ink2"]), ((230, 215), (330, 305), 5, S["line"]), ((480, 115), (600, 115), 13, S["ink2"]), ((480, 305), (600, 305), 4, S["bad"]), ((750, 115), (870, 115), 12, S["ok"]), ((480, 130), (600, 290), 3, S["bad"])]:
        svg_edges += f'<path d="M{x1} {y1} C {(x1 + x2) / 2} {y1}, {(x1 + x2) / 2} {y2}, {x2} {y2}" fill="none" stroke="{col}" stroke-width="{wdt}" stroke-opacity=".55"/>'
    boxes = "".join(
        f'<div style="position: absolute; left: {x}px; top: {y}px; width: 150px; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; background: {S["paper"]}; border: 1px solid {S["bad"] if t == "Left" else S["line"]}; box-shadow: 0 1px 2px rgba(20,20,20,.06);"><div style="font-weight: 600; font-size: 13px;">{t}</div><div style="font-size: 11px; color: {S["muted"]}; font-family: {MONO};">{s}</div><div style="font-size: 12px; margin-top: 4px;">{n:,}</div></div>'
        for x, y, t, s, n in nodes
    )
    canvas = f'<div style="position: relative; height: 420px; border: 1px solid {S["line"]}; border-radius: 12px; background: {S["sunk"]}; overflow: hidden;"><svg width="1100" height="420" aria-hidden="true" style="position: absolute; inset: 0;">{svg_edges}</svg>{boxes}</div>'
    body = page_head("Cancel a subscription: paths people took", "Last 30 days · 1,000 journeys. Screens are generated, so the paths are whatever people actually did.", f'{segmented(["People", "Agents"], "People", "Who")}{btn("Last 30 days", "secondary", "calendar")}', tabs_html=tabs(["Flow map", "Screens", "Drop-offs"], "Flow map")) + f'''<div style="padding: 16px 32px; display: flex; flex-direction: column; gap: 14px;">{canvas}
{notice("24% leave after the account record", "They open Acme's record, not a review screen, and there is no cancel action on it. Add subscription.cancel to the record's allowed actions?", "warn", btn("Open the record's screens", "secondary", h=32))}</div>'''
    return app("Flow map", "Journeys", ["Northwind", "Journeys", "Cancel a subscription"], body)


# ---------------------------------------------------------------- releases

def release_new():
    changes = "".join(
        f'<li style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid {S["soft"]};"><span style="display: flex; color: {S["muted"]}; padding-top: 2px;">{ic(i, 18)}</span><div style="flex-grow: 1;"><div style="font-weight: 600; font-size: 14px;">{t}</div><div style="font-size: 13px; color: {S["muted"]};">{d}</div></div>{tag(k, tone)}</li>'
        for i, t, d, k, tone in [
            ("palette", "Northwind tokens", "color.action.primary brand/600 → brand/700 · color.focus.ring brand/400 → brand/300", "2 changed", "info"),
            ("rule", "Rules", "Added: Say who a payment is to before how much", "1 added", "ok"),
            ("blocks", "Components", "Choice now rendered with @northwind/ui Select", "1 connected", "info"),
            ("compass", "Voice", "Tone moved towards casual; 1 word added", "2 changed", "info"),
        ]
    )
    checks = "".join(f'<li style="display: flex; gap: 10px; align-items: center; padding: 6px 0; font-size: 14px;">{ic(i, 18, TONE[t][1])}{txt}</li>' for i, t, txt in [("check_circle", "ok", "Contract and contrast pass in light and dark"), ("check_circle", "ok", "500 recent screens redrawn: 0 accessibility regressions"), ("check_circle", "ok", "Agent tasks: 37 of 37 journeys still complete"), ("alert", "warn", "41 payment screens change order: recipient now first")])
    body = page_head("Release 15", "Everything in draft, checked together before any customer sees it.", f'{btn("Save for later", "ghost")}{btn("Choose rollout", "primary", trail_icon="arrow_r")}', meta=tag("Draft", "signal")) + f'''<div style="padding: 20px 32px; display: flex; gap: 24px; align-items: flex-start;">
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 18px;">{card(h2("What changes") + f'<ul style="list-style: none; margin: 0; padding: 0;">{changes}</ul>', pad=20, gap=4)}
{card(h2("Before and after", "The same request, redrawn at both widths.", segmented(["Phone", "Desktop"], "Desktop", "Width")) + f'<div style="display: flex; gap: 16px; flex-wrap: wrap;">{mini_desktop("send", "northwind", 330, 230, "Live · Release 14")}{mini_desktop("send", "northwind", 330, 230, "Release 15")}</div>', pad=20)}</div>
<div style="width: 400px; flex-shrink: 0;">{card(h2("Checks") + f'<ul style="list-style: none; margin: 0; padding: 0;">{checks}</ul>' + f'<div style="font-size: 13px; color: {S["muted"]}; border-top: 1px solid {S["soft"]}; padding-top: 12px;">Affects about 3,100 screens a day, 6% of Northwind\'s traffic.</div>', pad=20, gap=8)}</div>
</div>'''
    return app("New release", "Releases", ["Northwind", "Releases", "Release 15"], body)


def release_rollout():
    body = f'''<fieldset style="border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px;"><legend style="font-size: 13px; font-weight: 500; margin-bottom: 8px;">How fast</legend>
{radio(True, "Gradually: 10%, then 50%, then everyone", "speed", "Moves on after 24 hours at each step if the guardrails hold")}
{radio(False, "Everyone now", "speed", "For fixes")}
{radio(False, "Only for an experiment", "speed", "Compare against Release 14 with your feature flags")}</fieldset>
<div style="display: flex; flex-direction: column; gap: 10px;"><strong style="font-size: 13px;">Stop and roll back if</strong>
{"".join(f'<div style="display: flex; gap: 10px; align-items: center; font-size: 14px;">{checkbox(True, t)}<span>{t}</span></div>' for t in ["Agent task success falls by more than 3%", "Accessibility checks passed falls below 99%", "People finishing a journey falls by more than 5%"])}</div>
{select("Starts", "Now", "start")}
{notice("Maya and Jonas will be told at each step", "And the release pauses itself if a guardrail trips.", "gray")}'''
    return with_overlay(release_new(), drawer("Roll out Release 15", body, f'{btn("Back", "ghost")}{btn("Start rollout", "accent", "rocket")}', w=520))


def releases(overlay=""):
    rows = [[f'<a href="#" style="font-weight: 600; color: {S["ink"]};">Release {n}</a>', s, d, who, when, btn("Actions for Release " + str(n), "ghost", "dots_h", h=28, only_icon=True)]
            for n, s, d, who, when in [
                (15, tag("Rolling out · 10%", "info"), "Tokens, 1 rule, Choice connected, voice", "Maya", "Today"),
                (14, tag("Paused · 50%", "warn"), "Denser tables, new empty states", "Jonas", "3 days ago"),
                (13, tag("Live · 100%", "ok"), "Voice principles, 4 rules", "Maya", "2 weeks ago"),
                (12, tag("Rolled back", "gray"), "Compact density by default", "Priya", "3 weeks ago"),
            ]]
    body = page_head("Releases", "Every change to tokens, components, direction and rules goes out as a release, gradually, with a way back.", btn("New release", "primary", "plus")) + f'''<div style="padding: 16px 32px; display: flex; flex-direction: column; gap: 14px;">
{notice("Release 14 paused itself at 50%", "Agent task success fell 6% on accounts.list. Tables got denser and the search moved into a menu.", "bad", f'{btn("Roll back", "secondary", h=32)}{btn("See what failed", "ghost", h=32)}')}
{table(["Release", "Status", "What changed", "By", "Started", ""], rows, widths=[140, 180, None, 100, 140, 50], caption="Releases")}
</div>'''
    return app("Releases", "Releases", ["Northwind", "Releases"], body, overlay=overlay)


def release_rollback():
    body = f'''<p style="margin: 0; font-size: 14px; color: {S["ink2"]};">Screens go back to Release 13 for everyone within a minute. Release 14 stays here, so you can fix it and roll out again.</p>
<ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 22px; color: {S["ink2"]};"><li>Tables return to default density</li><li>The 2 new empty states go back to the old ones</li></ul>'''
    return releases(dialog("Roll back Release 14?", body, f'{btn("Keep it paused", "secondary")}{btn("Roll back", "primary", "undo")}', w=480))


# ---------------------------------------------------------------- insights

def insights():
    trend = [84, 85, 85, 87, 86, 88, 88, 89, 90, 89, 91, 91]
    w, h = 520, 180
    step = w / (len(trend) - 1)
    pts = " ".join(f"{i * step:.1f},{h - (v - 80) / 14 * h:.1f}" for i, v in enumerate(trend))
    chart = f'<svg width="{w}" height="{h + 24}" viewBox="0 0 {w} {h + 24}" role="img" aria-label="Verifier score by week, from 84 to 91"><g stroke="{S["soft"]}">{"".join(f"<line x1=\"0\" x2=\"{w}\" y1=\"{y}\" y2=\"{y}\"/>" for y in (0, 60, 120, 180))}</g><polyline points="{pts}" fill="none" stroke="{S["signal"]}" stroke-width="2.5" stroke-linejoin="round"/>{"".join(f"<text x=\"{i * step:.0f}\" y=\"{h + 18}\" font-size=\"11\" fill=\"{S['muted']}\" font-family=\"Hanken Grotesk, sans-serif\" text-anchor=\"middle\">W{i + 27}</text>" for i in range(0, 12, 2))}</svg>'
    failing = table(["Check", "Screens", "Trend"], [[mono(c, 12, S["ink"]), f"{n:,}", tag(t, tone)] for c, n, t, tone in [("data:missing-path", 412, "−38%", "ok"), ("copy:raw-identifier", 288, "−12%", "ok"), ("layout:target-size-pack", 164, "+4%", "warn"), ("rule:amount-largest", 91, "new", "gray")]], aligns=["left", "right", "right"], widths=[None, 70, 70], row_h=42, pad_x=0)
    unmet = "".join(f'<li style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid {S["soft"]}; font-size: 14px;"><span>“{r}”</span><span style="color: {S["muted"]};">{n} asks</span></li>' for r, n in [("split this bill with Sam", 212), ("export this as a PDF", 164), ("undo my last payment", 97), ("show my invoices by client", 81)])
    stats = f'''<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;">{stat("Screens generated", "212k", "30 days")}{stat("Verifier score", "91", "+7 since W27", "ok")}{stat("Journeys finished", "84%", "+3%", "ok")}{stat("Asked for, not possible", "1,410", "requests", "warn")}</div>'''
    body = page_head("Insights", "How generated screens are doing, what fails most, and what people ask for that the product can't do yet.", f'{btn("Last 12 weeks", "secondary", "calendar")}{btn("Export", "secondary", "download")}') + f'''<div style="padding: 20px 32px; display: flex; flex-direction: column; gap: 18px;">{stats}
<div style="display: flex; gap: 18px; align-items: flex-start;">{card(h2("Verifier score, weekly") + chart, pad=20, extra="flex-shrink: 0;")}{card(h2("Failing most", "Share of screens, 30 days") + failing, pad=20, gap=8, extra="flex-grow: 1;")}</div>
{card(h2("Asked for, not possible", "Requests no capability could answer. The product roadmap, written by your customers.", btn("Share with product", "secondary", "send", h=30)) + f'<ul style="list-style: none; margin: 0; padding: 0;">{unmet}</ul>', pad=20, gap=6)}
</div>'''
    return app("Insights", "Insights", ["Northwind", "Insights"], body)


# ---------------------------------------------------------------- settings

def settings_nav(active):
    return f'<nav aria-label="Settings" style="width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 2px;">{"".join(f"<a href=\"#\" style=\"padding: 8px 10px; border-radius: 8px; font-size: 14px; color: {S['ink']}; background: {S['soft'] if n == active else 'transparent'}; font-weight: {600 if n == active else 500};\">{n}</a>" for n in ["Workspace", "Team", "Integrations", "Generators", "Billing", "Audit log"])}</nav>'


def team(overlay=""):
    rows = [[f'<span style="display: inline-flex; gap: 10px; align-items: center;">{avatar(a, t, 30)}<span style="display: flex; flex-direction: column;"><span style="font-weight: 600;">{n}</span><span style="font-size: 12px; color: {S["muted"]};">{e}</span></span></span>',
             f'<select aria-label="Role for {n}" style="height: 32px; border: 1px solid {S["line"]}; border-radius: 6px; padding: 0 8px; font-family: {BODY}; font-size: 13px;"><option>{r}</option></select>', last, btn("Remove " + n, "ghost", "close", h=28, only_icon=True)]
            for a, t, n, e, r, last in [("MR", "info", "Maya Rao", "maya@northwind.io", "Owner", "Now"), ("JL", "ok", "Jonas Lind", "jonas@northwind.io", "Design system", "1 hour ago"), ("PK", "signal", "Priya Kaur", "priya@northwind.io", "Designer", "Yesterday"), ("TA", "gray", "Tom Adeyemi", "tom@northwind.io", "Engineer", "Yesterday"), ("SL", "warn", "Sam Lee", "sam@northwind.io", "Product", "4 days ago")]]
    roles = "".join(f'<li style="display: flex; flex-direction: column; padding: 8px 0; border-bottom: 1px solid {S["soft"]};"><strong style="font-size: 13px;">{r}</strong><span style="font-size: 12px; color: {S["muted"]};">{d}</span></li>' for r, d in [("Design system", "Tokens, components, rules, releases"), ("Designer", "Direction, reviews, exemplars"), ("Product", "Capabilities, journeys, insights"), ("Engineer", "Components, capabilities, integrations"), ("Viewer", "Everything, read only")])
    body = page_head("Settings", None, "", tabs_html="") + f'''<div style="padding: 8px 32px; display: flex; gap: 28px; align-items: flex-start;">{settings_nav("Team")}
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 14px;">{h2("Team", "5 people · 2 invites pending", btn("Invite people", "primary", "user_plus"))}
{table(["Person", "Role", "Last active", ""], rows, widths=[None, 180, 120, 50], row_h=56, caption="Team")}</div>
<aside style="width: 260px; flex-shrink: 0;">{card(h2("What roles can do") + f'<ul style="list-style: none; margin: 0; padding: 0;">{roles}</ul>', pad=18, gap=6)}</aside>
</div>'''
    return app("Team", "Settings", ["Northwind", "Settings", "Team"], body, overlay=overlay)


def team_invite():
    body = f'''{textarea("Email addresses", "ana@northwind.io, leo@northwind.io", "emails", 72, help_text="Separate with commas. People outside northwind.io need an owner to approve.")}
{select("Role", "Designer: direction, reviews, exemplars", "invite-role")}
{textarea("Message (optional)", "Joining to help review the new payment screens.", "msg", 64)}'''
    return team(drawer("Invite people", body, f'{btn("Cancel", "ghost")}{btn("Send 2 invites", "primary", "send")}', w=500))


def integrations():
    def row(icon_name, name, sub, state, action):
        return f'<li style="display: flex; gap: 14px; align-items: center; padding: 16px 0; border-bottom: 1px solid {S["soft"]};"><span style="width: 40px; height: 40px; border-radius: 10px; background: {S["soft"]}; display: inline-flex; align-items: center; justify-content: center;">{ic(icon_name, 20)}</span><div style="flex-grow: 1;"><div style="font-weight: 600;">{name}</div><div style="font-size: 13px; color: {S["muted"]};">{sub}</div></div>{state}{action}</li>'
    items = "".join([
        row("figma", "Figma", "Northwind Tokens · variables sync every hour", tag("Connected", "ok"), btn("Manage", "secondary", h=32)),
        row("github", "GitHub", "northwind/web · releases open a pull request with the new theme CSS", tag("Connected", "ok"), btn("Manage", "secondary", h=32)),
        row("flag", "Feature flags", "Gradual rollouts and experiments through LaunchDarkly", tag("Connected", "ok"), btn("Manage", "secondary", h=32)),
        row("chart", "Analytics", "Send journey events to Amplitude", "", btn("Connect", "secondary", h=32)),
        row("key", "Your generator", "The model your product already uses writes the screens: Claude, GPT, Gemini, or your own. Polyxd checks what it writes.", tag("Claude · key saved", "gray"), btn("Manage", "secondary", h=32)),
    ])
    body = page_head("Settings", None, "") + f'''<div style="padding: 8px 32px; display: flex; gap: 28px; align-items: flex-start;">{settings_nav("Integrations")}
<div style="flex-grow: 1; max-width: 860px; display: flex; flex-direction: column; gap: 6px;">{h2("Integrations", "Where your tokens come from and where releases go.")}<ul style="list-style: none; margin: 0; padding: 0;">{items}</ul>
<p style="font-size: 13px; color: {S["muted"]}; margin: 12px 0 0;">Keys are stored encrypted and never shown again after saving. Studio doesn't send your data to any generator you haven't connected.</p></div>
</div>'''
    return app("Integrations", "Settings", ["Northwind", "Settings", "Integrations"], body)


def workspace_settings(overlay=""):
    danger = card(h2("Delete this workspace", "Removes design systems, direction, rules, reviews and release history for Northwind. Screens in production fall back to Polyxd's defaults.") + f'<div>{btn("Delete workspace", "danger", "trash")}</div>', pad=20, gap=12, extra=f"border-color: {S['bad']};")
    body = page_head("Settings", None, "") + f'''<div style="padding: 8px 32px; display: flex; gap: 28px; align-items: flex-start;">{settings_nav("Workspace")}
<div style="flex-grow: 1; max-width: 720px; display: flex; flex-direction: column; gap: 18px;">
{card(h2("Workspace") + field("Product name", "Northwind", "ws-name") + field("Address", "northwind", "ws-addr", prefix="studio.polyxd.com/") + f'<div>{btn("Save", "primary")}</div>', pad=20, gap=14)}
{card(h2("Export everything", "Design systems, direction, rules and reviews as files you own: DTCG tokens and Polyxd JSON.") + f'<div>{btn("Download export", "secondary", "download")}</div>', pad=20, gap=12)}
{danger}
</div></div>'''
    return app("Workspace settings", "Settings", ["Northwind", "Settings", "Workspace"], body, overlay=overlay)


def workspace_delete():
    body = f'''<p style="margin: 0; font-size: 14px; color: {S["ink2"]};">This can't be undone. You'll lose:</p>
<ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 22px; color: {S["ink2"]};"><li>2 design systems and 7 versions</li><li>24 rules, 38 exemplars and 312 reviews</li><li>15 releases; production falls back to Polyxd's defaults</li></ul>
{field("Type northwind to confirm", "", "ws-confirm", placeholder="northwind", mono=True)}'''
    return workspace_settings(dialog("Delete Northwind's workspace?", body, f'{btn("Cancel", "secondary")}{btn("Delete workspace", "danger")}', w=500))
