import type { ActionEvent } from "@polyxd/react";
import { daysFromNow, type Store, type Undo } from "../kit/store.ts";
import { PLANS, ROLES, account, annualPrice, member, plan, type Foundry, type PlanId, type Role } from "./seed.ts";
import { dateOnly, money, plural } from "./format.ts";

/**
 * What Foundry does when a generated surface asks for a capability. Every action changes the data
 * for real (the screens after it show the change); reversible ones offer Undo; consequential ones
 * only arrive here from a confirmation, because the registry says so and the verifier checked.
 */
export interface Outcome {
  /** Text for the toast. */
  say?: string;
  undo?: Undo;
  /** Open another surface next (a review step, a confirmation) with these slots. */
  next?: { intent: string; slots?: Record<string, unknown> };
  /** Go to a screen of the product. */
  go?: string;
  /** Close the surface. */
  close?: boolean;
}

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export function runAction(store: Store<Foundry>, e: ActionEvent): Outcome {
  const h = store.get();
  const c = e.context as Record<string, any>;
  switch (e.name) {
    case "account.open":
      return { go: `/accounts/${c.id}`, close: true };
    case "account.tickets":
      return { go: `/accounts/${c.id}/tickets`, close: true };
    case "ticket.open":
      return { go: `/tickets/${c.id}`, close: true };
    case "account.timeline":
      return { go: `/accounts/${c.id}/timeline`, close: true };
    case "account.contacts":
      return { go: `/accounts/${c.id}/contacts`, close: true };

    // Buttons on the authored screens that are an ask in disguise: they open an intent.
    case "accounts.renewingWithTickets":
      return { next: { intent: "accounts.renewing-with-tickets", slots: { days: Number(c.days) || 30 } } };
    case "renewal.quote": {
      const a = account(h, c.accountId);
      if (!a || a.status === "canceled") return { say: "That account isn't on a plan." };
      return { next: { intent: "renewal.quote", slots: { account: a.id } } };
    }
    case "renewal.requote": {
      const a = account(h, c.accountId);
      if (!a || a.status === "canceled") return { say: "That account isn't on a plan." };
      return { next: { intent: "renewal.quote", slots: { account: a.id, seats: Number(c.seats) || a.seats, plan: PLANS.some((p) => p.id === c.plan) ? c.plan : a.plan } } };
    }
    case "team.invite":
      return { next: { intent: "team.invite", slots: {} } };
    case "member.handover": {
      const m = member(h, c.id);
      if (!m) return { say: "Choose who's handing over first." };
      return { next: { intent: "tickets.reassign", slots: { from: m.id } } };
    }

    case "renewal.win": {
      const r = h.renewals.find((x) => x.id === c.id);
      if (!r) return { say: "That renewal isn't here any more." };
      if (r.stage === "won") return { say: `${account(h, r.accountId)?.name ?? "That account"} already renewed.` };
      if (r.stage === "churned") return { say: `${account(h, r.accountId)?.name ?? "That account"} canceled; there's nothing to win.` };
      return { next: { intent: "renewal.won.confirm", slots: { renewal: r.id } } };
    }
    case "renewal.markWon": {
      const r = h.renewals.find((x) => x.id === c.id);
      const a = r && account(h, r.accountId);
      if (!r || !a || r.stage === "won" || r.stage === "churned") return { say: "That renewal can't be marked won." };
      const next = new Date(r.dueAt);
      next.setFullYear(next.getFullYear() + 1);
      const undo = store.commit(`Won ${a.name}`, (d) => {
        const rn = d.renewals.find((x) => x.id === r.id)!;
        rn.stage = "won";
        rn.movedAt = now();
        const acc = d.accounts.find((x) => x.id === a.id)!;
        acc.renewalAt = next.toISOString();
        acc.seats = rn.seats;
        acc.plan = rn.plan;
        acc.arr = rn.amount;
        d.events.push({ id: uid("ev"), accountId: acc.id, at: now(), kind: "renewal", text: `Renewed for a year on ${plan(d, rn.plan).name}: ${money(rn.amount)}` });
      });
      return { say: `${a.name} renewed: ${money(r.amount)} a year. Next renewal ${dateOnly(next.toISOString())}.`, undo, close: true, go: "/renewals" };
    }
    case "invite.withdraw": {
      const m = member(h, c.id);
      if (!m) return {};
      if (m.status !== "invited") return { say: `${m.name} is already on the desk; invitations are withdrawn, not people.` };
      const undo = store.commit(`Withdraw ${m.name}`, (d) => {
        d.team = d.team.filter((x) => x.id !== m.id);
      });
      return { say: `${m.name}'s invitation withdrawn.`, undo };
    }

    case "cancellation.review": {
      const a = account(h, c.accountId);
      if (!a) return { say: "Choose the account first." };
      if (a.status === "canceled") return { say: `${a.name}'s plan is already canceled.` };
      return { next: { intent: "subscription.cancel.confirm", slots: { account: a.id, effectiveAt: c.effectiveAt || undefined, refundMethod: c.refundMethod || "original" } } };
    }
    case "subscription.cancel": {
      const a = account(h, c.accountId);
      if (!a || a.status === "canceled") return { say: "That account isn't on a plan." };
      const effective = c.effectiveAt ? new Date(c.effectiveAt).toISOString() : now();
      store.commit(`Cancel ${a.name}`, (d) => {
        const acc = d.accounts.find((x) => x.id === a.id)!;
        acc.status = "canceled";
        acc.canceledAt = now();
        const r = d.renewals.find((x) => x.accountId === a.id && (x.stage === "upcoming" || x.stage === "quoted"));
        if (r) {
          r.stage = "churned";
          r.movedAt = now();
        } else d.renewals.push({ id: uid("rn"), accountId: a.id, stage: "churned", dueAt: a.renewalAt, seats: a.seats, plan: a.plan, amount: a.arr, movedAt: now() });
        d.events.push({ id: uid("ev"), accountId: a.id, at: now(), kind: "canceled", text: `Plan canceled, effective ${dateOnly(effective)}; refund to ${String(c.refundMethod) === "credit" ? "account credit" : String(c.refundMethod) === "none" ? "nobody (no refund)" : "the original payment method"}` });
      });
      return { say: `${a.name}'s plan is canceled from ${dateOnly(effective)}. The billing contact has been emailed.`, close: true, go: `/accounts/${a.id}` };
    }

    case "plan.review": {
      const a = account(h, c.accountId);
      const p = PLANS.find((x) => x.id === c.plan);
      if (!a || !p) return { say: "Choose a plan first." };
      if (p.id === a.plan) return { say: `${a.name} is already on ${p.name}.` };
      return { next: { intent: "plan.change.confirm", slots: { account: a.id, plan: p.id } } };
    }
    case "plan.change": {
      const a = account(h, c.accountId);
      const p = PLANS.find((x) => x.id === c.plan);
      if (!a || !p) return { say: "Choose a plan first." };
      const from = plan(h, a.plan);
      const seats = Math.max(p.minSeats, a.seats);
      store.commit(`Move ${a.name} to ${p.name}`, (d) => {
        const acc = d.accounts.find((x) => x.id === a.id)!;
        acc.plan = p.id as PlanId;
        acc.seats = seats;
        acc.arr = annualPrice(p, seats);
        for (const r of d.renewals) if (r.accountId === a.id && (r.stage === "upcoming" || r.stage === "quoted")) (r.plan = p.id as PlanId), (r.seats = seats), (r.amount = acc.arr);
        d.events.push({ id: uid("ev"), accountId: a.id, at: now(), kind: "plan", text: `Moved from ${from.name} to ${p.name}${seats !== a.seats ? `, ${seats} seats` : ""}` });
      });
      return { say: `${a.name} is on ${p.name} from today: ${money(annualPrice(p, seats))} a year at renewal.`, close: true, go: `/accounts/${a.id}` };
    }

    case "tickets.assign": {
      const ids: string[] = Array.isArray(c.ticketIds) ? c.ticketIds : [];
      const to = member(h, c.assigneeId);
      if (!ids.length) return { say: "Select at least one ticket." };
      if (!to) return { say: "Choose who takes them." };
      const changed = h.tickets.filter((t) => ids.includes(t.id) && t.assigneeId !== to.id);
      if (!changed.length) return { say: `${to.name.split(" ")[0]} already has ${ids.length === 1 ? "that ticket" : "those tickets"}.`, close: true };
      const undo = store.commit(`Reassign ${changed.length} tickets`, (d) => {
        for (const t of d.tickets) {
          if (!ids.includes(t.id)) continue;
          t.assigneeId = to.id;
          t.updatedAt = now();
        }
      });
      return { say: `${plural(changed.length, "ticket")} now with ${to.name.split(" ")[0]}.`, undo, close: true, go: "/tickets?view=all" };
    }

    case "member.invite": {
      const emails = (Array.isArray(c.emails) ? c.emails : String(c.emails ?? "").split(/[,\s]+/)).map((s: string) => s.trim().toLowerCase()).filter((s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
      const role = (ROLES.some((r) => r.id === c.role) ? c.role : "viewer") as Role;
      if (!emails.length) return { say: "Enter at least one email address." };
      const fresh = emails.filter((email: string) => !h.team.some((m) => m.email === email));
      if (!fresh.length) return { say: `${emails.length === 1 ? "That person is" : "They're"} already on the team.` };
      const roleName = ROLES.find((r) => r.id === role)!.name.toLowerCase();
      const undo = store.commit(`Invite ${fresh.length}`, (d) => {
        for (const email of fresh) d.team.push({ id: uid("m"), name: nameFromEmail(email), email, role, title: `Invited as ${roleName}`, status: "invited", capacity: role === "viewer" ? 0 : 10, joinedAt: now(), invitedAt: now(), welcomed: c.sendWelcome !== false });
      });
      return { say: `Invited ${plural(fresh.length, "person", "people")} as ${roleName}${fresh.length === 1 ? "" : "s"}${c.sendWelcome === false ? "" : "; welcome emails are on their way"}.`, undo, close: true, go: "/team" };
    }
    case "member.remove": {
      const m = member(h, c.id);
      if (!m) return {};
      const undo = store.commit(`Remove ${m.name}`, (d) => {
        d.team = d.team.filter((x) => x.id !== m.id);
      });
      return { say: `Removed ${m.name}.`, undo };
    }

    case "renewal.review": {
      const a = account(h, c.accountId);
      const p = PLANS.find((x) => x.id === c.plan) ?? (a && plan(h, a.plan));
      if (!a || !p) return { say: "Choose the account and plan first." };
      const seats = Math.max(p.minSeats, Math.floor(Number(c.seats) || 0));
      const discount = Math.min(30, Math.max(0, Number(c.discount) || 0));
      const term = [12, 24, 36].includes(Number(c.termMonths)) ? Number(c.termMonths) : 12;
      const subtotal = seats * p.perSeat * (term / 12);
      const discountAmount = Math.round((subtotal * discount) / 100);
      const id = uid("q");
      store.commit("Draft quote", (d) => {
        let r = d.renewals.find((x) => x.accountId === a.id && (x.stage === "upcoming" || x.stage === "quoted"));
        if (!r) {
          r = { id: uid("rn"), accountId: a.id, stage: "upcoming", dueAt: a.renewalAt, seats: a.seats, plan: a.plan, amount: a.arr, movedAt: now() };
          d.renewals.push(r);
        }
        d.quotes = d.quotes.filter((q) => q.sentAt);
        d.quotes.push({ id, accountId: a.id, renewalId: r.id, plan: p.id, seats, discount, termMonths: term, perSeat: p.perSeat, subtotal, discountAmount, total: subtotal - discountAmount, madeAt: now(), validUntil: daysFromNow(30, 17) });
      });
      return { next: { intent: "renewal.quote.confirm", slots: { account: a.id, quote: id } } };
    }
    case "renewal.quote.send": {
      const q = h.quotes.find((x) => x.id === c.quoteId);
      const a = q && account(h, q.accountId);
      if (!q || !a) return { say: "That quote needs reviewing again." };
      const contact = h.contacts.find((x) => x.accountId === a.id && x.role === "Billing contact") ?? h.contacts.find((x) => x.accountId === a.id && x.primary);
      store.commit(`Send quote to ${a.name}`, (d) => {
        const quote = d.quotes.find((x) => x.id === q.id)!;
        quote.sentAt = now();
        const r = d.renewals.find((x) => x.id === q.renewalId);
        if (r) {
          r.stage = "quoted";
          r.quoteId = q.id;
          r.seats = q.seats;
          r.plan = q.plan;
          r.amount = q.total / (q.termMonths / 12);
          r.movedAt = now();
        }
        d.events.push({ id: uid("ev"), accountId: a.id, at: now(), kind: "quote", text: `Renewal quote sent to ${contact?.name ?? "the billing contact"}: ${q.seats} seats on ${PLANS.find((p) => p.id === q.plan)!.name}${q.discount ? `, ${q.discount}% off` : ""}, ${money(q.total)}` });
      });
      return { say: `Quote sent to ${contact?.name ?? a.name}: ${money(q.total)}. The renewal is now Quoted.`, close: true, go: "/renewals" };
    }
    default:
      return { say: `Foundry can't do "${e.name}" yet.` };
  }
}

/** "dana.okafor@…" → "Dana Okafor", until they sign in and set their own. */
function nameFromEmail(email: string): string {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
