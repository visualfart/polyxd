import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import { Page, type Ws } from "../App.tsx";
import { Mark } from "../mark.tsx";

interface DS { id: string; name: string; is_default: number; status: string | null; scan: { total: number } | null }

export function Home({ ws }: { ws: Ws }) {
  const [ds, setDs] = useState<DS[] | null>(null);
  const [rules, setRules] = useState<number | null>(null);
  const [components, setComponents] = useState<{ connected: number; total: number } | null>(null);
  const [screens, setScreens] = useState<{ total: number; published: number } | null>(null);
  const [directions, setDirections] = useState<{ total: number; published: number } | null>(null);
  useEffect(() => {
    api<{ designSystems: DS[] }>("GET", `/api/w/${ws.slug}/design-systems`).then((r) => setDs(r.designSystems));
    api<{ rules: unknown[] }>("GET", `/api/w/${ws.slug}/rules`).then((r) => setRules(r.rules.length));
    api<{ components: { renderer: unknown }[] }>("GET", `/api/w/${ws.slug}/components`).then((r) => setComponents({ connected: r.components.filter((c) => c.renderer).length, total: r.components.length }));
    api<{ screens: { status: string }[] }>("GET", `/api/w/${ws.slug}/screens`).then((r) => setScreens({ total: r.screens.length, published: r.screens.filter((s) => s.status === "published").length }));
    api<{ directions: { status: string }[] }>("GET", `/api/w/${ws.slug}/directions`).then((r) => setDirections({ total: r.directions.length, published: r.directions.filter((d) => d.status === "published").length }));
  }, [ws.slug]);
  const live = ds?.find((d) => d.status === "live");
  const steps = [
    { done: !!ds?.length, title: "Connect your design system", sub: ds?.length ? `${ds[0].name} · ${ds[0].scan?.total.toLocaleString()} tokens${live ? " · live" : " · draft"}` : "Import tokens from a package, Tokens Studio or CSS, or start from a template", to: "design-systems", cta: "Design systems" },
    { done: !!components?.connected, title: "Map your components", sub: components ? `${components.connected} of ${components.total} connected to your own` : "", to: "components", cta: "Components" },
    { done: !!directions?.published, title: "Set your direction", sub: directions?.total ? `${directions.total} Direction${directions.total === 1 ? "" : "s"} · ${directions.published} published` : "Density, voice, patterns and exemplars, in one file products fetch", to: "directions", cta: "Directions" },
    { done: !!rules, title: "Write your rules", sub: rules ? `${rules} of yours, plus Polyxd's built-in checks` : "What every generated screen has to follow", to: "rules", cta: "Rules" },
    { done: !!screens?.total, title: "Design a screen", sub: screens?.total ? `${screens.total} screen${screens.total === 1 ? "" : "s"} · ${screens.published} published` : "Author a surface by hand, in your design system, checked like a generated one", to: "screens", cta: "Screens" },
    { done: false, title: "Invite your team", sub: "Designers review, engineers connect components", to: "team", cta: "Team" },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <Page crumbs={[ws.name, "Home"]} title={`Good to see you`} lede={`Here is what's left to make ${ws.name}'s generated screens its own.`}>
      <div className="split">
        <div className="card grow">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><h2>Get {ws.name} ready</h2><p className="muted small">{done} of {steps.length} done. Screens generate as soon as a design system is live; the rest makes them yours.</p></div>
            <span className={`meter ${done === steps.length ? "" : "warn"}`}><i style={{ width: `${(done / steps.length) * 100}%` }} /></span>
          </div>
          <ol className="list">
            {steps.map((s) => (
              <li key={s.title}>
                {s.done ? <Mark size={26} state="checked" /> : <span className="dot" aria-hidden="true" style={{ width: 22, height: 22, margin: 2, border: "1.5px solid var(--border)", background: "transparent" }} />}
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontWeight: 600, color: s.done ? "var(--muted)" : "var(--ink)" }}>{s.done ? <><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Done: </span>{s.title}</> : s.title}</div>
                  <div className="small muted">{s.sub}</div>
                </div>
                <Link className={`btn sm ${s.done ? "ghost" : ""}`} to={`/w/${ws.slug}/${s.to}`}>{s.done ? "Open" : s.cta}</Link>
              </li>
            ))}
          </ol>
        </div>
        <div className="aside card">
          <h2>What Studio does</h2>
          <p style={{ color: "var(--ink-2)" }}>Your generator writes screens as Polyxd documents. Studio holds what they are allowed to look like: your tokens mapped to Polyxd's roles, which components are yours, and the rules every screen is checked against.</p>
          <p style={{ color: "var(--ink-2)" }}>Screens designers author here are checked the same way and delivered to your product by key. Insights counts how every screen does, generated or authored, once your product sends its events. Reviews and releases come later.</p>
        </div>
      </div>
    </Page>
  );
}
