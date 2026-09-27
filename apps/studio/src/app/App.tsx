import { createContext, lazy, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, type Me } from "./api.ts";
import { SignIn } from "./pages/SignIn.tsx";
import { Workspaces } from "./pages/Workspaces.tsx";
import { Home } from "./pages/Home.tsx";
import { DesignSystems } from "./pages/DesignSystems.tsx";
import { Import } from "./pages/Import.tsx";
import { ScanPage } from "./pages/Scan.tsx";
import { Mapping } from "./pages/Mapping.tsx";
import { DesignSystem } from "./pages/DesignSystem.tsx";
import { Components } from "./pages/Components.tsx";
import { Rules } from "./pages/Rules.tsx";
import { Team } from "./pages/Team.tsx";
import { Invite } from "./pages/Invite.tsx";
import { Mark } from "./mark.tsx";
// The screen pages carry the renderer, the schema and the spec's examples; they load when opened.
const Screens = lazy(() => import("./pages/Screens.tsx").then((m) => ({ default: m.Screens })));
const Screen = lazy(() => import("./pages/Screen.tsx").then((m) => ({ default: m.Screen })));
// The tokens editor carries the mapper and the contract; it loads when opened.
const TokensEditor = lazy(() => import("./pages/TokensEditor.tsx").then((m) => ({ default: m.TokensEditor })));
// The landing carries the renderer, three themes and its own stylesheet; it loads only when shown.
const Landing = lazy(() => import("./pages/Landing.tsx").then((m) => ({ default: m.Landing })));

interface Session {
  me: Me;
  refresh: () => Promise<void>;
  toast: (text: string, tone?: "ok" | "bad") => void;
}
const SessionCtx = createContext<Session>(null!);
export const useSession = () => useContext(SessionCtx);

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "bad" } | null>(null);
  const refresh = async () => setMe(await api<Me>("GET", "/api/me"));
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  if (!me) return null;
  const session: Session = { me, refresh, toast: (text, tone = "ok") => setToast({ text, tone }) };
  return (
    <SessionCtx.Provider value={session}>
      <Routes>
        <Route path="/signin" element={me.user ? <Navigate to="/" replace /> : <SignIn />} />
        <Route path="/reset-password" element={<SignIn start="reset" />} />
        <Route path="/invite/:id" element={<Invite />} />
        <Route path="/" element={me.user ? <Workspaces /> : <Suspense fallback={null}><Landing /></Suspense>} />
        <Route path="/welcome" element={<Suspense fallback={null}><Landing /></Suspense>} />
        <Route path="/w/:slug/*" element={me.user ? <Shell /> : <Navigate to="/signin" replace />} />
      </Routes>
      {toast && (
        <div className={`toast ${toast.tone === "bad" ? "bad" : ""}`} role="status">
          {toast.text}
        </div>
      )}
    </SessionCtx.Provider>
  );
}

const NAV: { group?: string; items: { to: string; label: string }[] }[] = [
  { items: [{ to: "", label: "Home" }] },
  { group: "Foundations", items: [{ to: "design-systems", label: "Design systems" }, { to: "components", label: "Components" }] },
  { group: "Direction", items: [{ to: "rules", label: "Rules" }] },
  { group: "Product", items: [{ to: "screens", label: "Screens" }] },
  { group: "Workspace", items: [{ to: "team", label: "Team" }] },
];

function Shell() {
  const { slug } = useParams();
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const ws = me.workspaces.find((w) => w.slug === slug);
  if (!ws) return <Navigate to="/" replace />;
  const signOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", credentials: "same-origin" });
    await refresh();
    navigate("/signin");
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Mark />
          <div>
            <div className="name">Polyxd Studio</div>
            <div className="ws">{ws.name}</div>
          </div>
        </div>
        <nav className="nav" aria-label="Studio">
          {NAV.map((g, i) => (
            <div key={i}>
              {g.group && <div className="nav-group">{g.group}</div>}
              {g.items.map((it) => (
                <NavLink key={it.to} to={`/w/${slug}/${it.to}`} end={it.to === ""}>
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="bottom">
          <NavLink to="/" className="nav-link">
            Switch workspace
          </NavLink>
          <button type="button" className="account" onClick={signOut} title="Sign out">
            <span style={{ flexGrow: 1 }}>
              <b style={{ display: "block", fontSize: 13 }}>{me.user?.name || me.user?.email}</b>
              <span className="small muted">{ws.role}</span>
            </span>
            <span className="small muted">Sign out</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route index element={<Home ws={ws} />} />
          <Route path="design-systems" element={<DesignSystems ws={ws} />} />
          <Route path="design-systems/import" element={<Import ws={ws} />} />
          <Route path="design-systems/:id/versions/:v/scan" element={<ScanPage ws={ws} />} />
          <Route path="design-systems/:id/versions/:v/map" element={<Mapping ws={ws} />} />
          <Route path="design-systems/:id/versions/:v/edit" element={<Suspense fallback={null}><TokensEditor ws={ws} /></Suspense>} />
          <Route path="design-systems/:id/*" element={<DesignSystem ws={ws} />} />
          <Route path="components" element={<Components ws={ws} />} />
          <Route path="rules" element={<Rules ws={ws} />} />
          <Route path="screens" element={<Suspense fallback={null}><Screens ws={ws} /></Suspense>} />
          <Route path="screens/:key" element={<Suspense fallback={null}><Screen ws={ws} /></Suspense>} />
          <Route path="team" element={<Team ws={ws} />} />
          <Route path="*" element={<div className="empty"><h2>That page isn't here</h2><p>The link may be from another workspace.</p></div>} />
        </Routes>
      </main>
    </div>
  );
}

export type Ws = Me["workspaces"][number];

export function Page({ crumbs, title, lede, actions, children, meta }: { crumbs: string[]; title: string; lede?: string; actions?: ReactNode; meta?: ReactNode; children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i}>{i < crumbs.length - 1 ? <>{c} <span aria-hidden="true">/</span></> : <b aria-current="page">{c}</b>}</span>
          ))}
        </nav>
      </header>
      <div className="page">
        <div className="page-head">
          <div>
            <h1>{title}</h1>
            {lede && <p>{lede}</p>}
            {meta && <div className="meta">{meta}</div>}
          </div>
          {actions && <div className="actions">{actions}</div>}
        </div>
        {children}
      </div>
    </>
  );
}
