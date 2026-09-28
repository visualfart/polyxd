import { daysFromNow, ids, rng } from "../kit/seeding.ts";

/**
 * Foundry's data: the customer-success desk of Basalt, a data platform sold in three annual,
 * seat-based plans. Fifty customers, eight people on the desk, ninety days of tickets, and a
 * year of renewals ahead. Everything derives from one seed so every visitor sees the same desk.
 */
export interface Foundry {
  session: { signedIn: boolean; user: { id: string; email: string } };
  plans: Plan[];
  team: Member[];
  accounts: Account[];
  contacts: Contact[];
  tickets: Ticket[];
  events: Event[];
  notes: Note[];
  renewals: Renewal[];
  quotes: Quote[];
  settings: { appearance: "system" | "light" | "dark" };
}

export type PlanId = "starter" | "growth" | "scale";
export interface Plan {
  id: PlanId;
  name: string;
  /** Annual price per seat, USD. */
  perSeat: number;
  minSeats: number;
  /** First-response target for a normal-priority ticket, in hours. */
  slaHours: number;
  sla: string;
  sso: boolean;
  retention: string;
  support: string;
}

export type Role = "admin" | "manager" | "agent" | "viewer";
export interface Member { id: string; name: string; email: string; role: Role; title: string; status: "active" | "away" | "invited"; awayUntil?: string; capacity: number; joinedAt: string; invitedAt?: string; welcomed?: boolean }

export interface Account {
  id: string;
  name: string;
  industry: string;
  domain: string;
  region: string;
  plan: PlanId;
  seats: number;
  seatsUsed: number;
  /** Annual recurring revenue, USD. */
  arr: number;
  startedAt: string;
  renewalAt: string;
  ownerId: string;
  status: "active" | "canceled";
  canceledAt?: string;
  /** Twelve weeks of weekly active seats, oldest first. */
  weeklyActive: number[];
}
export interface Contact { id: string; accountId: string; name: string; email: string; role: string; primary: boolean }
export type Priority = "urgent" | "high" | "normal" | "low";
export type TicketStatus = "open" | "pending" | "solved" | "closed";
export interface Ticket {
  id: string;
  number: number;
  accountId: string;
  subject: string;
  priority: Priority;
  status: TicketStatus;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  firstResponseAt: string | null;
  slaDueAt: string;
  messages: Message[];
}
export interface Message { id: string; from: "customer" | "agent"; author: string; at: string; body: string }
export interface Event { id: string; accountId: string; at: string; kind: "started" | "seats" | "plan" | "renewal" | "ticket" | "note" | "call" | "contact" | "quote" | "canceled"; text: string; ref?: string }
export interface Note { id: string; accountId: string; authorId: string; at: string; body: string }
export type Stage = "upcoming" | "quoted" | "won" | "churned";
export interface Renewal { id: string; accountId: string; stage: Stage; dueAt: string; seats: number; plan: PlanId; amount: number; quoteId?: string; movedAt: string }
export interface Quote { id: string; accountId: string; renewalId: string; plan: PlanId; seats: number; discount: number; termMonths: number; perSeat: number; subtotal: number; discountAmount: number; total: number; madeAt: string; sentAt?: string; validUntil: string }

export const PLANS: Plan[] = [
  { id: "starter", name: "Starter", perSeat: 240, minSeats: 5, slaHours: 48, sla: "2 business days", sso: false, retention: "30 days", support: "Email" },
  { id: "growth", name: "Growth", perSeat: 480, minSeats: 10, slaHours: 8, sla: "8 hours", sso: true, retention: "1 year", support: "Email and chat" },
  { id: "scale", name: "Scale", perSeat: 900, minSeats: 25, slaHours: 1, sla: "1 hour", sso: true, retention: "7 years", support: "Named CSM, 24/7" },
];

export const ROLES: { id: Role; name: string; description: string }[] = [
  { id: "viewer", name: "Viewer", description: "Sees accounts, tickets and renewals; changes nothing" },
  { id: "agent", name: "Agent", description: "Works tickets and updates accounts they own" },
  { id: "manager", name: "Manager", description: "Everything an agent can, plus quotes, plan changes and hand-overs" },
  { id: "admin", name: "Admin", description: "Everything, including the team and cancellations" },
];

/** The signed-in person is Noor: the desk's lead. */
export const ME = "m_noor";

const TEAM: Member[] = [
  { id: "m_noor", name: "Noor Haddad", email: "noor@basalt.io", role: "admin", title: "Customer success lead", status: "active", capacity: 8, joinedAt: daysFromNow(-1120) },
  { id: "m_sam", name: "Sam Whitlock", email: "sam@basalt.io", role: "agent", title: "Customer success manager", status: "away", awayUntil: daysFromNow(16), capacity: 14, joinedAt: daysFromNow(-640) },
  { id: "m_lena", name: "Lena Ortiz", email: "lena@basalt.io", role: "agent", title: "Customer success manager", status: "active", capacity: 14, joinedAt: daysFromNow(-410) },
  { id: "m_priya", name: "Priya Natarajan", email: "priya@basalt.io", role: "manager", title: "Renewals manager", status: "active", capacity: 10, joinedAt: daysFromNow(-880) },
  { id: "m_marcus", name: "Marcus Bell", email: "marcus@basalt.io", role: "agent", title: "Support engineer", status: "active", capacity: 16, joinedAt: daysFromNow(-300) },
  { id: "m_aiko", name: "Aiko Tanaka", email: "aiko@basalt.io", role: "agent", title: "Support engineer", status: "active", capacity: 16, joinedAt: daysFromNow(-220) },
  { id: "m_jonah", name: "Jonah Reyes", email: "jonah@basalt.io", role: "agent", title: "Onboarding specialist", status: "active", capacity: 10, joinedAt: daysFromNow(-150) },
  { id: "m_ingrid", name: "Ingrid Solberg", email: "ingrid@basalt.io", role: "viewer", title: "Finance", status: "active", capacity: 0, joinedAt: daysFromNow(-500) },
];

/** Invented customers; any resemblance to a real company is accidental. */
const COMPANIES: [string, string, string][] = [
  ["Ledgerline", "Financial services", "US East"],
  ["Marrowbank", "Financial services", "EU"],
  ["Quillpay", "Financial services", "US West"],
  ["Northbeam Health", "Healthcare", "US East"],
  ["Calloway Clinics", "Healthcare", "US Central"],
  ["Vitalis Labs", "Healthcare", "EU"],
  ["Harborlane Freight", "Logistics", "US West"],
  ["Redroute Logistics", "Logistics", "EU"],
  ["Cinderpath", "Logistics", "APAC"],
  ["Ashgrove Market", "Retail", "US East"],
  ["Tessellate Goods", "Retail", "EU"],
  ["Brightloom", "Retail", "US West"],
  ["Signalwood Media", "Media", "US West"],
  ["Halfmoon Studios", "Media", "US West"],
  ["Pennywhistle Press", "Media", "UK"],
  ["Larkspur Academy", "Education", "US Central"],
  ["Fieldnote Learning", "Education", "UK"],
  ["Oakhaven University", "Education", "US East"],
  ["Ironvale Works", "Manufacturing", "US Central"],
  ["Coppermill Industries", "Manufacturing", "EU"],
  ["Stonebridge Fabrication", "Manufacturing", "US East"],
  ["Sunward Energy", "Energy", "US West"],
  ["Tidemark Power", "Energy", "UK"],
  ["Greyhawk Utilities", "Energy", "US Central"],
  ["Kestrel Property", "Real estate", "US East"],
  ["Meridian Estates", "Real estate", "APAC"],
  ["Bluefern Software", "Software", "US West"],
  ["Cobaltix", "Software", "EU"],
  ["Parallax Systems", "Software", "US East"],
  ["Nimbus Forge", "Software", "APAC"],
  ["Wren & Field", "Software", "UK"],
  ["Saltmarsh Mutual", "Insurance", "US East"],
  ["Harrowgate Assurance", "Insurance", "UK"],
  ["Skylark Travel", "Travel", "EU"],
  ["Ferrybrook Tours", "Travel", "UK"],
  ["Open Meadow Foundation", "Nonprofit", "US Central"],
  ["Riverwatch Trust", "Nonprofit", "UK"],
  ["Fallowfield Farms", "Agriculture", "US Central"],
  ["Clearwater Dairy", "Agriculture", "APAC"],
  ["Lanternhouse Hotels", "Hospitality", "EU"],
  ["Copperkettle Cafés", "Hospitality", "US West"],
  ["Beaconline Telecom", "Telecoms", "APAC"],
  ["Thornbury Advisory", "Consulting", "UK"],
  ["Alder & Vance", "Consulting", "US East"],
  ["Helixera", "Biotech", "US West"],
  ["Granite Row Builders", "Construction", "US Central"],
  ["Axlewood Motors", "Automotive", "EU"],
  ["Fairweather Legal", "Legal", "US East"],
  ["Pixelmoor Games", "Gaming", "US West"],
  ["Ironclad Security", "Security", "US East"],
];

const FIRST = ["Dana", "Elliot", "Farah", "Gus", "Hana", "Ivan", "Jade", "Kofi", "Leah", "Milo", "Nadia", "Omar", "Petra", "Quentin", "Rosa", "Silas", "Tamsin", "Uri", "Vera", "Wes", "Yara", "Zeke", "Amara", "Bram", "Celia", "Dev", "Esme", "Finn"];
const LAST = ["Okafor", "Lindqvist", "Marsh", "Delgado", "Nakamura", "Petrov", "Whitfield", "Abara", "Sørensen", "Castellano", "Byrne", "Haldane", "Mbeki", "Roux", "Kaur", "Ferreira", "Novak", "Achebe", "Lund", "Hartigan"];
const CONTACT_ROLES = ["Admin", "Billing contact", "Champion", "Executive sponsor", "IT lead"];

const SUBJECTS: [string, Priority][] = [
  ["SSO sign-in loops back to the login page", "urgent"],
  ["Dashboards timing out since this morning", "urgent"],
  ["Scheduled exports stopped overnight", "urgent"],
  ["API returning 429 on the ingest endpoint", "high"],
  ["Webhook deliveries retrying and failing", "high"],
  ["Invoice shows the wrong seat count", "high"],
  ["Can't remove a deactivated user from a workspace", "high"],
  ["Query results differ between two workspaces", "high"],
  ["Sync from the warehouse is three hours behind", "high"],
  ["Add 10 seats before the end of the month", "normal"],
  ["Role permissions for viewers on shared boards", "normal"],
  ["Scheduled report arrives with an empty attachment", "normal"],
  ["Change the billing contact on the account", "normal"],
  ["Request for a data retention extension", "normal"],
  ["Rename a workspace without losing links", "normal"],
  ["CSV export drops the timezone column", "normal"],
  ["Where do audit logs live?", "low"],
  ["Training session for new analysts", "low"],
  ["Feature request: dark mode in embedded charts", "low"],
  ["Question about SCIM provisioning", "low"],
  ["Copy a dashboard into another workspace", "low"],
  ["Two-factor reset for an admin", "high"],
];

const CUSTOMER_LINES = [
  "This started this morning and it's blocking the team.",
  "We noticed it yesterday; not urgent but it's confusing people.",
  "Happy to jump on a call if that helps.",
  "Steps to reproduce are in the attached notes.",
  "We have a board meeting Thursday and need this working by then.",
  "Is this related to the release you announced last week?",
];
const AGENT_LINES = [
  "Thanks for the details. I can reproduce it and have passed it to engineering.",
  "Looking into this now; you'll hear back within the hour.",
  "This is fixed on our side. Can you refresh and confirm?",
  "That's expected on your current plan; I've added the option to your account.",
  "I've raised the limit for your workspace and will watch it over the next day.",
  "Resolved. I'll leave this open until you've confirmed.",
];

const slug = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
const round = (n: number) => Math.round(n * 100) / 100;

export function seed(): Foundry {
  const rand = rng(20260927);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const nextAccount = ids("acc");
  const nextContact = ids("ct");
  const nextTicket = ids("tk");
  const nextEvent = ids("ev");
  const nextNote = ids("note");
  const nextRenewal = ids("rn");
  const nextQuote = ids("q");
  const nextMessage = ids("msg");
  const owners = TEAM.filter((m) => m.role !== "viewer");
  const tlds = [".com", ".io", ".co", ".com", ".com"];

  const accounts: Account[] = [];
  const contacts: Contact[] = [];
  const events: Event[] = [];
  const notes: Note[] = [];
  const renewals: Renewal[] = [];
  const quotes: Quote[] = [];

  // Renewal dates: a deliberate spread so the next 30, 60 and 90 days each hold a handful.
  const renewalOffsets = [4, 9, 12, 17, 21, 26, 29, 33, 38, 44, 51, 57, 63, 71, 78, 86, 94, 103, 115, 128, 141, 156, 170, 184, 199, 214, 228, 243, 257, 271, 286, 300, 314, 329, 343, 358, 8, 24, 47, 66, 90, 120, 150, 180, 240, 330];
  const canceledOffsets = [-48, -31, -19, -6];

  COMPANIES.forEach(([name, industry, region], i) => {
    const canceled = i >= COMPANIES.length - canceledOffsets.length;
    const plan: PlanId = i % 5 === 0 || i % 7 === 0 ? "scale" : i % 2 === 0 ? "growth" : "starter";
    const p = PLANS.find((x) => x.id === plan)!;
    const seats = plan === "scale" ? between(30, 180) : plan === "growth" ? between(12, 80) : between(5, 30);
    // Usage: most customers use most of their seats; a few clearly don't.
    const usage = i % 6 === 0 ? 0.25 + rand() * 0.25 : i % 4 === 0 ? 0.5 + rand() * 0.2 : 0.72 + rand() * 0.26;
    const seatsUsed = Math.max(1, Math.min(seats, Math.round(seats * usage)));
    const renewalDays = canceled ? canceledOffsets[i - (COMPANIES.length - canceledOffsets.length)] + 30 : renewalOffsets[i % renewalOffsets.length];
    const years = between(1, 4);
    const renewalAt = daysFromNow(renewalDays, 12);
    const startedAt = daysFromNow(renewalDays - 365 * years, 12);
    // Weekly active seats: flat for most, sliding for the ones whose usage is low or whose renewal is near.
    const slide = usage < 0.5 ? 0.35 : renewalDays < 45 && usage < 0.75 ? 0.2 : 0;
    const weeklyActive = Array.from({ length: 12 }, (_, w) => Math.max(0, Math.round(seatsUsed * (1 + slide * (1 - w / 11)) * (0.94 + rand() * 0.12))));
    weeklyActive[11] = seatsUsed;
    const id = nextAccount();
    accounts.push({ id, name, industry, domain: `${slug(name)}${tlds[i % tlds.length]}`, region, plan, seats, seatsUsed, arr: seats * p.perSeat, startedAt, renewalAt, ownerId: owners[i % owners.length].id, status: canceled ? "canceled" : "active", canceledAt: canceled ? daysFromNow(canceledOffsets[i - (COMPANIES.length - canceledOffsets.length)], 15) : undefined, weeklyActive });

    // Two to four contacts, the first is the admin and primary.
    const n = between(2, 4);
    const used = new Set<string>();
    for (let c = 0; c < n; c++) {
      let full = `${pick(FIRST)} ${pick(LAST)}`;
      while (used.has(full)) full = `${pick(FIRST)} ${pick(LAST)}`;
      used.add(full);
      contacts.push({ id: nextContact(), accountId: id, name: full, email: `${full.split(" ")[0].toLowerCase()}@${slug(name)}${tlds[i % tlds.length]}`, role: c === 0 ? "Admin" : CONTACT_ROLES[1 + ((i + c) % (CONTACT_ROLES.length - 1))], primary: c === 0 });
    }

    // A life story: started, renewed each year, the odd seat change and call.
    events.push({ id: nextEvent(), accountId: id, at: startedAt, kind: "started", text: `Started on ${p.name} with ${Math.max(p.minSeats, seats - between(0, 8))} seats` });
    for (let y = 1; y < years; y++) events.push({ id: nextEvent(), accountId: id, at: daysFromNow(renewalDays - 365 * (years - y), 12), kind: "renewal", text: `Renewed for a year on ${p.name}` });
    if (rand() < 0.6) events.push({ id: nextEvent(), accountId: id, at: daysFromNow(-between(20, 300), 10), kind: "seats", text: `Seats changed to ${seats}` });
    if (rand() < 0.5) events.push({ id: nextEvent(), accountId: id, at: daysFromNow(-between(5, 80), 14), kind: "call", text: `Check-in call with ${contacts.find((c) => c.accountId === id)!.name.split(" ")[0]}` });
    if (canceled) events.push({ id: nextEvent(), accountId: id, at: accounts.at(-1)!.canceledAt!, kind: "canceled", text: "Plan canceled at the customer's request" });
    if (rand() < 0.35) notes.push({ id: nextNote(), accountId: id, authorId: owners[i % owners.length].id, at: daysFromNow(-between(2, 60), 11), body: pick(["Champion moved to a new role; introduce ourselves to the replacement.", "They want to consolidate two workspaces before renewal.", "Asked about Scale pricing for next year; send the comparison after the QBR.", "Finance signs off in the last week of the quarter; quote early.", "Slow adoption in the analytics team; onboarding session booked."]) });
  });

  // Tickets: ninety days of them, weighted towards the customers who are struggling.
  const tickets: Ticket[] = [];
  const active = accounts.filter((a) => a.status === "active");
  const weight = (a: Account) => (a.seatsUsed / a.seats < 0.5 ? 3 : a.plan === "scale" ? 2 : 1);
  const pool = active.flatMap((a) => Array.from({ length: weight(a) }, () => a));
  const agents = TEAM.filter((m) => m.role === "agent" || m.role === "manager");
  for (let t = 0; t < 122; t++) {
    const a = pick(pool);
    const plan = PLANS.find((x) => x.id === a.plan)!;
    const [subject, basePriority] = pick(SUBJECTS);
    const priority: Priority = rand() < 0.2 ? pick(["urgent", "high", "normal", "low"] as Priority[]) : basePriority;
    const ageDays = t < 30 ? rand() * 8 : rand() * 90;
    const createdAt = daysFromNow(-Math.floor(ageDays), between(8, 18), between(0, 59));
    const factor = priority === "urgent" ? 0.25 : priority === "high" ? 0.5 : priority === "normal" ? 1 : 3;
    const slaHours = Math.max(1, Math.round(plan.slaHours * factor));
    const slaDueAt = new Date(new Date(createdAt).getTime() + slaHours * 3600000).toISOString();
    // Recent tickets are open; older ones were worked to a close.
    const status: TicketStatus = ageDays < 7 ? (rand() < 0.7 ? "open" : "pending") : ageDays < 14 ? pick(["open", "pending", "solved"] as TicketStatus[]) : rand() < 0.3 ? "solved" : "closed";
    const unassigned = status === "open" && ageDays < 3 && rand() < 0.4;
    const assignee = unassigned ? null : rand() < 0.35 ? TEAM.find((m) => m.id === a.ownerId)!.id : pick(agents).id;
    const responded = status !== "open" || rand() < 0.6;
    const firstResponseAt = responded ? new Date(new Date(createdAt).getTime() + slaHours * 3600000 * (rand() < 0.8 ? rand() * 0.9 : 1 + rand())).toISOString() : null;
    const contact = contacts.filter((c) => c.accountId === a.id)[between(0, 1)] ?? contacts.find((c) => c.accountId === a.id)!;
    const messages: Message[] = [{ id: nextMessage(), from: "customer", author: contact.name, at: createdAt, body: `${subject}. ${pick(CUSTOMER_LINES)}` }];
    if (firstResponseAt) messages.push({ id: nextMessage(), from: "agent", author: TEAM.find((m) => m.id === assignee)?.name ?? "Basalt support", at: firstResponseAt, body: pick(AGENT_LINES) });
    if (status === "solved" || status === "closed") {
      messages.push({ id: nextMessage(), from: "customer", author: contact.name, at: new Date(new Date(firstResponseAt ?? createdAt).getTime() + 3600000 * between(2, 30)).toISOString(), body: pick(["Confirmed, that's working now. Thanks.", "Looks good on our side.", "Fixed, thank you for the quick turnaround."]) });
    } else if (status === "pending") {
      messages.push({ id: nextMessage(), from: "agent", author: TEAM.find((m) => m.id === assignee)?.name ?? "Basalt support", at: new Date(new Date(firstResponseAt ?? createdAt).getTime() + 3600000 * between(1, 12)).toISOString(), body: "Waiting on engineering; I'll update you as soon as there's a fix to test." });
    }
    const updatedAt = messages.at(-1)!.at;
    tickets.push({ id: nextTicket(), number: 0, accountId: a.id, subject, priority, status, assigneeId: assignee, createdAt, updatedAt, firstResponseAt, slaDueAt, messages });
  }
  tickets.sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  tickets.forEach((t, i) => (t.number = 4100 + i));
  // Sam is away from next week: his queue is what the hand-over ask is for.
  const sams = tickets.filter((t) => t.status === "open" || t.status === "pending").slice(-14, -6);
  for (const t of sams) t.assigneeId = "m_sam";
  for (const t of tickets) if (t.status === "solved" || t.status === "closed") events.push({ id: nextEvent(), accountId: t.accountId, at: t.updatedAt, kind: "ticket", text: `Ticket #${t.number} ${t.status}: ${t.subject}`, ref: t.id });
  for (const t of tickets.filter((t) => t.status === "open").slice(-12)) events.push({ id: nextEvent(), accountId: t.accountId, at: t.createdAt, kind: "ticket", text: `Ticket #${t.number} opened: ${t.subject}`, ref: t.id });

  // Renewals: everything due in the next 120 days, a few already quoted, this quarter's wins, the churn.
  for (const a of accounts) {
    const days = (new Date(a.renewalAt).getTime() - Date.now()) / 86400000;
    if (a.status === "canceled") {
      renewals.push({ id: nextRenewal(), accountId: a.id, stage: "churned", dueAt: a.renewalAt, seats: a.seats, plan: a.plan, amount: a.arr, movedAt: a.canceledAt! });
      continue;
    }
    if (days > 120) continue;
    const id = nextRenewal();
    const quoted = days < 60 && rand() < 0.4;
    const r: Renewal = { id, accountId: a.id, stage: quoted ? "quoted" : "upcoming", dueAt: a.renewalAt, seats: a.seats, plan: a.plan, amount: a.arr, movedAt: daysFromNow(-between(3, 40), 9) };
    if (quoted) {
      const plan = PLANS.find((x) => x.id === a.plan)!;
      const discount = pick([0, 0, 5, 10]);
      const subtotal = a.seats * plan.perSeat;
      const q: Quote = { id: nextQuote(), accountId: a.id, renewalId: id, plan: a.plan, seats: a.seats, discount, termMonths: 12, perSeat: plan.perSeat, subtotal, discountAmount: round((subtotal * discount) / 100), total: round(subtotal * (1 - discount / 100)), madeAt: r.movedAt, sentAt: r.movedAt, validUntil: daysFromNow(30 - between(3, 40), 9) };
      quotes.push(q);
      r.quoteId = q.id;
      events.push({ id: nextEvent(), accountId: a.id, at: q.sentAt!, kind: "quote", text: `Renewal quote sent: ${a.seats} seats on ${plan.name}${discount ? `, ${discount}% off` : ""}` });
    }
    renewals.push(r);
  }
  // Wins this quarter: five customers who renewed in the last two months.
  const wins = active.filter((_, i) => i % 9 === 4).slice(0, 5);
  for (const a of wins) {
    const at = daysFromNow(-between(5, 55), 16);
    renewals.push({ id: nextRenewal(), accountId: a.id, stage: "won", dueAt: at, seats: a.seats, plan: a.plan, amount: a.arr, movedAt: at });
    events.push({ id: nextEvent(), accountId: a.id, at, kind: "renewal", text: `Renewed for a year on ${PLANS.find((p) => p.id === a.plan)!.name}` });
  }

  events.sort((x, y) => x.at.localeCompare(y.at));
  return {
    session: { signedIn: false, user: { id: ME, email: "noor@basalt.io" } },
    plans: PLANS,
    team: TEAM,
    accounts,
    contacts,
    tickets,
    events,
    notes,
    renewals,
    quotes,
    settings: { appearance: "system" },
  };
}

/* ---- Derived views the screens and surfaces share ---- */

export const plan = (h: Foundry, id: PlanId) => h.plans.find((p) => p.id === id)!;
export const account = (h: Foundry, id?: string | null) => h.accounts.find((a) => a.id === id);
export const member = (h: Foundry, id?: string | null) => h.team.find((m) => m.id === id);
export const me = (h: Foundry) => member(h, h.session.user.id) ?? h.team[0];
/** "Northbeam Health" → "NH"; a one-word name gives two letters ("Le") so the avatar isn't a lone capital. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length >= 2) return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return (words[0] ?? name).slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}

export const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
export const isOpen = (t: Ticket) => t.status === "open" || t.status === "pending";
/** Past its first-response target with no reply yet. */
export const breached = (t: Ticket) => t.status === "open" && !t.firstResponseAt && Date.now() > new Date(t.slaDueAt).getTime();
export const openTickets = (h: Foundry, accountId: string) => h.tickets.filter((t) => t.accountId === accountId && isOpen(t));

export type HealthLabel = "Healthy" | "Watch" | "At risk";
export interface Health {
  score: number;
  label: HealthLabel;
  tone: "success" | "warning" | "danger";
  usage: number;
  /** Active seats this week against four weeks ago. */
  trend: number;
  open: number;
  urgent: number;
  breached: number;
  daysToRenewal: number;
  reasons: string[];
  /** Nothing is pulling the score down: the reasons say why it's fine. */
  positive: boolean;
}

/**
 * Health: what a CS lead looks at before a call. Usage carries the most weight, then the support
 * load, then how close the renewal is; the reasons are the same sentences a person would say.
 */
export function health(h: Foundry, a: Account): Health {
  const usage = a.seatsUsed / a.seats;
  const tickets = openTickets(h, a.id);
  const urgent = tickets.filter((t) => t.priority === "urgent").length;
  const high = tickets.filter((t) => t.priority === "high").length;
  const late = tickets.filter(breached).length;
  const days = daysUntil(a.renewalAt);
  const now = a.weeklyActive[11];
  const before = a.weeklyActive[7] || 1;
  const trend = round((now - before) / before);
  let score = usage >= 0.7 ? 50 : usage >= 0.45 ? 32 : 14;
  score += Math.max(0, 30 - urgent * 14 - high * 7 - late * 6 - Math.max(0, tickets.length - 3) * 2);
  score += days > 90 ? 20 : days > 30 ? 14 : 8;
  if (trend <= -0.15) score -= 12;
  score = Math.max(0, Math.min(100, score));
  const reasons: string[] = [];
  if (usage < 0.45) reasons.push(`Only ${Math.round(usage * 100)}% of ${a.seats} seats are in use`);
  else if (usage < 0.7) reasons.push(`${Math.round(usage * 100)}% of seats in use, below the 70% that renews comfortably`);
  if (trend <= -0.15) reasons.push(`Weekly active seats fell ${Math.round(-trend * 100)}% over the last four weeks`);
  if (urgent) reasons.push(`${urgent} urgent ticket${urgent === 1 ? "" : "s"} open`);
  if (high) reasons.push(`${high} high-priority ticket${high === 1 ? "" : "s"} open`);
  if (late) reasons.push(`${late} ticket${late === 1 ? "" : "s"} past the first-response target`);
  if (days <= 30 && days >= 0) reasons.push(`Renews in ${days} day${days === 1 ? "" : "s"}`);
  const positive = reasons.length === 0;
  if (positive) reasons.push(`${Math.round(usage * 100)}% of seats in use and ${tickets.length ? `${tickets.length} routine ticket${tickets.length === 1 ? "" : "s"}` : "no open tickets"}`, days > 90 ? `Renews in ${Math.round(days / 30)} months` : `Renews in ${days} days`);
  const label: HealthLabel = score >= 70 ? "Healthy" : score >= 45 ? "Watch" : "At risk";
  return { score, label, tone: label === "Healthy" ? "success" : label === "Watch" ? "warning" : "danger", usage: round(usage), trend, open: tickets.length, urgent, breached: late, daysToRenewal: days, reasons, positive };
}

/** Annual price of a plan at a seat count, before any discount. */
export const annualPrice = (p: Plan, seats: number) => Math.max(p.minSeats, seats) * p.perSeat;

/** The unused part of the current term, refunded pro rata on cancellation. */
export function proration(a: Account, effectiveAt: string): { monthsLeft: number; refund: number; termEnd: string } {
  const end = new Date(a.renewalAt).getTime();
  const from = Math.max(Date.now(), new Date(effectiveAt).getTime());
  const monthsLeft = Math.max(0, Math.floor((end - from) / (86400000 * 30.4375)));
  return { monthsLeft, refund: round((a.arr * monthsLeft) / 12), termEnd: a.renewalAt };
}
