import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.ts";
import { useSession } from "../App.tsx";

interface Inv { id: string; email: string; role: string; message: string; expires_at: string; accepted_at: string | null; workspace: string; inviter: string }

export function Invite() {
  const { id } = useParams();
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [inv, setInv] = useState<Inv | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Inv>("GET", `/api/invites/${id}`).then(setInv).catch((e) => setError(e.message));
  }, [id]);
  const accept = async () => {
    try {
      const r = await api<{ slug: string }>("POST", `/api/invites/${id}/accept`);
      await refresh();
      navigate(`/w/${r.slug}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="auth">
      <main>
        <div className="form">
          {error && <div className="notice bad"><div className="body">{error}</div></div>}
          {inv && (
            <>
              <p className="muted"><b style={{ color: "var(--ink)" }}>{inv.inviter}</b> invited you to {inv.workspace}</p>
              <h1>Join {inv.workspace} on Studio</h1>
              <p className="muted">You'll be a {inv.role}. {inv.message && <span>“{inv.message}”</span>}</p>
              {inv.accepted_at ? <p>This invite was already used.</p> : new Date(inv.expires_at) < new Date() ? <p>This invite has expired. Ask {inv.inviter} for a new one.</p> : me.user ? (
                me.user.email === inv.email ? <button type="button" className="btn primary full" onClick={accept}>Accept and join</button> : <p>This invite is for {inv.email}, and you're signed in as {me.user.email}.</p>
              ) : (
                <><p className="small muted">Sign in as {inv.email} first, then come back to this link.</p><Link className="btn primary full" to="/signin">Sign in</Link></>
              )}
            </>
          )}
        </div>
      </main>
      <aside><p>One workspace per product.</p><p>You're joining the people who decide what {inv?.workspace ?? "its"} generated screens may look like.</p></aside>
    </div>
  );
}
