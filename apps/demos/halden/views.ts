import type { IntentFile } from "../kit/types.ts";
import { balance, category, lastMonth, monthKey, monthName, spendByCategory, spent, spentToDay, thisMonth, type Halden, type Payment } from "./seed.ts";
import { dayLabel, money, time } from "./format.ts";

/**
 * The data a surface binds to. An intent's `data` map names, per surface key, a `view:` computed
 * here, a JSON Pointer into Halden's data, or a literal. Slots from the ask (an amount, a payee)
 * steer the views and pre-fill drafts. No React here: the snapshot and verify scripts use it too.
 */
export function view(h: Halden, name: string, slots: Record<string, unknown>): unknown {
  const month = thisMonth();
  const prev = lastMonth();
  const today = new Date().getDate();
  switch (name) {
    case "balance":
      return { amount: balance(h), currency: "GBP", asOf: new Date().toISOString() };

    case "categorySpend": {
      const id = String(slots.category ?? "eating-out");
      const cat = category(h, id);
      const payments = h.payments
        .filter((p) => p.category === id && p.amount < 0 && p.at.slice(0, 7) <= month && new Date(p.at).getMonth() === new Date().getMonth())
        .sort((a, b) => b.at.localeCompare(a.at))
        .map((p) => paymentRow(h, p));
      const total = spent(h, month, id);
      const previous = spentToDay(h, prev, today, id);
      const budget = h.budgets.find((b) => b.category === id);
      return {
        id,
        name: cat.name,
        heading: `${cat.name} in ${monthName(month)}`,
        spentLabel: `Spent in ${monthName(month)}`,
        previousLabel: `By this day in ${monthName(prev)}`,
        total,
        previous,
        changeVsPrevious: previous ? Math.round(((total - previous) / previous) * 1000) / 1000 : null,
        count: payments.length,
        payments,
        hasBudget: Boolean(budget),
        budget: budget?.limit ?? null,
        left: budget ? Math.max(0, Math.round((budget.limit - total) * 100) / 100) : null,
      };
    }

    case "suspectPayments": {
      // Pairs of same merchant, same amount, within an hour: what a double charge looks like.
      const out: (ReturnType<typeof paymentRow> & { duplicateOf?: string; firstAt?: string })[] = [];
      const recent = h.payments.filter((p) => p.amount < 0 && p.card && p.status === "settled").slice(-80);
      for (let i = 1; i < recent.length; i++) {
        const a = recent[i - 1];
        const b = recent[i];
        if (a.merchantId && a.merchantId === b.merchantId && a.amount === b.amount && Math.abs(new Date(b.at).getTime() - new Date(a.at).getTime()) < 3600000) out.push({ ...paymentRow(h, b), duplicateOf: a.id, firstAt: a.at });
      }
      const rows: typeof out = out.length ? out : recent.slice(-6).reverse().map((p) => paymentRow(h, p));
      const wanted = slots.merchant ? String(slots.merchant) : null;
      const byMerchant = wanted ? rows.filter((r) => r.merchantId === wanted) : rows;
      return (byMerchant.length ? byMerchant : rows).map((r) => ({ ...r, label: `${r.name} · ${money(-(r.amount as number))}`, detail: `${dayLabel(r.at as string)} at ${time(r.at as string)}${r.duplicateOf ? " · charged twice" : ""}` }));
    }
    case "disputeDraft": {
      const suspects = view(h, "suspectPayments", slots) as { id: string }[];
      return { paymentId: slots.payment ?? suspects[0]?.id ?? null, reason: slots.reason ?? "duplicate", note: "" };
    }
    case "disputeReview": {
      const p = h.payments.find((x) => x.id === slots.payment) ?? h.payments.filter((x) => x.amount < 0 && x.card).at(-1)!;
      const reason = String(slots.reason ?? "duplicate");
      return { paymentId: p.id, reason, reasonLabel: REASONS[reason] ?? reason, note: String(slots.note ?? "").trim() || "None", amount: -p.amount, payment: paymentRow(h, p) };
    }

    case "subscriptions":
      return h.subscriptions
        .map((s) => subscriptionRow(h, s))
        .sort((a, b) => Number(b.active) - Number(a.active) || b.monthly - a.monthly);
    case "subscriptionsTotal": {
      const active = h.subscriptions.filter((s) => s.active);
      return { monthly: Math.round(active.reduce((t, s) => t + (s.cadence === "monthly" ? s.amount : s.amount / 12), 0) * 100) / 100, yearly: Math.round(active.reduce((t, s) => t + (s.cadence === "monthly" ? s.amount * 12 : s.amount), 0) * 100) / 100, count: active.length };
    }
    case "subscription": {
      const s = h.subscriptions.find((x) => x.id === slots.subscription) ?? h.subscriptions[0];
      return subscriptionRow(h, s);
    }

    case "budgets":
      return h.categories
        .filter((c) => !["income", "transfers", "rent"].includes(c.id))
        .map((c) => {
          const b = h.budgets.find((x) => x.category === c.id);
          return { category: c.id, name: c.name, limit: b?.limit ?? null, spent: spent(h, month, c.id) };
        });
    case "budgetDraft": {
      const id = String(slots.category ?? "coffee");
      const b = h.budgets.find((x) => x.category === id);
      return { category: id, name: category(h, id).name, current: b?.limit ?? null, limit: slots.amount ?? b?.limit ?? null, spentThisMonth: spent(h, month, id), lastMonth: spent(h, prev, id), month: monthName(month), previousMonth: monthName(prev) };
    }

    case "card": {
      const lastUsed = h.payments.filter((p) => p.card).at(-1);
      return { ...h.card, number: `${h.card.network} ··${h.card.last4}`, active: !h.card.frozen, statusLabel: h.card.frozen ? "Frozen" : "Active", subscriptions: h.subscriptions.filter((s) => s.active).length, lastUsed: lastUsed?.at ?? null, lastUsedAt: lastUsed ? `${lastUsed.description}, ${money(-lastUsed.amount)}` : "Not yet" };
    }

    case "payees":
      return h.payees.map((p) => payeeRow(h, p));
    case "sendDraft":
      return { payeeId: slots.payee ?? null, amount: slots.amount ?? null, reference: slots.reference ?? "" };
    case "quote": {
      const q = h.quotes.at(-1);
      const payeeId = q?.payeeId ?? String(slots.payee ?? h.payees[0].id);
      const amount = q?.amount ?? Number(slots.amount ?? 40);
      const p = h.payees.find((x) => x.id === payeeId) ?? h.payees[0];
      const arrives = q?.arrives ?? new Date(Date.now() + 120000).toISOString();
      return { id: q?.id ?? "q_sample", payeeId: p.id, amount, reference: (q?.reference ?? String(slots.reference ?? "")) || "None", fee: 0, arrives, balanceAfter: q?.balanceAfter ?? Math.round((balance(h) - amount) * 100) / 100, label: `Send ${money(amount)}`, payee: payeeRow(h, p) };
    }
    case "payeeDraft":
      return { name: slots.payeeName ?? "", sortCode: "", accountNumber: "", reference: "" };

    case "monthCompare": {
      const a = spendByCategory(h, month);
      const cats = [...new Set([...a.map((x) => x.category), ...spendByCategory(h, prev).map((x) => x.category)])];
      const rows = cats
        .map((c) => ({ category: c, name: category(h, c).name, thisMonth: spent(h, month, c), lastMonth: spentToDay(h, prev, today, c) }))
        .map((r) => ({ ...r, change: Math.round((r.thisMonth - r.lastMonth) * 100) / 100 }))
        .sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
      const total = spent(h, month);
      const prevToDay = spentToDay(h, prev, today);
      const up = rows.filter((r) => r.change > 0)[0];
      const down = rows.filter((r) => r.change < 0)[0];
      const diff = total - prevToDay;
      const summary = [
        `By day ${today}, you've spent ${money(Math.abs(diff))} ${diff <= 0 ? "less" : "more"} than in ${monthName(prev)}.`,
        down ? `${down.name} is down ${money(-down.change)}.` : "",
        up ? `${up.name} is up ${money(up.change)}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      // The chart shows the six biggest categories; a phone-width chart can't label eleven.
      const top = [...rows].sort((x, y) => y.thisMonth + y.lastMonth - (x.thisMonth + x.lastMonth)).slice(0, 6);
      return { month: monthName(month), previous: monthName(prev), thisMonth: total, lastMonthToDay: prevToDay, lastMonthFull: spent(h, prev), change: prevToDay ? Math.round(((total - prevToDay) / prevToDay) * 1000) / 1000 : null, dayOfMonth: today, rows, top, summary };
    }

    /* ---- The authored screens (authored/*.json): the same views the React screens computed ---- */

    case "budgetsScreen": {
      // Every budget with what's been spent against it this month, then the categories that could have one.
      const now = new Date();
      const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
      const rows = h.budgets.map((b) => {
        const used = spent(h, month, b.category);
        const left = Math.round((b.limit - used) * 100) / 100;
        return {
          category: b.category,
          name: category(h, b.category).name,
          limit: b.limit,
          used,
          left,
          leftLabel: left >= 0 ? `${money(left)} left` : `${money(-left)} over`,
          limitLabel: `of ${money(b.limit, { whole: true })}`,
        };
      });
      const limit = rows.reduce((s, r) => s + r.limit, 0);
      const used = Math.round(rows.reduce((s, r) => s + r.used, 0) * 100) / 100;
      const without = h.categories
        .filter((c) => !["income", "transfers", "rent"].includes(c.id) && !h.budgets.some((b) => b.category === c.id) && spent(h, prev, c.id) > 0)
        .map((c) => ({ category: c.id, name: c.name, lastMonth: spent(h, prev, c.id), lastMonthLabel: `${money(spent(h, prev, c.id))} in ${monthName(prev)}` }));
      return {
        month: monthName(month),
        budgetedLabel: `Budgeted in ${monthName(month)}`,
        used,
        limit,
        ofLabel: `of ${money(limit, { whole: true })}`,
        daysLeft,
        toGoLabel: `${money(Math.max(0, limit - used))} to go`,
        any: rows.length > 0,
        none: rows.length === 0,
        rows,
        without,
        anyWithout: without.length > 0,
      };
    }

    case "insights": {
      // Spend for one month (slots.month, "YYYY-MM"; this month by default), with every month for the chooser and the chart.
      const months = [...new Set(h.payments.map((p) => monthKey(p.at)))].sort().map((key) => ({ key, name: monthName(key), label: monthName(key, "short"), total: spent(h, key) }));
      const chosen = months.some((m) => m.key === slots.month) ? String(slots.month) : month;
      const total = spent(h, chosen);
      const rows = spendByCategory(h, chosen).map((r) => ({ ...r, share: total ? Math.round((r.total / total) * 100) / 100 : 0, detail: `${r.count} payment${r.count === 1 ? "" : "s"} · ${total ? Math.round((r.total / total) * 100) : 0}%` }));
      const active = h.subscriptions.filter((s) => s.active);
      const subsMonthly = Math.round(active.reduce((t, s) => t + (s.cadence === "monthly" ? s.amount : s.amount / 12), 0) * 100) / 100;
      const fixed = h.payments.filter((p) => monthKey(p.at) === chosen && p.amount < 0 && p.status !== "refunded" && (p.category === "rent" || p.category === "bills"));
      const fixedTotal = Math.round(fixed.reduce((t, p) => t - p.amount, 0) * 100) / 100;
      const most = [...months].sort((a, b) => b.total - a.total)[0];
      const least = [...months].sort((a, b) => a.total - b.total)[0];
      return {
        month: chosen,
        months,
        spentLabel: `Spent in ${monthName(chosen)}`,
        total,
        rows,
        chartSummary: most && least && most.key !== least.key ? `${most.name} is the highest at ${money(most.total)}; ${least.name} the lowest at ${money(least.total)}.` : `${money(total)} spent in ${monthName(chosen)}.`,
        subscriptions: { monthly: subsMonthly, count: active.length, countLabel: `${active.length} active` },
        fixed: { total: fixedTotal, count: fixed.length, countLabel: `${fixed.length} payment${fixed.length === 1 ? "" : "s"}` },
      };
    }

    case "cardScreen": {
      const c = h.card;
      const lastUsed = [...h.payments].reverse().find((p) => p.card);
      const frozenAt = c.frozen && c.frozenAt ? `${dayLabel(c.frozenAt).toLowerCase()} at ${time(c.frozenAt)}` : "";
      return {
        id: c.id,
        number: `${c.network} ··${c.last4}`,
        holder: `${h.person.name} · expires ${c.expiry}`,
        frozen: c.frozen,
        active: !c.frozen,
        statusLabel: c.frozen ? "Frozen" : "Active",
        statusDetail: c.frozen ? `Frozen ${frozenAt}` : "Active",
        frozenSince: c.frozen ? `Since ${frozenAt}. Nothing new goes through until you unfreeze it.` : "",
        contactlessLimit: c.contactlessLimit,
        onlinePayments: c.onlinePayments,
        lastUsedLabel: lastUsed ? `${dayLabel(lastUsed.at)}, ${money(-lastUsed.amount)}` : "Not yet",
        subscriptions: h.subscriptions.filter((s) => s.active).length,
      };
    }
    default:
      throw new Error(`Unknown view ${name}`);
  }
}

const REASONS: Record<string, string> = { duplicate: "Charged twice", unrecognised: "Don't recognise it", "wrong-amount": "Wrong amount", "not-received": "Didn't get what I paid for" };

export function paymentRow(h: Halden, p: Payment) {
  const m = h.merchants.find((x) => x.id === p.merchantId);
  const py = h.payees.find((x) => x.id === p.payeeId);
  return { id: p.id, at: p.at, amount: p.amount, name: m?.name ?? py?.name ?? p.description, where: m?.where ?? p.reference ?? "", category: category(h, p.category).name, categoryId: p.category, status: p.status, merchantId: p.merchantId ?? null, card: p.card };
}

function payeeRow(h: Halden, p: Halden["payees"][number]) {
  const paid = h.payments.filter((x) => x.payeeId === p.id && x.amount < 0);
  return { id: p.id, name: p.name, initials: p.name.split(" ").map((w) => w[0]).join(""), bank: `${p.sortCode} ··${p.accountNumber.slice(-2)}`, recent: paid.some((x) => Date.now() - new Date(x.at).getTime() < 30 * 86400000), lastPaid: paid.at(-1)?.at ?? null };
}

function subscriptionRow(h: Halden, s: Halden["subscriptions"][number]) {
  const m = h.merchants.find((x) => x.id === s.merchantId)!;
  const paid = h.payments.filter((p) => p.merchantId === s.merchantId && p.amount < 0);
  return { id: s.id, name: m.name, detail: m.where, amount: s.amount, cadence: s.cadence, every: s.cadence === "monthly" ? "Every month" : "Every year", monthly: s.cadence === "monthly" ? s.amount : Math.round((s.amount / 12) * 100) / 100, nextOn: s.nextOn, active: s.active, status: s.active ? "Active" : "Stopped", since: s.since, paidSoFar: Math.round(paid.reduce((t, p) => t - p.amount, 0) * 100) / 100 };
}

/** Turn matched slot text into ids and numbers the views understand. */
export function resolveSlots(h: Halden, slots: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (slots.amount) out.amount = Number(slots.amount.replace(/[£,\s]/g, ""));
  if (slots.payee) {
    const q = slots.payee.toLowerCase();
    const p = h.payees.find((x) => x.name.toLowerCase().startsWith(q)) ?? h.payees.find((x) => x.name.toLowerCase().includes(q));
    if (p) out.payee = p.id;
    else out.payeeName = slots.payee;
  }
  if (slots.category) {
    const q = slots.category.toLowerCase().trim();
    const alias: [string, string][] = [
      ["eating out", "eating-out"],
      ["restaurant", "eating-out"],
      ["dining", "eating-out"],
      ["takeaway", "eating-out"],
      ["food", "groceries"],
      ["grocer", "groceries"],
      ["coffee", "coffee"],
      ["cafe", "coffee"],
      ["transport", "transport"],
      ["travel", "transport"],
      ["taxi", "transport"],
      ["ride", "transport"],
      ["bus", "transport"],
      ["train", "transport"],
      ["shopping", "shopping"],
      ["clothes", "shopping"],
      ["book", "shopping"],
      ["bill", "bills"],
      ["utilit", "bills"],
      ["subscription", "subscriptions"],
      ["entertainment", "entertainment"],
      ["cinema", "entertainment"],
      ["film", "entertainment"],
      ["health", "health"],
      ["pharmac", "health"],
      ["rent", "rent"],
    ];
    const hit = alias.find(([k]) => q.includes(k));
    out.category = hit ? hit[1] : (h.categories.find((c) => c.name.toLowerCase().includes(q))?.id ?? "eating-out");
  }
  if (slots.merchant) {
    const q = slots.merchant.toLowerCase();
    const m = h.merchants.find((x) => x.name.toLowerCase().startsWith(q)) ?? h.merchants.find((x) => x.name.toLowerCase().includes(q));
    if (m) out.merchant = m.id;
  }
  if (slots.reference) out.reference = slots.reference;
  return out;
}

/** Build the surface's data from the intent's data map. */
export function surfaceData(h: Halden, intent: Pick<IntentFile, "data" | "fill">, slots: Record<string, unknown>): Record<string, unknown> {
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
