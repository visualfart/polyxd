/**
 * Support, for whoever runs this Studio: find a workspace or a person, set a plan by hand, hand a
 * workspace to a new owner, take someone out, and read what Stripe says about a customer. Nothing
 * here writes to Stripe. Every change is recorded and shown at the bottom of the page.
 */
import { useEffect, useState } from "react";
import { api, type AdminDetail, type AdminOverview, type AdminUser, type AdminWorkspace } from "../api.ts";
import { Page, useSession } from "../App.tsx";

const PLANS = ["free", "pro", "team", "enterprise"] as const;
const NAMES = { free: "Free", pro: "Pro", team: "Team", enterprise: "Enterprise" } as const;
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const money = (cents: number, currency: string) => `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;

export function Admin() {
  const { toast } = useSession();
  const [tab, setTab] = useState<"workspaces" | "people" | "log">("workspaces");
  const [q, setQ] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [log, setLog] = useState<AdminOverview["actions"]>([]);
  const [open, setOpen] = useState<AdminDetail | null>(null);

  const loadOverview = () => api<AdminOverview>("GET", "/api/admin/overview").then(setOverview).catch(() => undefined);
  useEffect(() => {
    loadOverview();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      const search = encodeURIComponent(q);
      if (tab === "workspaces") api<{ workspaces: AdminWorkspace[] }>("GET", `/api/admin/workspaces?q=${search}`).then((r) => setWorkspaces(r.workspaces));
      if (tab === "people") api<{ users: AdminUser[] }>("GET", `/api/admin/users?q=${search}`).then((r) => setUsers(r.users));
      if (tab === "log") api<{ actions: AdminOverview["actions"] }>("GET", "/api/admin/log").then((r) => setLog(r.actions));
    }, 200);
    return () => clearTimeout(t);
  }, [q, tab]);

  const show = async (id: string) => setOpen(await api<AdminDetail>("GET", `/api/admin/workspaces/${id}`));
  const setPlan = async (id: string, plan: string, note: string) => {
    const r = await api<{ subscribed: boolean }>("POST", `/api/admin/workspaces/${id}/plan`, { plan, note });
    toast(r.subscribed ? `Set to ${NAMES[plan as keyof typeof NAMES]}. It still has a Stripe subscription, which keeps billing.` : `Set to ${NAMES[plan as keyof typeof NAMES]}.`);
    await show(id);
    setWorkspaces((list) => list.map((w) => (w.id === id ? { ...w, plan } : w)));
    await loadOverview();
  };

  return (
    <Page
      crumbs={["Support"]}
      title="Support"
      lede="Every workspace and person on this Studio. Changes here are recorded with your email address."
      meta={overview && (
        <span className="small muted">
          {overview.workspaces} workspace{overview.workspaces === 1 ? "" : "s"} · {overview.users} {overview.users === 1 ? "person" : "people"} · {overview.subscribed} subscribed
          {PLANS.filter((p) => overview.plans[p]).map((p) => ` · ${overview.plans[p]} ${NAMES[p]}`)}
          {overview.overQuota > 0 && <b> · {overview.overQuota} over quota</b>}
        </span>
      )}
    >
      <div className="tabs" role="tablist">
        {(["workspaces", "people", "log"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === "log" ? "What changed" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab !== "log" && (
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="admin-q">Search</label>
          <input id="admin-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "workspaces" ? "Workspace, slug or owner's email" : "Name or email"} />
        </div>
      )}

      {tab === "workspaces" && (
        <table>
          <thead>
            <tr><th>Workspace</th><th>Owner</th><th>Plan</th><th>Members</th><th>Made</th><th /></tr>
          </thead>
          <tbody>
            {workspaces.map((w) => (
              <tr key={w.id}>
                <td><b>{w.name}</b><div className="small muted">{w.slug}</div></td>
                <td className="small">{w.owner_email ?? <span className="muted">no owner</span>}</td>
                <td>
                  <span className={`tag ${w.plan === "free" ? "" : "on"}`}>{NAMES[w.plan as keyof typeof NAMES] ?? w.plan}</span>
                  {w.plan_status && w.plan_status !== "active" && <div className="small bad">{w.plan_status}</div>}
                </td>
                <td className="small num">{w.members}</td>
                <td className="small">{when(w.created_at)}</td>
                <td><button type="button" className="btn ghost sm" onClick={() => show(w.id)}>Open</button></td>
              </tr>
            ))}
            {!workspaces.length && <tr><td colSpan={6} className="muted small">Nothing matches.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === "people" && (
        <table>
          <thead><tr><th>Person</th><th>Email</th><th>Verified</th><th>Workspaces</th><th>Joined</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name || "—"}</b></td>
                <td className="small">{u.email}</td>
                <td className="small">{u.emailVerified ? "yes" : <span className="bad">no</span>}</td>
                <td className="small num">{u.workspaces}</td>
                <td className="small">{when(u.createdAt)}</td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={5} className="muted small">Nothing matches.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === "log" && <ActionLog actions={log} />}

      {open && <Detail detail={open} onClose={() => setOpen(null)} onPlan={setPlan} onChange={() => show(String(open.workspace.id))} />}
    </Page>
  );
}

function ActionLog({ actions }: { actions: AdminOverview["actions"] }) {
  return (
    <table>
      <thead><tr><th>When</th><th>Who</th><th>What</th><th>Where</th><th>Change</th><th>Why</th></tr></thead>
      <tbody>
        {actions.map((a) => (
          <tr key={String(a.id)}>
            <td className="small">{new Date(String(a.at)).toLocaleString("en-GB")}</td>
            <td className="small">{String(a.admin_email)}</td>
            <td className="small"><span className="tag">{String(a.action)}</span></td>
            <td className="small">{a.workspace_slug ? String(a.workspace_slug) : "—"}</td>
            <td className="small mono">{a.before ? JSON.parse(String(a.before)) : "—"} → {a.after ? JSON.parse(String(a.after)) : "—"}</td>
            <td className="small muted">{a.note ? String(a.note) : ""}</td>
          </tr>
        ))}
        {!actions.length && <tr><td colSpan={6} className="muted small">Nothing has been changed yet.</td></tr>}
      </tbody>
    </table>
  );
}

function Detail({ detail, onClose, onPlan, onChange }: { detail: AdminDetail; onClose: () => void; onPlan: (id: string, plan: string, note: string) => void; onChange: () => void }) {
  const { toast } = useSession();
  // Why, in the admin's own words: it goes into the record beside what changed.
  const [note, setNote] = useState("");
  const w = detail.workspace as Record<string, string | number | null>;
  const id = String(w.id);
  const act = async (run: () => Promise<unknown>, done: string) => {
    try {
      await run();
      toast(done);
      onChange();
    } catch (e) {
      toast(e instanceof Error ? e.message : "That didn't work", "bad");
    }
  };
  return (
    <>
    <div className="drawer-scrim" onClick={onClose} />
    <div className="drawer" role="dialog" aria-modal="true" aria-label={String(w.name)}>
      <header>
        <div style={{ flexGrow: 1 }}>
          <h2>{String(w.name)}</h2>
          <p className="small muted">{String(w.slug)} · made {when(String(w.created_at))}</p>
        </div>
        <button type="button" className="btn ghost sm" onClick={onClose}>Close</button>
      </header>
      <div className="body" style={{ display: "flex", flexDirection: "column", gap: 24, padding: 24, overflowY: "auto" }}>

      <section>
        <h3>Plan</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PLANS.map((p) => (
            <button key={p} type="button" className={`btn sm ${w.plan === p ? "" : "ghost"}`} onClick={() => onPlan(id, p, note)} disabled={w.plan === p}>
              {NAMES[p]}
            </button>
          ))}
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="why">Why (recorded)</label>
          <input id="why" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Design partner, enterprise deal, support fix…" />
        </div>
        <p className="small muted">
          Set by hand, with no Stripe subscription. <b>Enterprise</b> is the one a Stripe event never overwrites, so use it for anything that should stick.
          {w.stripe_subscription_id ? " This workspace has a subscription, which keeps charging whatever you set here." : ""}
        </p>
      </section>

      <section>
        <h3>People</h3>
        <table>
          <tbody>
            {detail.members.map((m) => (
              <tr key={m.id}>
                <td><b>{m.name || m.email}</b><div className="small muted">{m.email}</div></td>
                <td className="small"><span className={`tag ${m.role === "owner" ? "on" : ""}`}>{m.role}</span></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {m.role !== "owner" && (
                    <>
                      <button type="button" className="btn ghost sm" onClick={() => act(() => api("POST", `/api/admin/workspaces/${id}/owner`, { user: m.id, note }), `${m.name || m.email} owns it now`)}>Make owner</button>
                      <button type="button" className="btn ghost sm" onClick={() => act(() => api("DELETE", `/api/admin/workspaces/${id}/members/${m.id}`), "Taken out")}>Remove</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!!detail.invites.length && <p className="small muted">{detail.invites.length} invite{detail.invites.length === 1 ? "" : "s"} waiting.</p>}
      </section>

      <section>
        <h3>Stripe</h3>
        {detail.stripe.error && <p className="small bad">{detail.stripe.error}</p>}
        {!detail.stripe.customer && <p className="small muted">No customer: this workspace has never paid.</p>}
        {detail.stripe.subscriptions.map((s) => (
          <p key={s.id} className="small">
            <span className="tag">{s.status}</span> {s.quantity ?? 1} × {s.amount !== null && s.currency ? money(s.amount, s.currency) : s.price}
            {s.cancelAtPeriodEnd ? " · ends at the period's end" : ""}
          </p>
        ))}
        {!!detail.stripe.invoices.length && (
          <table>
            <tbody>
              {detail.stripe.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="small">{when(i.created)}</td>
                  <td className="small">{i.number ?? i.id}</td>
                  <td className="small">{i.status}</td>
                  <td className="small num">{money(i.total, i.currency)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{i.url && <a className="small" href={i.url} target="_blank" rel="noreferrer">Open</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {detail.stripe.customer && (
          <p className="small">
            <a href={`https://dashboard.stripe.com/customers/${detail.stripe.customer}`} target="_blank" rel="noreferrer">Open in Stripe</a>
          </p>
        )}
      </section>
      </div>
    </div>
    </>
  );
}
