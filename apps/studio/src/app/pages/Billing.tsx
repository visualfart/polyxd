import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Billing as BillingInfo } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";

type Paid = "pro" | "team";
const NAMES = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise" } as const;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const count = (n: number | null, word: string) => (n === null ? `Unlimited ${word}s` : `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`);

/** What each plan gives, in the words of the plan table (docs/decisions/0004). */
const FEATURES: Record<"free" | Paid, string[]> = {
  free: ["2 editors", "1 design system and 1 Direction", "10 published screens", "10,000 fetches a month", "The last 10 versions of everything"],
  pro: ["1 editor, up to 3 workspaces", "Unlimited design systems, Directions and screens", "250,000 fetches a month", "Full version history", "Private packs and screens through the hosted MCP"],
  team: ["Unlimited editors and workspaces", "Everything in Pro", "1,000,000 fetches a month", "Approval before publish", "Shared libraries across workspaces"],
};

/** One line of usage: what, how much of how much, and a bar that turns amber at 80% and red once over. */
function Usage({ label, used, max, note }: { label: string; used: number; max: number | null; note?: string }) {
  const share = max ? used / max : 0;
  return (
    <li>
      <span style={{ flexGrow: 1 }}>
        <b className="small">{label}</b>
        {note && <div className="small muted">{note}</div>}
      </span>
      <span className="small num">{used.toLocaleString()}{max === null ? "" : ` of ${max.toLocaleString()}`}</span>
      {max === null ? <span className="small muted" style={{ width: 120, textAlign: "right" }}>no limit</span> : <span className={`meter ${share > 1 ? "bad" : share >= 0.8 ? "warn" : ""}`}><i style={{ width: `${Math.min(100, share * 100)}%` }} /></span>}
    </li>
  );
}

export function Billing({ ws }: { ws: Ws }) {
  const { toast } = useSession();
  const [params] = useSearchParams();
  const [b, setB] = useState<BillingInfo | { enabled: false } | null>(null);
  const [interval, setPayEvery] = useState<"month" | "year">("year");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<BillingInfo | { enabled: false }>("GET", `/api/w/${ws.slug}/billing`).then((r) => {
      setB(r);
      if (r.enabled && r.interval) setPayEvery(r.interval);
    });
  }, [ws.slug]);
  if (!b) return null;
  if (!b.enabled) return <Page crumbs={[ws.name, "Workspace", "Billing"]} title="Billing"><div className="empty"><h2>No plans here</h2><p>This Studio runs without plans or limits.</p></div></Page>;

  const go = async (path: string, payload?: unknown) => {
    setBusy(true);
    try {
      const r = await api<{ url: string }>("POST", `/api/w/${ws.slug}/billing/${path}`, payload);
      location.assign(r.url);
    } catch (e) {
      toast((e as Error).message, "bad");
      setBusy(false);
    }
  };
  const upgrade = (plan: Paid) => go("checkout", { plan, interval });
  const manage = () => go("portal");

  const u = b.usage;
  const seats = Math.max(1, u.editors);
  const price = (plan: Paid) => b.prices[plan][interval];
  const lede =
    b.plan === "free" ? `${ws.name} is on Free.`
    : `${ws.name} is on ${NAMES[b.plan]}${b.plan === "team" && b.seats ? `, ${b.seats} editor${b.seats === 1 ? "" : "s"}` : ""}${b.interval ? `, paid ${b.interval === "year" ? "yearly" : "monthly"}` : ""}.${b.periodEnd ? ` ${b.status === "canceled" ? "Ends" : "Renews"} ${date(b.periodEnd)}.` : ""}`;

  return (
    <Page crumbs={[ws.name, "Workspace", "Billing"]} title="Billing" lede={lede} actions={b.canManage && b.customer ? <button type="button" className="btn" onClick={manage} disabled={busy}>Manage billing</button> : undefined}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {params.get("upgraded") && <div className="notice ok"><div className="body"><b>Thanks, the payment went through.</b>Your plan changes here as soon as Stripe confirms it, usually within a minute.</div></div>}
        {b.locked ? (
          <div className="notice bad"><div className="body"><b>Editing is paused</b>{ws.name} has been over its monthly fetches since {date(b.overQuotaSince!)}. Products still get their screens, Directions and tokens. Upgrade to edit again.</div></div>
        ) : b.overQuotaSince ? (
          <div className="notice warn"><div className="body"><b>Over this month's fetches</b>Nothing stops working. If {ws.name} is still over on {date(b.lockedFrom!)}, editing pauses until it upgrades; fetches carry on.</div></div>
        ) : b.fetchesPercent !== null && b.fetchesPercent >= 80 ? (
          <div className="notice warn"><div className="body"><b>{b.fetchesPercent}% of this month's fetches used</b>Going over never breaks a product. After 7 days over, editing pauses until the workspace upgrades.</div></div>
        ) : null}
        {b.status === "past_due" && <div className="notice bad"><div className="body"><b>The last payment didn't go through</b>Stripe will try again. {b.canManage ? "Check the card in Manage billing." : "Ask an owner to check the card."}</div></div>}

        <div className="card">
          <div><h2>This month</h2><p className="small">Viewers are always free; everyone else is an editor.</p></div>
          <ul className="list">
            <Usage label="Editors" used={u.editors} max={b.limits.editors} note={[u.pendingEditors ? `${u.pendingEditors} invited` : "", `${u.viewers} viewer${u.viewers === 1 ? "" : "s"}, free`].filter(Boolean).join(" · ")} />
            <Usage label="Design systems" used={u.designSystems} max={b.limits.designSystems} />
            <Usage label="Directions" used={u.directions} max={b.limits.directions} />
            <Usage label="Published screens" used={u.publishedScreens} max={b.limits.publishedScreens} />
            <Usage label="Fetches by key" used={u.fetches} max={b.limits.fetches} note="Screens, Directions and tokens fetched with an API key, counted hourly" />
          </ul>
        </div>

        {b.plan !== "enterprise" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div><h2 style={{ fontSize: 20 }}>Plans</h2>{b.founding && <p className="small muted">Founding offer: the first 100 paying workspaces pay half, for as long as they stay.</p>}</div>
              <div className="segmented" role="group" aria-label="Pay">
                <button type="button" aria-pressed={interval === "month"} onClick={() => setPayEvery("month")}>Monthly</button>
                <button type="button" aria-pressed={interval === "year"} onClick={() => setPayEvery("year")}>Yearly, 2 months free</button>
              </div>
            </div>
            <div className="grid-3">
              {(["free", "pro", "team"] as const).map((plan) => {
                const current = b.plan === plan;
                return (
                  <div key={plan} className="card" style={current ? { border: "2px solid var(--ink)", padding: 23 } : undefined}>
                    <div>
                      <h2>{NAMES[plan]}</h2>
                      <div className="stat"><span className="v">{plan === "free" ? "$0" : `$${price(plan)}`}</span><span className="small muted">{plan === "free" ? "for trying it and side projects" : `${plan === "team" ? "per editor, " : ""}a ${interval}${plan === "team" && seats > 1 ? ` · $${(price(plan) * seats).toLocaleString()} for your ${seats} editors` : ""}`}</span></div>
                    </div>
                    <ul className="list">{FEATURES[plan].map((f) => <li key={f} className="small" style={{ padding: "8px 0" }}>{f}</li>)}</ul>
                    <div style={{ marginTop: "auto" }}>
                      {current ? (
                        <span className="tag">Your plan</span>
                      ) : plan === "free" ? (
                        b.canManage && b.customer ? <button type="button" className="btn ghost" onClick={manage} disabled={busy}>Cancel in Manage billing</button> : null
                      ) : !b.canManage ? (
                        <span className="small muted">Only an owner can change the plan.</span>
                      ) : b.subscribed ? (
                        <button type="button" className="btn" onClick={manage} disabled={busy}>Switch in Manage billing</button>
                      ) : plan === "pro" && u.editors > 1 ? (
                        <span className="small muted">Pro is for one editor; {ws.name} has {u.editors}. Team fits.</span>
                      ) : !b.checkout ? (
                        <span className="small muted">Paying isn't set up on this Studio yet.</span>
                      ) : (
                        <button type="button" className="btn primary" onClick={() => upgrade(plan)} disabled={busy}>Upgrade to {NAMES[plan]}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="small muted">Enterprise: 10 million fetches or more, single sign-on, an audit log and an SLA, on a contract. Write to us from <a href="https://polyxd.com">polyxd.com</a>. Everything can be exported as JSON on every plan.</p>
          </div>
        )}
      </div>
    </Page>
  );
}
