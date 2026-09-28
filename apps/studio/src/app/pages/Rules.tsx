import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";

interface Rule { id: string; name: string; why: string; severity: "error" | "warning"; check: { check: string; [k: string]: unknown }; enabled: number; owner: string; created_at: string }

const STARTERS: { name: string; why: string; severity: Rule["severity"]; check: Rule["check"] }[] = [
  { name: "Destructive actions name what is lost", why: "People confirm what they can see. A title that names the thing stops the wrong one being deleted.", severity: "error", check: { check: "confirmNamesSubject" } },
  { name: "Never ask “Are you sure”", why: "Say what will happen instead; a question with no information teaches people to click past it.", severity: "warning", check: { check: "textNotMatching", pattern: "are you sure" } },
  { name: "At most six inputs in one view", why: "Longer forms split into steps; short views finish.", severity: "error", check: { check: "maxInputsPerView", max: 6 } },
];

export function Rules({ ws }: { ws: Ws }) {
  const { toast } = useSession();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [open, setOpen] = useState<Partial<Rule> | null>(null);
  const [checkText, setCheckText] = useState("");
  const load = () => api<{ rules: Rule[] }>("GET", `/api/w/${ws.slug}/rules`).then((r) => setRules(r.rules));
  useEffect(() => {
    load();
  }, [ws.slug]);
  const start = (r: Partial<Rule>) => {
    setOpen(r);
    setCheckText(JSON.stringify(r.check ?? { check: "" }, null, 2));
  };
  const save = async () => {
    if (!open) return;
    let check: unknown;
    try {
      check = JSON.parse(checkText);
    } catch {
      toast("The check isn't valid JSON", "bad");
      return;
    }
    try {
      if (open.id) await api("PUT", `/api/w/${ws.slug}/rules/${open.id}`, { name: open.name, why: open.why, severity: open.severity, check });
      else await api("POST", `/api/w/${ws.slug}/rules`, { name: open.name, why: open.why, severity: open.severity ?? "warning", check });
      toast(`Saved “${open.name}”`);
      setOpen(null);
      load();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  const toggle = async (r: Rule) => {
    await api("PUT", `/api/w/${ws.slug}/rules/${r.id}`, { enabled: !r.enabled });
    load();
  };
  const remove = async (r: Rule) => {
    await api("DELETE", `/api/w/${ws.slug}/rules/${r.id}`);
    toast(`Deleted “${r.name}”`);
    setOpen(null);
    load();
  };
  if (!rules) return null;
  return (
    <Page crumbs={[ws.name, "Direction", "Rules"]} title="Rules" lede="What every generated screen has to follow, on top of Polyxd's built-in checks. Each rule is a check the verifier runs; its pass rate appears once screens flow in." actions={<button type="button" className="btn primary" onClick={() => start({ severity: "warning" })}>New rule</button>}>
      {!rules.length && (
        <div className="empty" style={{ maxWidth: 560 }}>
          <h2>No rules of your own yet</h2>
          <p>Polyxd's built-in rules already run on every screen. Add yours to hold screens to {ws.name}'s standards. Teams usually start with these:</p>
          <ul className="list" style={{ width: "100%", textAlign: "left" }}>
            {STARTERS.map((s) => <li key={s.name}><span style={{ flexGrow: 1 }}>{s.name}</span><button type="button" className="btn sm" onClick={() => start(s)}>Add</button></li>)}
          </ul>
        </div>
      )}
      {!!rules.length && (
        <table>
          <thead><tr><th>Rule</th><th>Severity</th><th>Owner</th><th>On</th><th></th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td><b>{r.name}</b><div className="small muted">{r.why}</div></td>
                <td><span className={`tag ${r.severity === "error" ? "bad" : "warn"}`}>{r.severity}</span></td>
                <td>{r.owner}</td>
                <td><button type="button" role="switch" aria-checked={!!r.enabled} aria-label={`Enforce ${r.name}`} className="switch" onClick={() => toggle(r)}><i /></button></td>
                <td style={{ textAlign: "right" }}><button type="button" className="btn ghost sm" onClick={() => start(r)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && (
        <>
          <div className="drawer-scrim" onClick={() => setOpen(null)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label={open.id ? "Edit rule" : "New rule"}>
            <header><h2>{open.id ? "Edit rule" : "New rule"}</h2><button type="button" className="btn ghost sm" onClick={() => setOpen(null)}>Close</button></header>
            <div className="body">
              <div className="field"><label htmlFor="rn">Rule</label><input id="rn" className="input" value={open.name ?? ""} onChange={(e) => setOpen({ ...open, name: e.target.value })} autoFocus /></div>
              <div className="field"><label htmlFor="rw">Why</label><textarea id="rw" className="textarea" value={open.why ?? ""} onChange={(e) => setOpen({ ...open, why: e.target.value })} /><span className="help">Shown to reviewers, and to generators as guidance.</span></div>
              <div className="field"><label htmlFor="rs">Severity</label><select id="rs" className="select" value={open.severity ?? "warning"} onChange={(e) => setOpen({ ...open, severity: e.target.value as Rule["severity"] })}><option value="error">Error: the screen isn't shown</option><option value="warning">Warning: shown, and flagged for review</option></select></div>
              <div className="field"><label htmlFor="rc">Check</label><textarea id="rc" className="textarea mono" style={{ minHeight: 140, fontFamily: "var(--mono)", fontSize: 14 }} value={checkText} onChange={(e) => setCheckText(e.target.value)} /><span className="help">A check from Polyxd's shared vocabulary (schema/check.schema.json). A visual editor for these is coming.</span></div>
            </div>
            <footer>{open.id && <button type="button" className="btn ghost" style={{ marginRight: "auto", color: "var(--bad)" }} onClick={() => remove(open as Rule)}>Delete rule</button>}<button type="button" className="btn" onClick={() => setOpen(null)}>Cancel</button><button type="button" className="btn primary" onClick={save}>Save rule</button></footer>
          </div>
        </>
      )}
    </Page>
  );
}
