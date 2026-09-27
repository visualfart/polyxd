import type { IntentFile } from "../kit/types.ts";
import { ME, PLANS, ROLES, account, annualPrice, breached, daysUntil, health, initials, isOpen, member, openTickets, plan, proration, type Account, type Foundry, type PlanId, type Stage, type Ticket } from "./seed.ts";
import { dateOnly, daysWord, isoDay, money, plural, relative, shortDate } from "./format.ts";

/**
 * The data a surface binds to. An intent's `data` map names, per surface key, a `view:` computed
 * here, a JSON Pointer into Foundry's data, or a literal. Slots from the ask (an account, a seat
 * count) steer the views and pre-fill drafts. No React here: the snapshot and verify scripts use
 * it too, and so does the live bridge that recomputes a surface's numbers as its inputs change.
 */
export function view(h: Foundry, name: string, slots: Record<string, unknown>): unknown {
  switch (name) {
    case "renewingFilters":
      return { days: Number(slots.days ?? 30), health: Array.isArray(slots.health) ? slots.health : slots.health ? [slots.health] : [], plans: Array.isArray(slots.plans) ? slots.plans : slots.plan ? [slots.plan] : [] };
    case "renewingResults":
      return renewingResults(h, view(h, "renewingFilters", slots) as Filters);

    case "accountOptions":
      return h.accounts
        .filter((a) => a.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ id: a.id, name: a.name, initials: initials(a.name), detail: `${plan(h, a.plan).name} · ${plural(a.seats, "seat")} · renews ${shortDate(a.renewalAt)}`, recent: daysUntil(a.renewalAt) <= 45 }));
    case "cancelDraft":
      return { accountId: slots.account ?? null, effectiveAt: isoDay(new Date().toISOString()), refundMethod: slots.refund ?? "original" };
    case "cancelReview":
      return cancelReview(h, slots);

    case "planCompare":
      return planCompare(h, slots);
    case "planChange":
      return planChange(h, slots);

    case "handover":
      return handover(h, slots);

    case "inviteDraft":
      return { emails: [], role: slots.role ?? "viewer", sendWelcome: true };
    case "teamSummary": {
      const active = h.team.filter((m) => m.status !== "invited");
      const invited = h.team.filter((m) => m.status === "invited");
      return { count: active.length, text: `${plural(active.length, "person", "people")} on the desk${invited.length ? `, ${invited.length} invited and waiting` : ""}. New members get an email with a sign-in link.` };
    }

    case "accountHealth":
      return accountHealth(h, slots);

    case "quoteDraft": {
      const a = account(h, String(slots.account)) ?? h.accounts.find((x) => x.status === "active")!;
      return { accountId: a.id, seats: Number(slots.seats ?? a.seats), plan: String(slots.plan ?? a.plan), discount: Number(slots.discount ?? 0), termMonths: Number(slots.term ?? 12) };
    }
    case "quotePlans":
      return PLANS.map((p) => ({ id: p.id, name: p.name, detail: `${money(p.perSeat)} per seat a year, ${p.minSeats} seats minimum` }));
    case "quoteReceipt":
      return quoteReceipt(h, view(h, "quoteDraft", slots) as QuoteDraft);
    case "quoteReview":
      return quoteReview(h, slots);

    // The authored screens: the same views feed the product's own pages.
    case "renewalPipeline":
      return renewalPipeline(h);
    case "renewalWin":
      return renewalWin(h, slots);
    case "teamPage":
      return teamPage(h);
    case "roles":
      return Object.fromEntries(ROLES.map((r) => [r.id, { name: r.name, description: r.description }]));
    case "accountOverview":
      return accountOverview(h, slots);
    default:
      throw new Error(`Unknown view ${name}`);
  }
}

interface Filters { days: number; health: string[]; plans: string[] }

/** Accounts renewing inside the window that also have open tickets: the ones a call would help. */
function renewingResults(h: Foundry, f: Filters) {
  const rows = h.accounts
    .filter((a) => a.status === "active")
    .map((a) => ({ a, hs: health(h, a), open: openTickets(h, a.id) }))
    .filter(({ a, open }) => open.length > 0 && daysUntil(a.renewalAt) >= 0 && daysUntil(a.renewalAt) <= f.days)
    .filter(({ hs }) => !f.health.length || f.health.includes(hs.label))
    .filter(({ a }) => !f.plans.length || f.plans.includes(a.plan))
    .sort((x, y) => x.a.renewalAt.localeCompare(y.a.renewalAt))
    .map(({ a, hs, open }) => accountRow(h, a, hs, open));
  return { rows, count: rows.length, caption: `Renewing in the next ${f.days} days with open tickets` };
}

export function accountRow(h: Foundry, a: Account, hs = health(h, a), open = openTickets(h, a.id)) {
  return {
    id: a.id,
    name: a.name,
    industry: a.industry,
    initials: initials(a.name),
    plan: plan(h, a.plan).name,
    planId: a.plan,
    planLine: `${plan(h, a.plan).name} · ${a.industry}`,
    seats: a.seats,
    seatsUsed: a.seatsUsed,
    arr: a.arr,
    health: hs.label,
    healthScore: hs.score,
    renewalAt: a.renewalAt,
    daysToRenewal: hs.daysToRenewal,
    openTickets: open.length,
    urgent: open.filter((t) => t.priority === "urgent").length,
    owner: member(h, a.ownerId)?.name ?? "Unassigned",
  };
}

function cancelReview(h: Foundry, slots: Record<string, unknown>) {
  const a = account(h, String(slots.account)) ?? h.accounts.find((x) => x.status === "active")!;
  const effectiveAt = String(slots.effectiveAt ?? isoDay(new Date().toISOString()));
  const refundMethod = String(slots.refundMethod ?? "original");
  const p = plan(h, a.plan);
  const { monthsLeft, refund, termEnd } = proration(a, effectiveAt);
  const refundLabel = REFUNDS[refundMethod] ?? REFUNDS.original;
  const contact = h.contacts.find((c) => c.accountId === a.id && c.role === "Billing contact") ?? h.contacts.find((c) => c.accountId === a.id && c.primary)!;
  const effective = new Date(`${effectiveAt}T12:00:00`);
  return {
    account: { id: a.id, name: a.name, initials: initials(a.name), planLabel: `${p.name}, ${plural(a.seats, "seat")}, annual` },
    title: `Cancel ${a.name}'s plan?`,
    label: `Cancel ${a.name}'s plan`,
    effectiveAt: effective.toISOString(),
    refundMethod,
    refundLabel,
    refund: refundMethod === "none" ? 0 : refund,
    monthsLeft,
    termPaid: a.arr,
    termEnd,
    seats: a.seats,
    accessText: `Access ends ${dateOnly(effective.toISOString())}`,
    peopleText: `${plural(a.seatsUsed, "person", "people")} lose access`,
    contactText: `${contact.name} is emailed`,
    consequence: `Ends ${money(a.arr)} of annual revenue. ${refundMethod === "none" ? "No refund is issued." : refund === 0 ? `No refund is due: the paid term ends ${dateOnly(termEnd)}.` : `${money(refund)} goes to ${refundLabel.toLowerCase()} within 5 business days.`} This can't be undone from here.`,
  };
}
const REFUNDS: Record<string, string> = { original: "Original payment method", credit: "Account credit", none: "No refund" };

function planCompare(h: Foundry, slots: Record<string, unknown>) {
  const a = account(h, String(slots.account)) ?? h.accounts.find((x) => x.status === "active" && x.plan === "growth")!;
  const wanted = (Array.isArray(slots.plans) ? (slots.plans as string[]) : []).filter((p) => PLANS.some((x) => x.id === p));
  const shown = wanted.length >= 2 ? PLANS.filter((p) => wanted.includes(p.id)) : PLANS;
  const hs = health(h, a);
  const current = plan(h, a.plan);
  const plans = shown.map((p) => ({ id: p.id, name: p.name, minSeats: p.minSeats, perSeat: p.perSeat, annual: annualPrice(p, a.seats), sla: p.sla, sso: p.sso, retention: p.retention, support: p.support, current: p.id === a.plan }));
  // Recommend by fit: heavy users with open urgent work want the SLA; light users shouldn't pay for more.
  const heavy = hs.usage >= 0.8 && a.seats >= 25;
  const light = hs.usage < 0.5;
  const pct = Math.round(hs.usage * 100);
  // A smaller plan only helps if it exists below theirs and its seat floor still fits the team.
  const smaller = [...shown].reverse().find((p) => p.perSeat < current.perSeat && (p.id !== "starter" || a.seats <= 30));
  const rec = (heavy ? shown.find((p) => p.id === "scale") : light ? smaller : shown.find((p) => p.id === "growth")) ?? shown.find((p) => p.id === a.plan) ?? shown[0];
  const reason =
    rec.id === a.plan
      ? light
        ? `Only ${pct}% of seats are in use: the fix is adoption, not the plan, so stay on ${current.name} and cut seats at renewal`
        : `${pct}% of seats active with routine support needs: ${current.name} already fits`
      : heavy
        ? `${pct}% of ${a.seats} seats active${hs.urgent ? ` and ${plural(hs.urgent, "urgent ticket")} open` : ""}: the 1-hour response and named CSM pay for themselves`
        : light
          ? `Only ${pct}% of seats are in use; ${rec.name} keeps the price in line with what they use`
          : `${pct}% of seats active with routine support needs: ${rec.name} covers SSO and an 8-hour response`;
  return {
    account: { id: a.id, name: a.name, seats: a.seats, seatsUsed: a.seatsUsed, planName: current.name, renewalAt: a.renewalAt },
    summary: `${a.name} has ${plural(a.seats, "seat")} on ${current.name}, ${Math.round(hs.usage * 100)}% in use, renewing ${dateOnly(a.renewalAt)}. Prices are for a year at ${a.seats} seats.`,
    annualLabel: `A year at ${a.seats} seats`,
    plans,
    recommendation: { plan: rec.name, reason },
  };
}

function planChange(h: Foundry, slots: Record<string, unknown>) {
  const a = account(h, String(slots.account)) ?? h.accounts.find((x) => x.status === "active" && x.plan === "growth")!;
  const toId = (PLANS.some((p) => p.id === slots.plan) ? slots.plan : a.plan === "scale" ? "growth" : "scale") as PlanId;
  const from = plan(h, a.plan);
  const to = plan(h, toId);
  const seats = Math.max(to.minSeats, a.seats);
  const fromAnnual = a.arr;
  const toAnnual = annualPrice(to, seats);
  const difference = toAnnual - fromAnnual;
  const { monthsLeft } = proration(a, new Date().toISOString());
  const prorated = Math.round((difference * monthsLeft) / 12);
  const upgrade = difference >= 0;
  const contact = h.contacts.find((c) => c.accountId === a.id && c.role === "Billing contact") ?? h.contacts.find((c) => c.accountId === a.id && c.primary)!;
  return {
    account: { id: a.id, name: a.name, initials: initials(a.name), detail: `${from.name} · ${plural(a.seats, "seat")} · renews ${shortDate(a.renewalAt)}` },
    title: `Move ${a.name} to ${to.name}?`,
    label: `Move to ${to.name}`,
    plan: to.id,
    fromPlan: from.name,
    toPlan: to.name,
    seats,
    seatsNote: seats !== a.seats ? `${to.name} starts at ${to.minSeats} seats, so the account goes from ${a.seats} to ${seats}` : `Same ${plural(seats, "seat")} as today`,
    perSeat: to.perSeat,
    fromAnnual,
    toAnnual,
    difference,
    prorated: Math.abs(prorated),
    proratedText: monthsLeft === 0 ? `Nothing charged or credited now: the term ends ${dateOnly(a.renewalAt)}` : upgrade ? `${money(Math.abs(prorated))} charged today for the ${plural(monthsLeft, "month")} left` : `${money(Math.abs(prorated))} credited for the ${plural(monthsLeft, "month")} left`,
    monthsLeft,
    renewalAt: a.renewalAt,
    changeText: upgrade ? `${to.sla} first response and ${to.support.toLowerCase()} from today` : `First response moves to ${to.sla}; ${to.retention} data retention`,
    contactText: `${contact.name} is emailed the new terms`,
    consequence: `${a.name} moves to ${to.name} today. ${monthsLeft === 0 ? "Nothing is charged or credited for the days left on the term" : upgrade ? `${money(Math.abs(prorated))} is charged now for the ${plural(monthsLeft, "month")} left on the term` : `${money(Math.abs(prorated))} is credited for the ${plural(monthsLeft, "month")} left on the term`}, and the renewal on ${dateOnly(a.renewalAt)} becomes ${money(toAnnual)} a year. The billing contact is emailed; moving back is a new plan change.`,
  };
}

function ticketRow(h: Foundry, t: Ticket) {
  const a = account(h, t.accountId);
  const late = breached(t);
  return {
    id: t.id,
    number: `#${t.number}`,
    subject: t.subject,
    account: a?.name ?? "",
    priority: PRIORITY[t.priority],
    status: STATUS[t.status],
    updatedAt: t.updatedAt,
    sla: late ? "Past target" : t.firstResponseAt ? "Answered" : `Due ${relative(t.slaDueAt)}`,
    assignee: member(h, t.assigneeId)?.name ?? "Unassigned",
  };
}
export const PRIORITY: Record<string, string> = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
export const STATUS: Record<string, string> = { open: "Open", pending: "Pending", solved: "Solved", closed: "Closed" };

function handover(h: Foundry, slots: Record<string, unknown>) {
  const from = member(h, String(slots.from)) ?? member(h, "m_sam")!;
  const to = member(h, String(slots.to));
  const tickets = h.tickets
    .filter((t) => t.assigneeId === from.id && isOpen(t))
    .sort((x, y) => PRIORITY_ORDER[x.priority] - PRIORITY_ORDER[y.priority] || x.slaDueAt.localeCompare(y.slaDueAt))
    .map((t) => ticketRow(h, t));
  const load = (id: string) => h.tickets.filter((t) => t.assigneeId === id && isOpen(t)).length;
  const team = h.team
    .filter((m) => m.id !== from.id && m.status === "active" && m.role !== "viewer")
    .map((m) => ({ id: m.id, name: m.name, initials: initials(m.name), detail: `${m.title} · ${plural(load(m.id), "open ticket")}${m.capacity ? ` of ${m.capacity}` : ""}`, recent: load(m.id) < m.capacity * 0.6 }));
  return {
    from: { id: from.id, name: from.name, firstName: from.name.split(" ")[0] },
    caption: `${from.name}'s open tickets`,
    intro: from.status === "away" && from.awayUntil ? `${from.name} is away until ${dateOnly(from.awayUntil)}. Everything here is open or waiting on a reply.` : `${from.name} has ${plural(tickets.length, "open ticket")}. Untick any that should stay.`,
    tickets,
    selection: { ids: tickets.map((t) => t.id), assigneeId: to?.id ?? null },
    team,
  };
}
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function accountHealth(h: Foundry, slots: Record<string, unknown>) {
  const a = account(h, String(slots.account)) ?? [...h.accounts].filter((x) => x.status === "active").sort((x, y) => health(h, x).score - health(h, y).score)[0];
  const hs = health(h, a);
  const weekly = a.weeklyActive.map((active, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() - 7 * (11 - i));
    return { week: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), active };
  });
  const first = weekly[0].active;
  const last = weekly[11].active;
  const chartSummary = last < first * 0.85 ? `Active seats fell from ${first} to ${last} over twelve weeks.` : last > first * 1.15 ? `Active seats rose from ${first} to ${last} over twelve weeks.` : `Active seats held steady around ${last} over twelve weeks.`;
  const open = openTickets(h, a.id);
  return {
    id: a.id,
    name: a.name,
    title: `${a.name}: ${hs.label.toLowerCase()}`,
    score: hs.score,
    label: hs.label,
    scoreCaption: `${hs.label} · ${plan(h, a.plan).name}, ${plural(a.seats, "seat")}`,
    usage: hs.usage,
    usageChange: hs.trend,
    open: hs.open,
    ticketsCaption: open.length ? [hs.urgent ? plural(hs.urgent, "urgent") : "", hs.breached ? `${hs.breached} past target` : ""].filter(Boolean).join(", ") || "None urgent" : "Nothing open",
    daysToRenewal: hs.daysToRenewal,
    renewalCaption: dateOnly(a.renewalAt),
    weekly,
    chartSummary,
    reasons: hs.reasons,
    reasonsTitle: hs.positive ? "What's keeping the score up" : hs.label === "Healthy" ? "Worth watching, even so" : "What's pulling the score down",
  };
}

interface QuoteDraft { accountId: string; seats: number; plan: string; discount: number; termMonths: number }

function quoteReceipt(h: Foundry, d: QuoteDraft) {
  const a = account(h, d.accountId) ?? h.accounts[0];
  const p = PLANS.find((x) => x.id === d.plan) ?? plan(h, a.plan);
  const seats = Math.max(p.minSeats, Math.max(1, Math.floor(Number(d.seats) || 0)));
  const discount = Math.min(30, Math.max(0, Number(d.discount) || 0));
  const term = [12, 24, 36].includes(Number(d.termMonths)) ? Number(d.termMonths) : 12;
  const subtotal = seats * p.perSeat * (term / 12);
  const discountAmount = Math.round((subtotal * discount) / 100);
  const total = subtotal - discountAmount;
  const perYear = total / (term / 12);
  return {
    accountName: a.name,
    planName: p.name,
    seats,
    seatsNote: seats !== Number(d.seats) ? `${p.name} starts at ${p.minSeats} seats` : `${plural(a.seats, "seat")} today`,
    perSeat: p.perSeat,
    termLabel: term === 12 ? "1 year" : `${term / 12} years`,
    subtotal,
    discount,
    discountAmount,
    total,
    perYear,
    currentArr: a.arr,
    change: perYear - a.arr,
    changeText: perYear === a.arr ? `The same ${money(a.arr)} a year as today.` : `${money(Math.abs(perYear - a.arr))} a year ${perYear > a.arr ? "more" : "less"} than today's ${money(a.arr)}.`,
    renewalAt: a.renewalAt,
  };
}

function quoteReview(h: Foundry, slots: Record<string, unknown>) {
  const q = h.quotes.find((x) => x.id === slots.quote) ?? h.quotes.filter((x) => !x.sentAt).at(-1) ?? h.quotes.at(-1);
  // With no quote in the store (the verifier's snapshot), review a representative one from the draft.
  const draft = view(h, "quoteDraft", slots) as QuoteDraft;
  const r = quoteReceipt(h, draft);
  const a = account(h, q?.accountId ?? draft.accountId) ?? h.accounts[0];
  const p = PLANS.find((x) => x.id === (q?.plan ?? draft.plan))!;
  const contact = h.contacts.find((c) => c.accountId === a.id && c.role === "Billing contact") ?? h.contacts.find((c) => c.accountId === a.id && c.primary)!;
  const total = q?.total ?? r.total;
  const perYear = q ? q.total / (q.termMonths / 12) : r.perYear;
  const validUntil = q?.validUntil ?? new Date(Date.now() + 30 * 86400000).toISOString();
  return {
    id: q?.id ?? "q_draft",
    title: `Send this quote to ${a.name}?`,
    label: `Send quote`,
    account: { id: a.id, name: a.name, initials: initials(a.name), detail: `${contact.name} · ${contact.email}` },
    planName: p.name,
    seats: q?.seats ?? r.seats,
    perSeat: p.perSeat,
    termLabel: q ? (q.termMonths === 12 ? "1 year" : `${q.termMonths / 12} years`) : r.termLabel,
    subtotal: q?.subtotal ?? r.subtotal,
    discount: q?.discount ?? r.discount,
    discountLabel: `Discount (${q?.discount ?? r.discount}%)`,
    discountAmount: q?.discountAmount ?? r.discountAmount,
    total,
    perYear,
    change: perYear - a.arr,
    renewalAt: a.renewalAt,
    validUntil,
    sentText: `Emailed to ${contact.name}`,
    validText: `Valid until ${dateOnly(validUntil)}`,
    stageText: "Renewal moves to Quoted",
    consequence: `${contact.name} gets the quote by email with a link to accept. ${money(total)} for ${q ? (q.termMonths === 12 ? "a year" : `${q.termMonths / 12} years`) : r.termLabel === "1 year" ? "a year" : r.termLabel} is ${perYear - a.arr >= 0 ? `${money(Math.abs(perYear - a.arr))} a year more` : `${money(Math.abs(perYear - a.arr))} a year less`} than today. You can send a revised quote later, but this one can't be recalled.`,
  };
}

/* ---- Authored screens ---- */

const STAGES: Stage[] = ["upcoming", "quoted", "won", "churned"];

/** The renewals page: four stages, each a list of renewals with the account beside it, and the money in each. */
function renewalPipeline(h: Foundry) {
  const all = h.renewals.map((r) => ({ r, a: account(h, r.accountId)! })).filter((x) => x.a);
  const by = (s: Stage) => all.filter((x) => x.r.stage === s).sort((x, y) => (s === "won" || s === "churned" ? y.r.movedAt.localeCompare(x.r.movedAt) : x.r.dueAt.localeCompare(y.r.dueAt)));
  const sum = (xs: { r: { amount: number } }[]) => xs.reduce((s, x) => s + x.r.amount, 0);
  const due90 = all.filter((x) => (x.r.stage === "upcoming" || x.r.stage === "quoted") && daysUntil(x.r.dueAt) >= 0 && daysUntil(x.r.dueAt) <= 90);
  // Four columns fit every pack at 1100px; the timing rides on the entity line and the owner is a first name, as the cards had it.
  const row = ({ r, a }: (typeof all)[number]) => ({
    id: r.id,
    accountId: a.id,
    name: a.name,
    initials: initials(a.name),
    plan: r.plan,
    seats: r.seats,
    planLine: `${plan(h, r.plan).name} · ${plural(r.seats, "seat")}${r.stage === "upcoming" || r.stage === "quoted" ? ` · due ${daysWord(daysUntil(r.dueAt))}` : ""}`,
    amount: r.amount,
    dueAt: r.dueAt,
    movedAt: r.movedAt,
    owner: member(h, a.ownerId)?.name.split(" ")[0] ?? "Unassigned",
  });
  const stages = Object.fromEntries(STAGES.map((s) => [s, by(s)])) as Record<Stage, typeof all>;
  return {
    stage: "upcoming",
    counts: Object.fromEntries(STAGES.map((s) => [s, stages[s].length])),
    totals: {
      due90: { amount: sum(due90), caption: `${plural(due90.length, "renewal")} · ${due90.filter((x) => x.r.stage === "quoted").length} quoted` },
      quoted: { amount: sum(stages.quoted), caption: plural(stages.quoted.length, "quote") },
      won: { amount: sum(stages.won), caption: plural(stages.won.length, "renewal") },
      churned: { amount: sum(stages.churned), caption: plural(stages.churned.length, "account") },
    },
    rows: Object.fromEntries(STAGES.map((s) => [s, stages[s].map(row)])),
  };
}

/** What marking a renewal won does to the account, before it's recorded. */
function renewalWin(h: Foundry, slots: Record<string, unknown>) {
  const r = h.renewals.find((x) => x.id === slots.renewal) ?? h.renewals.find((x) => x.stage === "quoted") ?? h.renewals.find((x) => x.stage === "upcoming") ?? h.renewals[0];
  const a = account(h, r.accountId) ?? h.accounts[0];
  const p = plan(h, r.plan);
  const next = new Date(r.dueAt);
  next.setFullYear(next.getFullYear() + 1);
  return {
    id: r.id,
    title: `Mark ${a.name}'s renewal won?`,
    label: "Mark won",
    amount: r.amount,
    account: { id: a.id, name: a.name, initials: initials(a.name), detail: `${p.name} · ${plural(r.seats, "seat")} · due ${shortDate(r.dueAt)}` },
    planName: p.name,
    seats: r.seats,
    perSeat: p.perSeat,
    termLabel: "1 year",
    dueAt: r.dueAt,
    nextRenewalAt: next.toISOString(),
    planText: `${a.name} stays on ${p.name} with ${plural(r.seats, "seat")}`,
    priceText: `${money(r.amount)} a year from ${dateOnly(r.dueAt)}`,
    nextText: `Next renewal ${dateOnly(next.toISOString())}`,
    consequence: `${a.name}'s plan, seats and price update today, and the next renewal moves to ${dateOnly(next.toISOString())}. Nobody at the customer is emailed. You can undo this from the notice that follows.`,
  };
}

const ROLE_RANK: Record<string, number> = { admin: 0, manager: 1, agent: 2, viewer: 3 };

/** The team page: everyone on the desk, their load against capacity, and who's away or still invited. */
function teamPage(h: Foundry) {
  const load = (id: string) => h.tickets.filter((t) => t.assigneeId === id && isOpen(t)).length;
  const members = [...h.team]
    .sort((x, y) => ROLE_RANK[x.role] - ROLE_RANK[y.role] || x.joinedAt.localeCompare(y.joinedAt))
    .map((m) => {
      const open = load(m.id);
      const owned = h.accounts.filter((a) => a.ownerId === m.id && a.status === "active").length;
      const canHandover = open > 0 && m.status !== "invited";
      return {
        id: m.id,
        name: m.name,
        initials: initials(m.name),
        email: m.email,
        role: ROLES.find((r) => r.id === m.role)!.name,
        title: m.title,
        detail: `${m.title} · ${m.email}`,
        active: m.status === "active",
        away: m.status === "away",
        invited: m.status === "invited",
        awayLabel: m.status === "away" ? `Away${m.awayUntil ? ` until ${shortDate(m.awayUntil)}` : ""}` : "Away",
        invitedLabel: m.status === "invited" ? `Invited${m.invitedAt ? ` ${shortDate(m.invitedAt)}` : ""}` : "Invited",
        open,
        capacity: m.capacity,
        hasCapacity: m.capacity > 0,
        loadCaption: `${open} of ${m.capacity}`,
        owned,
        hasOwned: owned > 0,
        ownedText: plural(owned, "account"),
        canHandover,
        hasActions: canHandover || m.status === "invited",
        menuLabel: `Actions for ${m.name}`,
      };
    });
  const invited = members.filter((m) => m.invited).length;
  const onDesk = members.length - invited;
  return {
    summary: `${plural(onDesk, "person", "people")} on the desk${invited ? `, ${invited} invited` : ""} · ${plural(h.tickets.filter(isOpen).length, "open ticket")} between them`,
    count: members.length,
    members,
  };
}

/** The Overview tab of an account record: health, recent activity, the plan and the primary contact. */
function accountOverview(h: Foundry, slots: Record<string, unknown>) {
  const a = account(h, String(slots.account)) ?? h.accounts[0];
  const hs = health(h, a);
  const p = plan(h, a.plan);
  const weekly = a.weeklyActive.map((active, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() - 7 * (11 - i));
    return { week: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), active };
  });
  const first = weekly[0].active;
  const last = weekly[11].active;
  const chartSummary = last < first * 0.85 ? `Active seats fell from ${first} to ${last} over twelve weeks.` : last > first * 1.15 ? `Active seats rose from ${first} to ${last} over twelve weeks.` : `Active seats held steady around ${last} over twelve weeks.`;
  const recent = h.events
    .filter((e) => e.accountId === a.id)
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 6)
    .map((e) => ({ id: e.id, text: e.text, at: e.at, hasRef: Boolean(e.ref), ref: e.ref ?? null }));
  const contacts = h.contacts.filter((c) => c.accountId === a.id);
  const primary = contacts.find((c) => c.primary) ?? contacts[0];
  const canceled = a.status === "canceled";
  return {
    id: a.id,
    name: a.name,
    healthCaption: `Score ${hs.score} of 100, from seats in use, the support load and the renewal date`,
    weekly,
    chartSummary,
    seatsLine: `${first} → ${last} of ${a.seats} seats`,
    reasonsTitle: hs.positive ? "What's keeping the score up" : hs.label === "Healthy" ? "Worth watching, even so" : "What's pulling the score down",
    reasons: hs.reasons,
    recent,
    planName: `${p.name}, annual`,
    seatsText: `${a.seats} at ${money(p.perSeat)} each`,
    arr: a.arr,
    sla: p.sla,
    support: p.support,
    startedAt: a.startedAt,
    renewLabel: canceled ? "Access ends" : "Renews",
    renewalAt: a.renewalAt,
    region: a.region,
    hasContact: Boolean(primary),
    contact: primary ? { name: primary.name, detail: `${primary.role} · ${primary.email}` } : { name: "No contact yet", detail: "Added when someone at the customer writes in" },
    contactsLabel: `See all ${contacts.length} contacts`,
  };
}

/** Turn matched slot text into ids and numbers the views understand. */
export function resolveSlots(h: Foundry, slots: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const findAccount = (text: string) => {
    const q = text.toLowerCase().replace(/'s$/, "").trim();
    return h.accounts.find((a) => a.name.toLowerCase() === q) ?? h.accounts.find((a) => a.name.toLowerCase().startsWith(q)) ?? h.accounts.find((a) => a.name.toLowerCase().includes(q));
  };
  const findMember = (text: string) => {
    const q = text.toLowerCase().trim();
    return h.team.find((m) => m.name.toLowerCase().split(" ")[0] === q) ?? h.team.find((m) => m.name.toLowerCase().includes(q));
  };
  if (slots.account) {
    const a = findAccount(slots.account);
    if (a) out.account = a.id;
  }
  if (slots.days) out.days = { quarter: 90, month: 30 }[slots.days.toLowerCase()] ?? Number(slots.days);
  if (slots.emails) out.emails = slots.emails.split(/[,\s]+/).filter((s) => s.includes("@"));
  if (slots.health) out.health = [{ risk: "At risk", "at risk": "At risk", healthy: "Healthy", watch: "Watch" }[slots.health.toLowerCase()] ?? "At risk"];
  if (slots.plan) out.plan = slots.plan.toLowerCase();
  if (slots.plans) {
    const list = slots.plans.toLowerCase().match(/starter|growth|scale/g) ?? [];
    out.plans = [...new Set(list)];
  }
  if (slots.from) {
    const m = findMember(slots.from);
    if (m) out.from = m.id;
  }
  if (slots.to) {
    const m = findMember(slots.to);
    if (m) out.to = m.id;
  }
  if (slots.role) {
    const r = slots.role.toLowerCase().replace(/s$/, "");
    if (ROLES.some((x) => x.id === r)) out.role = r;
  }
  if (slots.seats) out.seats = Number(slots.seats);
  if (slots.discount) out.discount = Number(slots.discount);
  if (slots.refund) out.refund = /credit/i.test(slots.refund) ? "credit" : /no refund/i.test(slots.refund) ? "none" : "original";
  return out;
}

/** Build the surface's data from the intent's data map. */
export function surfaceData(h: Foundry, intent: Pick<IntentFile, "data" | "fill">, slots: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, source] of Object.entries(intent.data)) {
    if (typeof source === "string" && source.startsWith("view:")) out[key] = view(h, source.slice(5), slots);
    else if (typeof source === "string" && source.startsWith("/")) out[key] = structuredClone(source.split("/").slice(1).reduce<any>((o, k) => o?.[k], h));
    else out[key] = structuredClone(source);
  }
  for (const [slot, pointer] of Object.entries(intent.fill ?? {})) {
    if (slots[slot] === undefined) continue;
    const parts = pointer.split("/").slice(1);
    let o: any = out;
    for (const p of parts.slice(0, -1)) o = o[p] ??= {};
    o[parts.at(-1)!] = slots[slot];
  }
  return out;
}

/**
 * What changes in a surface's data when its inputs change: the filtered list under a FilterPanel,
 * the receipt beside a quote form. The host writes the result back into the surface, so the
 * numbers people see are always computed from the store, never from the document.
 */
export function live(h: Foundry, intentId: string, data: Record<string, any>): Record<string, unknown> | null {
  switch (intentId) {
    case "accounts.renewing-with-tickets": {
      const f = data.filters ?? {};
      return { results: renewingResults(h, { days: Number(f.days) || 30, health: Array.isArray(f.health) ? f.health : [], plans: Array.isArray(f.plans) ? f.plans : [] }) };
    }
    case "renewal.quote":
      return data.quote ? { receipt: quoteReceipt(h, data.quote) } : null;
    default:
      return null;
  }
}

export { ME };
