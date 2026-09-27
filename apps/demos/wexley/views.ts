import type { IntentFile } from "../kit/types.ts";
import { daysFromNow } from "../kit/store.ts";
import { BIN_NAMES, SLOT_NAMES, STAGE_NAMES, daysUntil, nextMarch, nextPaymentDay, nextWeekday, oneLine, openFine, planMonthly, repair, vehicleLine, zone, zoneForPostcode, zoneName, type Address, type AppealReason, type BinKind, type Wexley } from "./seed.ts";
import { date, dayDate, isoDay, money, ordinal, today } from "./format.ts";

/**
 * The data a surface binds to. An intent's `data` map names, per surface key, a `view:` computed
 * here, a JSON Pointer into Wexley's data, or a literal. Slots from the ask (a bin, a PCN number)
 * and from the surface before (a reviewed draft) steer the views. No React here: the snapshot and
 * verify scripts use it too.
 */
export function view(w: Wexley, name: string, slots: Record<string, unknown>): unknown {
  switch (name) {
    case "permit": {
      const p = w.permit;
      return { id: p.id, zone: p.zone, zoneName: zoneName(w, p.zone), registration: p.vehicle.registration, vehicleLine: vehicleLine(p), vehicleSentence: `Your permit is for a ${p.vehicle.colour.toLowerCase()} ${p.vehicle.make} ${p.vehicle.model}, ${p.vehicle.registration}.`, start: isoDay(p.start), expiry: isoDay(p.expiry), daysLeft: daysUntil(p.expiry), price: p.price, address: oneLine(p.address), addressSentence: `Your permit is at ${oneLine(p.address)} now.`, postcode: p.address.postcode };
    }
    case "addressDraft":
      return { line1: slots.line1 ?? "", line2: slots.line2 ?? "", town: slots.town ?? "Wexley", postcode: slots.postcode ?? "", moveDate: slots.moveDate ?? null, vehicleUnchanged: slots.vehicleUnchanged ?? true, step: slots.step ?? 0, today: today() };
    case "permitChange": {
      const d = w.drafts.permitChange;
      const address: Address = d?.address ?? { line1: String(slots.line1 ?? "3 Mill Street"), line2: String(slots.line2 ?? ""), town: String(slots.town ?? "Wexley"), postcode: String(slots.postcode ?? "WX1 2HD") };
      const moveDate = d?.moveDate ?? String(slots.moveDate ?? isoDay(daysFromNow(14)));
      const vehicleUnchanged = d?.vehicleUnchanged ?? Boolean(slots.vehicleUnchanged ?? true);
      const newZone = d?.zone ?? zoneForPostcode(w, address.postcode)?.id ?? w.permit.zone;
      const feeDifference = d?.feeDifference ?? feeDifferenceFor(w, newZone);
      const zoneChanged = newZone !== w.permit.zone;
      const label = feeDifference > 0 ? `Pay ${money(feeDifference)} and update` : "Update address";
      const consequence = [
        zoneChanged ? `Your permit moves to zone ${newZone} from ${date(moveDate)}, and no longer covers zone ${w.permit.zone}.` : `Your permit stays in zone ${w.permit.zone} and your new address goes on it from ${date(moveDate)}.`,
        feeDifference > 0 ? `We take ${money(feeDifference)} from the card you paid with last time.` : feeDifference < 0 ? `We refund ${money(-feeDifference)} to the card you paid with last time.` : "There is nothing to pay.",
        "You can change it back within 14 days.",
      ].join(" ");
      return { id: d?.id ?? "chg_sample", permitId: w.permit.id, addressLine: oneLine(address), postcode: address.postcode, moveDate, vehicleUnchanged, vehicleLine: vehicleLine(w.permit), vehicleText: vehicleUnchanged ? vehicleLine(w.permit) : "A different vehicle (we will write to you)", oldZone: w.permit.zone, newZone, zoneName: zoneName(w, newZone), oldZoneName: zoneName(w, w.permit.zone), zoneChanged, feeDifference, label, consequence };
    }
    case "permitRenewal": {
      const p = w.permit;
      const newExpiry = new Date(p.expiry);
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);
      const price = zone(w, p.zone).price;
      return { permitId: p.id, zoneName: zoneName(w, p.zone), registration: p.vehicle.registration, vehicleLine: vehicleLine(p), currentExpiry: isoDay(p.expiry), newExpiry: isoDay(newExpiry.toISOString()), price, label: `Pay ${money(price)}`, consequence: `We take ${money(price)} from the card you paid with last time. The new permit starts when this one ends, on ${date(p.expiry)}. You can cancel within 14 days for a full refund.` };
    }

    case "fine": {
      const f = w.fines.find((x) => x.id === slots.fine) ?? openFine(w);
      return { id: f.id, number: f.number, issued: isoDay(f.issued), location: f.location, contravention: f.contravention, amount: f.amount, discountAmount: f.discountAmount, discountUntil: f.discountUntil, chargeText: `${money(f.amount)}, or ${money(f.discountAmount)} if you pay by ${date(f.discountUntil)}`, registration: w.permit.vehicle.registration, statusLabel: FINE_STATUS[f.status] };
    }
    case "appealDraft": {
      const f = w.fines.find((x) => x.id === slots.fine) ?? openFine(w);
      return { fineId: f.id, pcn: f.number, reason: slots.reason ?? null, explanation: slots.explanation ?? "", evidence: [] };
    }
    case "appealReview": {
      const d = w.drafts.appeal;
      const f = w.fines.find((x) => x.id === (d?.fineId ?? slots.fine)) ?? openFine(w);
      const reason = (d?.reason ?? String(slots.reason ?? "signs-unclear")) as AppealReason;
      const evidence = d?.evidence ?? (Array.isArray(slots.evidence) ? (slots.evidence as { name: string; size: number }[]) : []);
      return { id: d?.id ?? "apl_sample", fineId: f.id, pcn: f.number, location: f.location, issued: isoDay(f.issued), amount: f.amount, discountAmount: f.discountAmount, reasonLabel: REASONS[reason], explanation: d?.explanation ?? String(slots.explanation ?? "").trim(), evidenceText: evidence.length ? evidence.map((e) => e.name).join(", ") : "None", evidenceCount: evidence.length, decideBy: isoDay(daysFromNow(14, 17)) };
    }

    case "repair": {
      const r = repair(w, String(slots.repair ?? "")) ?? w.repairs.find((x) => x.stage < 3) ?? w.repairs[0];
      const a = r.appointment;
      const status = (i: number) => (r.stage > i || r.stage === 3 ? "done" : r.stage === i ? "inProgress" : "todo");
      const appointmentLine = a ? `${dayDate(a.date)}, ${SLOT_NAMES[a.slot]}` : "Not booked yet";
      const headline = r.stage === 3 ? `Fixed on ${date(r.fixedOn ?? r.reported)}` : a ? `${a.who} is coming on ${dayDate(a.date)}, between ${SLOT_NAMES[a.slot].replace(" to ", " and ")}` : "We are looking at your report";
      return {
        id: r.id,
        reference: r.reference,
        problem: r.problem,
        where: r.where,
        reported: isoDay(r.reported),
        stage: r.stage,
        stageLabel: STAGE_NAMES[r.stage],
        priorityLabel: PRIORITY[r.priority],
        headline,
        headlineDetail: r.stage === 3 ? "Nothing more to do. If the problem comes back, report it again." : a ? "Someone over 18 needs to be at home to let them in. If the time does not suit you, rebook the visit." : "We reply within 2 working days.",
        progress: [
          { stage: "Reported", status: STATUS_LABEL[status(0)], detail: `You reported this on ${date(r.reported)}.` },
          { stage: "Assessed", status: STATUS_LABEL[status(1)], detail: r.stage >= 1 ? `We looked at it and made it a ${PRIORITY[r.priority].toLowerCase()} repair.` : "We look at every report within 2 working days." },
          { stage: "Appointment booked", status: STATUS_LABEL[status(2)], detail: a ? `Booked for ${appointmentLine}.` : "We book a visit once the repair is assessed." },
          { stage: "Fixed", status: STATUS_LABEL[status(3)], detail: r.stage === 3 ? `Fixed on ${date(r.fixedOn ?? r.reported)}.` : "We mark the repair fixed after the visit." },
        ],
        hasAppointment: Boolean(a),
        appointment: { date: isoDay(a?.date ?? r.reported), slotLabel: a ? SLOT_NAMES[a.slot] : "Not booked yet", who: a?.who ?? "Not booked yet", line: appointmentLine },
      };
    }
    case "rebookDraft": {
      const r = repair(w, String(slots.repair ?? "")) ?? w.repairs.find((x) => x.stage < 3) ?? w.repairs[0];
      return { repairId: r.id, date: slots.date ?? null, slot: slots.slot ?? null, minDate: isoDay(daysFromNow(2)), maxDate: isoDay(daysFromNow(28)), help: `Pick a weekday in the next 4 weeks. The visit is currently ${r.appointment ? `${dayDate(r.appointment.date)}, ${SLOT_NAMES[r.appointment.slot]}` : "not booked"}.` };
    }

    case "councilTax": {
      const t = w.councilTax;
      const remaining = Math.round((t.annual - t.paid) * 100) / 100;
      const next = nextPaymentDay(t.plan.day);
      return { account: t.account, band: t.band, annual: t.annual, paid: t.paid, remaining, monthly: t.plan.monthly, planText: `${t.plan.count} instalments by ${METHODS[t.plan.method]} on the ${ordinal(t.plan.day)}`, nextPayment: isoDay(next), nextAmount: Math.min(t.plan.monthly, remaining) };
    }
    case "instalmentDraft": {
      const t = w.councilTax;
      const count = Number(slots.count ?? t.plan.count);
      return {
        count: count === 12 ? 12 : 10,
        day: slots.day ?? t.plan.day,
        method: slots.method ?? t.plan.method,
        countOptions: [
          { value: 10, label: "10 instalments", description: `${money(planMonthly(w, 10))} a month, with February and March free` },
          { value: 12, label: "12 instalments", description: `${money(planMonthly(w, 12))} a month, all year round` },
        ],
        dayOptions: [1, 15, 28].map((d) => ({ value: d, label: `The ${ordinal(d)} of the month`, description: `First payment ${date(nextPaymentDay(d))}` })),
      };
    }
    case "instalmentQuote": {
      const q = w.drafts.instalmentQuote;
      const count = (q?.count ?? (Number(slots.count) === 12 ? 12 : 10)) as 10 | 12;
      const day = (q?.day ?? Number(slots.day ?? 1)) as 1 | 15 | 28;
      const method = q?.method ?? ((slots.method as "direct-debit" | "card") ?? "direct-debit");
      const monthly = q?.monthly ?? planMonthly(w, count);
      const first = q?.firstPayment ?? nextPaymentDay(day);
      const last = q?.lastPayment ?? lastPaymentFrom(first, count);
      const total = Math.round((w.councilTax.annual - w.councilTax.paid) * 100) / 100;
      return { id: q?.id ?? "plan_sample", count, day, dayLabel: `The ${ordinal(day)} of the month`, method, methodLabel: METHODS[method], monthly, firstPayment: isoDay(first), lastPayment: isoDay(last), total, label: `Pay ${money(monthly)} a month`, consequence: `Your current plan ends today and this one starts on ${date(first)}. We post a new bill within 5 working days showing every payment. You can change the plan again at any time.` };
    }

    case "bins": {
      const b = w.bins;
      const options = (["refuse", "recycling", "garden", "food"] as BinKind[]).filter((k) => k !== "garden" || b.garden.subscribed).map((k) => ({ id: k, label: BIN_NAMES[k], description: `Last collected ${dayDate(b.lastCollected[k])}` }));
      return { options, refuseNext: b.refuse.next, recyclingNext: b.recycling.next, gardenNext: b.garden.next };
    }
    case "missedDraft":
      return { bin: slots.bin ?? null, date: slots.date ?? isoDay(w.bins.lastCollected.refuse), wasOut: true, minDate: isoDay(daysFromNow(-14)), maxDate: today() };
    case "missedInfo":
      return { title: "We come back within 2 working days", message: "If the bin was out by 6am on collection day, we collect it again without you needing to do anything else. If it was not, it is collected on the next normal day." };

    case "benefitClaim": {
      const c = w.benefit;
      const item = (id: string) => c.evidence.find((e) => e.id === id)!;
      const ev = (id: string) => {
        const e = item(id);
        return { id: e.id, what: e.what, why: e.why, status: e.status, missing: e.status === "todo", text: e.status === "done" ? `We have this. Received ${date(e.receivedAt ?? c.submitted)}.` : e.why, files: e.status === "done" ? e.files : [], fileNames: e.files.map((f) => f.name).join(", ") || "None yet" };
      };
      const todo = c.evidence.filter((e) => e.status === "todo").length;
      return {
        reference: c.reference,
        type: c.type,
        submitted: isoDay(c.submitted),
        statusLabel: BENEFIT_STATUS[c.status],
        weeklyEstimate: c.weeklyEstimate,
        deadline: isoDay(c.deadline),
        todoCount: todo,
        deadlineTitle: todo ? `Send ${todo === 1 ? "the missing document" : `the ${todo} missing documents`} by ${dayDate(c.deadline)}` : "We have everything we need",
        deadlineMessage: todo ? "If we do not get them by then, we decide your claim on what we have, and it may be refused. Photos of paper documents are fine." : "We are working out your claim. You hear from us within 14 days.",
        anyMissing: todo > 0,
        rows: c.evidence.map((e) => ({ id: e.id, what: e.what, status: e.status === "done" ? "Received" : "Needed", detail: e.status === "done" ? `${e.files.map((f) => f.name).join(", ")}, received ${date(e.receivedAt ?? c.submitted)}` : e.why })),
        evidence: { identity: ev("identity"), tenancy: ev("tenancy"), payslips: ev("payslips"), bank: ev("bank") },
        upload: { payslips: [], bank: [] },
      };
    }

    /* ---- The authored screens: the same views, for pages a person wrote rather than asked for ---- */

    case "councilTaxScreen": {
      const t = w.councilTax;
      const remaining = Math.round((t.annual - t.paid) * 100) / 100;
      const pct = Math.round((t.paid / t.annual) * 100);
      const next = nextPaymentDay(t.plan.day);
      const nextAmount = Math.min(t.plan.monthly, remaining);
      return {
        account: t.account,
        property: `${w.resident.address.line1}, ${w.resident.address.postcode}`,
        band: t.band,
        bandTitle: `About band ${t.band}`,
        annual: t.annual,
        paid: t.paid,
        paidCaption: `${pct}% of the charge for the year`,
        remaining,
        remainingCaption: `Next payment ${money(nextAmount)} on ${date(next)}`,
        planText: `${t.plan.count} instalments of ${money(t.plan.monthly)} by ${METHODS[t.plan.method]} on the ${ordinal(t.plan.day)}`,
        nextPaymentText: `${money(nextAmount)} on ${date(next)}`,
        statements: t.statements.map((s) => ({ id: s.id, date: isoDay(s.date), description: s.description, amount: s.amount })),
      };
    }
    case "binsScreen": {
      const b = w.bins;
      const usually = (k: BinKind) => (k === "refuse" || k === "food" ? `Every ${b.refuse.day}` : k === "recycling" ? b.recycling.day : b.garden.day);
      const next = [
        { kind: "refuse" as BinKind, when: b.refuse.next },
        { kind: "recycling" as BinKind, when: b.recycling.next },
        ...(b.garden.subscribed ? [{ kind: "garden" as BinKind, when: b.garden.next }] : []),
        { kind: "food" as BinKind, when: b.refuse.next },
      ]
        .sort((x, y) => x.when.localeCompare(y.when))
        .map((n) => ({ id: n.kind, bin: BIN_NAMES[n.kind], next: dayDate(n.when), usually: usually(n.kind) }));
      const missed = b.missed.map((m) => ({
        id: m.id,
        bin: BIN_NAMES[m.bin],
        what: m.wasOut ? `We come back by ${dayDate(m.collectBy)}. Leave the bin out.` : "It is collected on the next normal day.",
        status: m.status === "open" ? "Reported" : "Collected",
        open: m.status === "open",
      }));
      const requests = b.requests.map((r) => ({ id: r.id, bin: BIN_NAMES[r.bin], reason: r.reason, asked: isoDay(r.at), status: r.status === "requested" ? "Requested" : "Delivered" }));
      return {
        address: w.resident.address.line1,
        next,
        hasMissed: missed.length > 0,
        missed,
        hasRequests: requests.length > 0,
        requests,
        gardenSubscribed: b.garden.subscribed,
        gardenNotSubscribed: !b.garden.subscribed,
        gardenText: b.garden.subscribed
          ? `Your green bin subscription runs until ${date(b.garden.renewsOn)}. It costs ${money(b.garden.price, { whole: true })} a year and we collect it on ${b.garden.day}.`
          : `You do not have a garden waste subscription. It costs ${money(b.garden.price, { whole: true })} a year for a green bin collected every other week.`,
        whatGoesWhere: ["Blue bin: paper, card, tins, plastic bottles and pots, glass", "Black bin: everything that cannot be recycled", "Food caddy: all food, cooked or raw", "Green bin: grass, leaves, small branches"],
      };
    }
    case "gardenCancel": {
      const g = w.bins.garden;
      return {
        price: g.price,
        runsUntil: isoDay(g.renewsOn),
        day: g.day,
        nextCollection: isoDay(g.next),
        label: "Cancel garden waste",
        consequence: `We stop collecting your green bin from today and take it away on ${dayDate(g.next)}. There is no refund for the rest of the year. You can subscribe again at any time for ${money(g.price, { whole: true })}.`,
      };
    }
    case "gardenSubscribe": {
      const g = w.bins.garden;
      const first = nextWeekday(3, 2);
      return {
        price: g.price,
        day: "Wednesday, every other week",
        firstCollection: isoDay(first),
        runsUntil: isoDay(nextMarch()),
        label: `Pay ${money(g.price, { whole: true })} and subscribe`,
        consequence: `We take ${money(g.price, { whole: true })} from the card you paid with last time and deliver a green bin within 10 working days. The first collection is ${dayDate(first)}, and the subscription runs until ${date(nextMarch())}. You can cancel within 14 days for a full refund.`,
      };
    }
    case "benefitScreen": {
      const claim = view(w, "benefitClaim", slots) as Record<string, any>;
      const c = w.benefit;
      const evidence = Object.fromEntries(Object.entries(claim.evidence as Record<string, { status: string }>).map(([k, e]) => [k, { ...e, taskStatus: e.status === "done" ? "done" : "todo" }]));
      return {
        ...claim,
        evidence,
        allSent: !claim.anyMissing,
        estimateText: `About ${money(c.weeklyEstimate)} a week, once we have checked your income`,
        paidTo: "Your rent account with Wexley Homes, every 4 weeks",
        sendLabel: claim.anyMissing ? "Send documents" : "See what we have",
      };
    }
    default:
      throw new Error(`Unknown view ${name}`);
  }
}

export const REASONS: Record<AppealReason, string> = { "signs-unclear": "The signs were unclear", "permit-valid": "My permit was valid", loading: "I was loading or unloading", "vehicle-sold": "The vehicle had been sold", other: "Something else" };
export const METHODS = { "direct-debit": "Direct Debit", card: "Card, each month" } as const;
const FINE_STATUS = { issued: "To pay", appealed: "Appeal in progress", paid: "Paid", cancelled: "Cancelled" } as const;
const PRIORITY = { emergency: "Emergency", urgent: "Urgent", routine: "Routine" } as const;
const STATUS_LABEL = { done: "Completed", inProgress: "In progress", todo: "Not yet" } as const;
export const BENEFIT_STATUS = { "awaiting-evidence": "Waiting for your documents", assessing: "Being assessed", decided: "Decided" } as const;

/** The difference for the rest of the permit's year when it moves to another zone: negative is a refund. */
export function feeDifferenceFor(w: Wexley, newZone: string): number {
  const daysLeft = Math.max(0, daysUntil(w.permit.expiry));
  const diff = ((zone(w, newZone).price - zone(w, w.permit.zone).price) * daysLeft) / 365;
  return Math.round(diff * 100) / 100;
}

export function lastPaymentFrom(first: string, count: number): string {
  const d = new Date(first);
  d.setMonth(d.getMonth() + count - 1);
  return d.toISOString();
}

/** Turn matched slot text into ids and values the views understand. */
export function resolveSlots(w: Wexley, slots: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (slots.pcn) {
    const f = w.fines.find((x) => x.number.toLowerCase() === slots.pcn.toLowerCase().replace(/\s+/g, ""));
    if (f) out.fine = f.id;
  }
  if (slots.bin) {
    const q = slots.bin.toLowerCase();
    const alias: [string, BinKind][] = [
      ["recycl", "recycling"],
      ["blue", "recycling"],
      ["garden", "garden"],
      ["green", "garden"],
      ["food", "food"],
      ["caddy", "food"],
      ["refuse", "refuse"],
      ["black", "refuse"],
      ["rubbish", "refuse"],
      ["general", "refuse"],
    ];
    const hit = alias.find(([k]) => q.includes(k));
    if (hit) out.bin = hit[1];
  }
  if (slots.count) out.count = Number(slots.count);
  return out;
}

/** Build the surface's data from the intent's data map. */
export function surfaceData(w: Wexley, intent: Pick<IntentFile, "data" | "fill">, slots: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, source] of Object.entries(intent.data)) {
    if (typeof source === "string" && source.startsWith("view:")) out[key] = view(w, source.slice(5), slots);
    else if (typeof source === "string" && source.startsWith("/")) out[key] = structuredClone(source.split("/").slice(1).reduce<any>((o, k) => o?.[k], w));
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
