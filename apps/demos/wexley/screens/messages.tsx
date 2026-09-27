import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useWexley } from "../session.ts";
import { BackLink, Breadcrumbs, Heading, Tag, date, longDate } from "../ui.tsx";

export function Messages() {
  const { w } = useWexley();
  const unread = w.messages.filter((m) => !m.read).length;
  return (
    <>
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Messages" }]} />
      <div className="wx-grid">
        <div>
          <Heading caption={unread ? `${unread} unread` : "All read"}>Messages</Heading>
          <p className="wx-body">Letters from the council come here instead of by post, because you chose that in your contact settings.</p>
          <ul className="wx-messages">
            {w.messages.map((m) => (
              <li key={m.id} className={m.read ? undefined : "wx-message-unread"}>
                <div className="wx-message-meta">
                  <span>{m.from}</span>
                  <span>{date(m.at)}</span>
                  {!m.read && <Tag tone="info">New</Tag>}
                </div>
                <Link to={`/messages/${m.id}`} className="wx-message-subject">
                  {m.subject}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export function Message() {
  const { id } = useParams();
  const { w, store } = useWexley();
  const m = w.messages.find((x) => x.id === id);
  useEffect(() => {
    if (m && !m.read) store.commit("Read message", (d) => void (d.messages.find((x) => x.id === m.id)!.read = true));
  }, [m, store]);
  if (!m)
    return (
      <>
        <BackLink to="/messages" />
        <Heading>That letter is not here</Heading>
        <p className="wx-body">
          <Link to="/messages">All messages</Link>
        </p>
      </>
    );
  return (
    <>
      <BackLink to="/messages" />
      <div className="wx-grid">
        <div className="wx-letter">
          <Heading caption={`${m.from} · ${longDate(m.at)}`}>{m.subject}</Heading>
          <p className="wx-body">Dear {w.resident.name},</p>
          {m.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p>Wexley Borough Council</p>
          {m.about && (
            <p>
              <Link to={m.about}>Go to the service this is about</Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
