/** A diff as a reviewer reads it: by section, each change with what it was struck through and what it is now. */
import { SECTIONS, type Change } from "../../direction/diff.ts";

export function ChangeList({ changes, empty }: { changes: Change[]; empty: string }) {
  if (!changes.length) return <p className="small muted">{empty}</p>;
  return (
    <div className="dir-changes">
      {SECTIONS.map((section) => {
        const list = changes.filter((c) => c.section === section);
        if (!list.length) return null;
        return (
          <section key={section} aria-label={section}>
            <h3 className="dir-changes-h">{section} <span className="muted">{list.length}</span></h3>
            <ul>
              {list.map((c, i) => (
                <li key={i} className="dir-change" data-kind={c.kind}>
                  <span className={`tag ${c.kind === "added" ? "ok" : c.kind === "removed" ? "bad" : "signal"}`}>{c.kind === "added" ? "Added" : c.kind === "removed" ? "Removed" : "Changed"}</span>
                  <span className="dir-change-body">
                    <b>{c.what}</b>
                    {(c.before !== undefined || c.after !== undefined) && (
                      <span className="dir-change-values">
                        {c.before !== undefined && <del>{c.before}</del>}
                        {c.before !== undefined && c.after !== undefined && <span aria-hidden="true" className="muted"> → </span>}
                        {c.after !== undefined && <ins>{c.after}</ins>}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
