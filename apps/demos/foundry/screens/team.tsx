import { ROLES, isOpen, type Member } from "../seed.ts";
import { useFoundry } from "../session.ts";
import { Badge, Button, Card, DataTable, Empty, Meter, Person, plural, shortDate, type Column } from "../ui.tsx";

const ROLE_TONE = { admin: "info", manager: "success", agent: "neutral", viewer: "outline" } as const;

export function Team() {
  const { h, store, say, open } = useFoundry();
  const rows = h.team.map((m) => ({ m, open: h.tickets.filter((t) => t.assigneeId === m.id && isOpen(t)).length, owned: h.accounts.filter((a) => a.ownerId === m.id && a.status === "active").length }));
  type Row = (typeof rows)[number];
  const remove = (m: Member) => {
    const undo = store.commit(`Remove ${m.name}`, (d) => {
      d.team = d.team.filter((x) => x.id !== m.id);
    });
    say(`${m.name}'s invitation withdrawn.`, undo);
  };
  const columns: Column<Row>[] = [
    { key: "name", label: "Member", sort: (r) => r.m.name, render: (r) => <Person name={r.m.name} detail={r.m.email} size={28} /> },
    { key: "role", label: "Role", sort: (r) => ROLES.findIndex((x) => x.id === r.m.role), render: (r) => <Badge tone={ROLE_TONE[r.m.role]}>{ROLES.find((x) => x.id === r.m.role)!.name}</Badge> },
    { key: "title", label: "Title", sort: (r) => r.m.title, render: (r) => r.m.title, secondary: true },
    { key: "status", label: "Status", sort: (r) => r.m.status, render: (r) => (r.m.status === "away" ? <Badge tone="warning" dot>Away{r.m.awayUntil ? ` until ${shortDate(r.m.awayUntil)}` : ""}</Badge> : r.m.status === "invited" ? <Badge tone="info">Invited {r.m.invitedAt ? shortDate(r.m.invitedAt) : ""}</Badge> : <Badge tone="success" dot>Active</Badge>) },
    { key: "load", label: "Open tickets", align: "end", sort: (r) => r.open, render: (r) => r.m.capacity ? (
        <span className="fd-row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "nowrap" }}>
          <Meter value={r.open} max={r.m.capacity} label={`${r.m.name}'s load`} tone={r.open > r.m.capacity ? "danger" : r.open > r.m.capacity * 0.8 ? "warning" : undefined} />
          <span className="fd-tabular">
            {r.open}/{r.m.capacity}
          </span>
        </span>
      ) : <span className="fd-muted">–</span> },
    { key: "owned", label: "Accounts", align: "end", sort: (r) => r.owned, render: (r) => <span className="fd-tabular">{r.owned || <span className="fd-muted">–</span>}</span>, secondary: true },
    { key: "actions", label: "", align: "end", render: (r) => (
        <span className="fd-row" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
          {r.open > 0 && r.m.status !== "invited" && (
            <Button size="sm" variant="ghost" icon="spark" onClick={() => open("tickets.reassign", { from: r.m.id })}>
              Hand over
            </Button>
          )}
          {r.m.status === "invited" && (
            <Button size="sm" variant="ghost" onClick={() => remove(r.m)}>
              Withdraw
            </Button>
          )}
        </span>
      ) },
  ];
  const invited = rows.filter((r) => r.m.status === "invited").length;
  return (
    <div className="fd-page">
      <header className="fd-page-head">
        <div className="fd-page-text">
          <h1 className="fd-page-title">Team</h1>
          <p className="fd-page-desc">
            {plural(rows.length - invited, "person", "people")} on the desk{invited ? `, ${invited} invited` : ""} · {plural(h.tickets.filter(isOpen).length, "open ticket")} between them
          </p>
        </div>
        <div className="fd-page-actions">
          <Button variant="default" icon="plus" onClick={() => open("team.invite")}>
            Invite
          </Button>
        </div>
      </header>
      <Card padded={false}>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.m.id} caption="Team members" defaultSort={{ key: "role", dir: "asc" }} empty={<Empty icon="team" title="Nobody on the desk" body="Invite someone and they appear here." action={<Button size="sm" onClick={() => open("team.invite")}>Invite</Button>} />} />
      </Card>
      <Card title="Roles">
        <dl className="fd-kv">
          {ROLES.map((r) => (
            <RoleRow key={r.id} name={r.name} description={r.description} />
          ))}
        </dl>
      </Card>
    </div>
  );
}

function RoleRow({ name, description }: { name: string; description: string }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>{description}</dd>
    </>
  );
}
