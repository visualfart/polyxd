import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { track } from "../analytics.ts";
import { Page, useSession, type Ws } from "../App.tsx";

interface Member { id: string; email: string; name: string; role: string; created_at: string }
interface Detail { members: Member[]; invites: { id: string; email: string; role: string; expires_at: string }[] }
interface Key { id: string; name: string; created_at: string; last_used_at: string | null }
interface IngestKey extends Key { key: string }
const CAN_MANAGE_INGEST = new Set(["owner", "engineer", "design-system", "product"]);

const ROLES: [string, string][] = [["design-system", "Design system: tokens, components, rules, releases"], ["designer", "Designer: direction, reviews, exemplars"], ["product", "Product: capabilities, journeys, insights"], ["engineer", "Engineer: components, capabilities, integrations"], ["viewer", "Viewer: everything, read only"]];

export function Team({ ws }: { ws: Ws }) {
  const { toast } = useSession();
  const [d, setD] = useState<Detail | null>(null);
  const [keys, setKeys] = useState<Key[]>([]);
  const [inviting, setInviting] = useState(false);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("designer");
  const [links, setLinks] = useState<{ email: string; link?: string; sent?: boolean }[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [ingestKeys, setIngestKeys] = useState<IngestKey[]>([]);
  const load = () => {
    api<Detail>("GET", `/api/w/${ws.slug}`).then(setD);
    api<{ keys: Key[] }>("GET", `/api/w/${ws.slug}/api-keys`).then((r) => setKeys(r.keys));
    api<{ keys: IngestKey[] }>("GET", `/api/w/${ws.slug}/ingest-keys`).then((r) => setIngestKeys(r.keys));
  };
  const makeIngestKey = async () => {
    try {
      await api("POST", `/api/w/${ws.slug}/ingest-keys`, { name: "Product events" });
      load();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  const revokeIngestKey = async (k: IngestKey) => {
    if (!window.confirm(`Revoke “${k.name}”? Products sending events with it are refused from now on.`)) return;
    await api("DELETE", `/api/w/${ws.slug}/ingest-keys/${k.id}`);
    load();
  };
  useEffect(() => {
    load();
  }, [ws.slug]);
  const invite = async () => {
    try {
      const r = await api<{ invites: { email: string; link?: string; sent?: boolean }[] }>("POST", `/api/w/${ws.slug}/invites`, { emails: emails.split(/[\s,]+/), role });
      setLinks(r.invites);
      setEmails("");
      load();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  const makeKey = async () => {
    const r = await api<{ key: string }>("POST", `/api/w/${ws.slug}/api-keys`, { name: "polyxd studio push" });
    track("api_key_created", {}, ws.id);
    setNewKey(r.key);
    load();
  };
  if (!d) return null;
  return (
    <Page crumbs={[ws.name, "Workspace", "Team"]} title="Team" lede={`${d.members.length} people · ${d.invites.length} invite${d.invites.length === 1 ? "" : "s"} pending`} actions={<button type="button" className="btn primary" onClick={() => setInviting(true)}>Invite people</button>}>
      <div className="split">
        <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <table>
            <thead><tr><th>Person</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {d.members.map((m) => <tr key={m.id}><td><b>{m.name || m.email}</b><div className="small muted">{m.email}</div></td><td>{m.role}</td><td className="small muted">{new Date(m.created_at).toLocaleDateString("en-GB")}</td></tr>)}
              {d.invites.map((i) => <tr key={i.id}><td><b>{i.email}</b><div className="small muted">invited</div></td><td>{i.role}</td><td className="small muted">expires {new Date(i.expires_at).toLocaleDateString("en-GB")}</td></tr>)}
            </tbody>
          </table>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><h2>API keys</h2><p>For <span className="mono">npx polyxd studio push</span>, run inside your network with your own registry access.</p></div><button type="button" className="btn sm" onClick={makeKey}>New key</button></div>
            {newKey && <div className="notice signal"><div className="body"><b>Copy this key now; it won't be shown again</b><code className="mono" style={{ userSelect: "all" }}>{newKey}</code><div style={{ marginTop: 6 }}>Then, in your package: <code className="mono">POLYXD_STUDIO_KEY={"<key>"} npx polyxd studio push ./ --to {location.origin}/api/w/{ws.slug}</code></div></div></div>}
            <ul className="list">
              {keys.map((k) => <li key={k.id}><span style={{ flexGrow: 1 }}>{k.name}<div className="small muted">made {new Date(k.created_at).toLocaleDateString("en-GB")} · {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString("en-GB")}` : "never used"}</div></span><button type="button" className="btn ghost sm" onClick={async () => { await api("DELETE", `/api/w/${ws.slug}/api-keys/${k.id}`); load(); }}>Revoke</button></li>)}
            </ul>
          </div>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}><div><h2>Ingest keys</h2><p>For your product's pages, to send semantic events to <Link to={`/w/${ws.slug}/insights`}>Insights</Link>. A key can send events and nothing else, so it isn't a secret.</p></div>{CAN_MANAGE_INGEST.has(ws.role) && <button type="button" className="btn sm" onClick={makeIngestKey}>New key</button>}</div>
            <ul className="list">
              {ingestKeys.map((k) => <li key={k.id}><span style={{ flexGrow: 1, minWidth: 0 }}>{k.name}<code className="mono small" style={{ display: "block", userSelect: "all", overflowWrap: "anywhere" }}>{k.key}</code><div className="small muted">made {new Date(k.created_at).toLocaleDateString("en-GB")} · {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString("en-GB")}` : "never used"}</div></span>{CAN_MANAGE_INGEST.has(ws.role) && <button type="button" className="btn ghost sm" onClick={() => revokeIngestKey(k)}>Revoke</button>}</li>)}
              {!ingestKeys.length && <li className="small muted">None yet.</li>}
            </ul>
          </div>
        </div>
        <aside className="aside card" style={{ gap: 6 }}>
          <h2>What roles can do</h2>
          <ul className="list">{ROLES.map(([r, desc]) => <li key={r} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}><b className="small">{r}</b><span className="small muted">{desc.split(": ")[1]}</span></li>)}</ul>
        </aside>
      </div>
      {inviting && (
        <>
          <div className="drawer-scrim" onClick={() => setInviting(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Invite people">
            <header><h2>Invite people</h2><button type="button" className="btn ghost sm" onClick={() => setInviting(false)}>Close</button></header>
            <div className="body">
              <div className="field"><label htmlFor="em">Email addresses</label><textarea id="em" className="textarea" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ana@northwind.io, leo@northwind.io" /><span className="help">Separate with commas or new lines.</span></div>
              <div className="field"><label htmlFor="rl">Role</label><select id="rl" className="select" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([r, desc]) => <option key={r} value={r}>{desc}</option>)}</select></div>
              {!!links.length && <div className="notice ok"><div className="body"><b>{links.every((l) => l.sent) ? "Invites sent." : "Invites made. No email sender is set up, so pass these links on yourself:"}</b>{links.filter((l) => l.link).map((l) => <div key={l.email} className="small mono" style={{ userSelect: "all" }}>{l.email}: {l.link}</div>)}</div></div>}
            </div>
            <footer><button type="button" className="btn" onClick={() => setInviting(false)}>Done</button><button type="button" className="btn primary" onClick={invite}>Send invites</button></footer>
          </div>
        </>
      )}
    </Page>
  );
}
