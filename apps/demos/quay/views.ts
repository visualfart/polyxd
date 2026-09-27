import type { IntentFile } from "../kit/types.ts";
import { AUDIENCE_LABEL, DISCOUNT_TYPE_LABEL, PAYMENT_LABEL, TYPES, TYPE_LABEL, audienceOf, campaignPausedOn, cover, covers, customer, daily, daysAgo, discountState, fullName, initials, isLate, netTotal, order, orderByNumber, product, refundedTotal, revenueOf, summarize, unitsSold, variantOf, type Audience, type DiscountType, type Product, type ProductType, type Quay, type Variant } from "./seed.ts";
import { dateOnly, dayRange, fromDay, isoDay, money, plural, round2, shortDate } from "./format.ts";

/**
 * The data a surface binds to. An intent's `data` map names, per surface key, a `view:` computed
 * here, a JSON Pointer into the store, or a literal. Slots from the ask (an order number, a percent,
 * a product) steer the views and pre-fill drafts. No React here: the snapshot and verify scripts use
 * it too, and so does `live`, which recomputes a surface's numbers as its inputs change.
 */
export function view(h: Quay, name: string, slots: Record<string, unknown>): unknown {
  switch (name) {
    case "dip":
      return dip(h);

    case "lowFilters":
      return { days: Number(slots.days ?? 14), types: Array.isArray(slots.types) ? slots.types : slots.type ? [slots.type] : [] };
    case "lowResults":
      return lowResults(h, view(h, "lowFilters", slots) as LowFilters);

    case "restockOptions":
      return restockOptions(h);
    case "restockDraft": {
      const v = variantOf(h, String(slots.variant)) ?? lowestCover(h);
      return { variantId: v.variant.id, quantity: Number(slots.quantity ?? suggestedQty(h, v.product, v.variant)), expectedAt: isoDay(new Date(Date.now() + 5 * 86400000)) };
    }
    case "restockNote":
      return restockNote(h, view(h, "restockDraft", slots) as RestockDraft);

    case "late":
      return late(h, slots);
    case "fulfillReview":
      return fulfillReview(h, slots);

    case "discountDraft":
      return discountDraft(h, slots);
    case "discountReview":
      return discountReview(h, view(h, "discountDraft", slots) as DiscountDraft);
    case "discountConfirm":
      return discountConfirm(h, slots);

    case "refund":
      return refundForm(h, slots);
    case "refundConfirm":
      return refundConfirm(h, slots);

    case "repriceDraft":
      return { percent: Number(slots.percent ?? 5), type: String(slots.type ?? "candle") };
    case "repriceTypes":
      return [{ id: "all", name: "All products" }, ...TYPES.map((t) => ({ id: t, name: `${TYPE_LABEL[t]}s` }))];
    case "repricePreview":
      return repricePreview(h, view(h, "repriceDraft", slots) as RepriceDraft);
    case "repriceConfirm":
      return repriceConfirm(h, slots);

    case "recover":
      return recover(h, slots);
    case "recoverConfirm":
      return recoverConfirm(h, slots);
    default:
      throw new Error(`Unknown view ${name}`);
  }
}

/* ---- Why did sales drop last week ---- */

function dip(h: Quay) {
  const lastFrom = daysAgo(7);
  const lastTo = daysAgo(1);
  const beforeFrom = daysAgo(14);
  const beforeTo = daysAgo(8);
  const last = summarize(h, lastFrom, lastTo);
  const before = summarize(h, beforeFrom, beforeTo);
  const gap = round2(before.sales - last.sales);
  const change = before.sales ? (last.sales - before.sales) / before.sales : 0;
  // Numeric day labels: fourteen of them share one axis, so "9/14" fits where "Sep 14" crowds.
  const series = daily(h, beforeFrom, lastTo).map((d) => ({ date: `${fromDay(d.date).getMonth() + 1}/${fromDay(d.date).getDate()}`, revenue: d.revenue, orders: d.orders }));
  const reasons: string[] = [];
  const restockVariantIds: string[] = [];
  const productIds: string[] = [];
  let explained = 0;
  // Stock-outs that touched last week: what the variant usually sells, times the days it was gone.
  for (const p of h.products) {
    for (const v of p.variants) {
      for (const s of v.stockouts) {
        const from = s.from > lastFrom ? s.from : lastFrom;
        const to = s.to < lastTo ? s.to : lastTo;
        if (from > to) continue;
        const gone = Math.round((fromDay(to).getTime() - fromDay(from).getTime()) / 86400000) + 1;
        const baseFrom = daysAgo(35);
        const baseTo = isoDay(new Date(fromDay(s.from).getTime() - 86400000));
        const perDay = unitsSold(h, v.id, baseFrom, baseTo) / Math.max(1, (fromDay(baseTo).getTime() - fromDay(baseFrom).getTime()) / 86400000 + 1);
        const lost = round2(perDay * gone * v.price);
        explained += lost;
        restockVariantIds.push(v.id);
        productIds.push(p.id);
        reasons.push(`${p.title} (${v.title}) was out of stock ${dayRange(from, to)}, ${plural(gone, "day")}. It usually sells ${perDay.toFixed(1)} a day, so about ${money(lost)} didn't happen.`);
      }
    }
  }
  // A paused campaign: the ad-attributed sales it usually brings, times the days it was off.
  for (const c of h.campaigns) {
    for (const p of c.pauses) {
      const from = p.from > lastFrom ? p.from : lastFrom;
      const to = p.to < lastTo ? p.to : lastTo;
      if (from > to) continue;
      const off = Math.round((fromDay(to).getTime() - fromDay(from).getTime()) / 86400000) + 1;
      const baseFrom = daysAgo(35);
      const baseTo = isoDay(new Date(fromDay(p.from).getTime() - 86400000));
      const baseDays = (fromDay(baseTo).getTime() - fromDay(baseFrom).getTime()) / 86400000 + 1;
      const adSales = h.orders.filter((o) => o.source === "ads" && o.status !== "canceled" && isoDay(o.createdAt) >= baseFrom && isoDay(o.createdAt) <= baseTo).reduce((s, o) => s + o.total, 0);
      const lost = round2((adSales / baseDays) * off);
      explained += lost;
      reasons.push(`${c.name} (${c.channel}) was paused ${dayRange(from, to)}. Sales from ads run about ${money(adSales / baseDays)} a day, so about ${money(lost)} didn't happen.${c.status === "paused" ? " It's still paused." : " It's running again."}`);
    }
  }
  // Everything else, so the reader knows the rest of the store held up.
  const touched = new Set(restockVariantIds);
  const restBefore = ordersRevenueExcluding(h, beforeFrom, beforeTo, touched);
  const restLast = ordersRevenueExcluding(h, lastFrom, lastTo, touched);
  const restChange = restBefore ? (restLast - restBefore) / restBefore : 0;
  const sessionsChange = before.sessions ? (last.sessions - before.sessions) / before.sessions : 0;
  reasons.push(Math.abs(restChange) < 0.12 ? `Everything else held: the other products took ${money(restLast)} against ${money(restBefore)} the week before.` : `The rest of the range sold less too: ${money(restLast)} against ${money(restBefore)} the week before (${Math.round(restChange * 100)}%), with ${Math.round(-sessionsChange * 100)}% fewer sessions while the ads were off.`);
  const aovChange = before.aov ? (last.aov - before.aov) / before.aov : 0;
  if (Math.abs(aovChange) >= 0.08) reasons.push(`Average order value ${aovChange < 0 ? "fell" : "rose"} from ${money(before.aov)} to ${money(last.aov)}${aovChange < 0 ? ": with the 8 oz candles gone, baskets were smaller." : "."}`);
  const peak = series.reduce((a, b) => (b.revenue > a.revenue ? b : a), series[0]);
  const low = series.reduce((a, b) => (b.revenue < a.revenue ? b : a), series[0]);
  return {
    title: `Sales fell ${Math.round(-change * 100)}% last week`,
    lastLabel: dayRange(lastFrom, lastTo),
    beforeLabel: dayRange(beforeFrom, beforeTo),
    lastWeek: last.sales,
    weekBefore: before.sales,
    change,
    ordersLast: last.orders,
    ordersChange: before.orders ? (last.orders - before.orders) / before.orders : 0,
    aovLast: last.aov,
    aovChange,
    sessionsLast: last.sessions,
    sessionsChange: before.sessions ? (last.sessions - before.sessions) / before.sessions : 0,
    series,
    chartSummary: `Daily sales over the two weeks: the best day was ${peak.date} at ${money(peak.revenue)}, the worst ${low.date} at ${money(low.revenue)}. The week of ${dayRange(lastFrom, lastTo)} came to ${money(last.sales)} against ${money(before.sales)} the week before.`,
    reasonsTitle: `Where the ${money(gap)} went`,
    reasons,
    explainedText: explained >= gap ? `The estimates come to about ${money(round2(explained))}, more than the ${money(gap)} gap: they overlap, since an ad click that landed on an empty shelf counts in both.` : `Together these account for about ${money(round2(explained))} of the ${money(gap)} gap; the rest is normal week-to-week movement.`,
    restockVariantIds,
    productIds,
    restockLabel: restockVariantIds.length ? `Restock ${plural(restockVariantIds.length, "variant")}` : "Restock a product",
  };
}
function ordersRevenueExcluding(h: Quay, from: string, to: string, variantIds: Set<string>): number {
  return round2(h.orders.filter((o) => o.status !== "canceled" && isoDay(o.createdAt) >= from && isoDay(o.createdAt) <= to).reduce((s, o) => s + o.items.filter((it) => !variantIds.has(it.variantId)).reduce((t, it) => t + it.qty * it.price, 0), 0));
}

/* ---- What's about to sell out ---- */

interface LowFilters { days: number; types: string[] }
function lowResults(h: Quay, f: LowFilters) {
  const rows = covers(h)
    .filter((c) => c.product.status === "active")
    .filter((c) => c.variant.inventory === 0 || (c.days !== null && c.days <= f.days))
    .filter((c) => !f.types.length || f.types.includes(c.product.type))
    .sort((a, b) => (a.days ?? -1) - (b.days ?? -1))
    .map((c) => ({
      id: c.variant.id,
      productId: c.product.id,
      name: c.product.title,
      initials: initials(c.product.title),
      line: `${c.product.option ? `${c.variant.title} · ` : ""}${c.variant.sku}`,
      type: TYPE_LABEL[c.product.type],
      inventory: c.variant.inventory,
      perWeek: round2(c.perDay * 7),
      days: c.days ?? 0,
      status: c.variant.inventory === 0 ? "Out of stock" : (c.days ?? 99) <= 7 ? "Under a week" : (c.days ?? 99) <= 14 ? "Under two weeks" : "Under a month",
    }));
  return { rows, count: rows.length, caption: `Variants with ${f.days} days of stock or less, from the last 30 days' sales` };
}
function lowestCover(h: Quay) {
  return covers(h)
    .filter((c) => c.product.status === "active")
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))[0];
}
/** Enough for six weeks at the current rate, rounded up to the case of twelve. */
function suggestedQty(h: Quay, p: Product, v: Variant): number {
  const c = cover(h, p, v);
  return Math.max(12, Math.ceil((c.perDay * 42 - v.inventory) / 12) * 12);
}
function restockOptions(h: Quay) {
  return covers(h)
    .filter((c) => c.product.status !== "archived")
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999) || a.product.title.localeCompare(b.product.title))
    .map((c) => ({ id: c.variant.id, name: c.product.option ? `${c.product.title} · ${c.variant.title}` : c.product.title, detail: `${c.variant.inventory} in stock · sells ${round2(c.perDay * 7)} a week${c.days !== null ? ` · ${plural(c.days, "day")} left` : ""}` }));
}
interface RestockDraft { variantId: string; quantity: number; expectedAt: string }
function restockNote(h: Quay, d: RestockDraft) {
  const v = variantOf(h, d.variantId);
  if (!v) return { text: "Choose the variant to restock." };
  const c = cover(h, v.product, v.variant);
  const qty = Math.max(0, Math.floor(Number(d.quantity) || 0));
  const after = v.variant.inventory + qty;
  const weeks = c.perDay > 0 ? Math.floor(after / c.perDay / 7) : null;
  return { text: `${v.product.title}${v.product.option ? ` (${v.variant.title})` : ""} has ${v.variant.inventory} in stock and sells about ${round2(c.perDay * 7)} a week. After this delivery: ${after} in stock${weeks !== null ? `, about ${plural(weeks, "week")} of sales` : ""}.` };
}

/* ---- Orders that should have shipped ---- */

function orderRow(h: Quay, o: (typeof h.orders)[number]) {
  const c = customer(h, o.customerId);
  return { id: o.id, number: `#${o.number}`, customer: c ? fullName(c) : "Guest", initials: c ? initials(fullName(c)) : "G", placed: o.createdAt, promised: o.promisedShipAt, items: o.items.reduce((s, it) => s + it.qty - it.fulfilled, 0), total: o.total, payment: PAYMENT_LABEL[o.paymentStatus], city: `${o.shippingAddress.city}, ${o.shippingAddress.state}` };
}
function late(h: Quay, slots: Record<string, unknown>) {
  const rows = h.orders
    .filter(isLate)
    .sort((a, b) => a.promisedShipAt.localeCompare(b.promisedShipAt))
    .map((o) => orderRow(h, o));
  const wanted = Array.isArray(slots.orderIds) ? (slots.orderIds as string[]) : rows.map((r) => r.id);
  const oldest = rows[0];
  return {
    intro: rows.length ? `${plural(rows.length, "order")} promised to ship by now and still unfulfilled. The oldest, ${oldest.number}, was promised ${shortDate(oldest.promised)}. Untick any that can't go today.` : "Every order has shipped on time.",
    caption: "Unfulfilled orders past their promised ship date",
    rows,
    selection: { ids: rows.filter((r) => wanted.includes(r.id)).map((r) => r.id) },
    count: rows.length,
  };
}
function fulfillReview(h: Quay, slots: Record<string, unknown>) {
  const ids = Array.isArray(slots.orderIds) && slots.orderIds.length ? (slots.orderIds as string[]) : h.orders.filter(isLate).map((o) => o.id);
  const orders = ids.map((id) => order(h, id)).filter((o): o is NonNullable<typeof o> => !!o && o.status === "open" && o.fulfillmentStatus !== "fulfilled");
  const customers = [...new Set(orders.map((o) => o.customerId))].map((id) => customer(h, id)).filter(Boolean);
  const items = orders.reduce((s, o) => s + o.items.reduce((t, it) => t + it.qty - it.fulfilled, 0), 0);
  const value = round2(orders.reduce((s, o) => s + o.total, 0));
  const oldest = orders.map((o) => o.promisedShipAt).sort()[0];
  const n = orders.length;
  return {
    orderIds: orders.map((o) => o.id),
    title: n === 1 ? `Fulfill order ${`#${orders[0].number}`}?` : `Fulfill ${plural(n, "order")}?`,
    label: n === 1 ? "Fulfill 1 order" : `Fulfill ${n} orders`,
    count: n,
    items,
    value,
    customersText: `${plural(customers.length, "customer")} get a shipping confirmation email`,
    itemsText: `${plural(items, "item")} marked as shipped from Portland`,
    statusText: n === 1 ? "The order moves to Fulfilled" : "The orders move to Fulfilled",
    ordersText: orders.map((o) => `#${o.number}`).join(", "),
    customersList: customers.map((c) => `${fullName(c!)} · ${c!.email}`),
    oldestText: oldest ? dateOnly(oldest) : "",
    consequence: `${customers.length === 1 ? `${fullName(customers[0]!)} is` : `${customers.length} customers are`} emailed that their order has shipped, with tracking. Fulfillment can't be undone from here; a mistake means a second email.`,
  };
}

/* ---- Make a discount ---- */

interface DiscountDraft { step: number; type: DiscountType; valueKind: "percentage" | "fixed"; value: number; minOrder: number; code: string; audience: Audience; method: "code" | "automatic"; startsAt: string; endsAt: string }
const AUDIENCE_CODE: Record<Audience, string> = { everyone: "TAKE", returning: "RETURN", new: "WELCOME", lapsed: "COMEBACK" };
function discountDraft(h: Quay, slots: Record<string, unknown>): DiscountDraft {
  const audience = (["everyone", "returning", "new", "lapsed"].includes(String(slots.audience)) ? slots.audience : "returning") as Audience;
  const value = Number(slots.percent ?? slots.amount ?? 15);
  const valueKind = slots.amount && !slots.percent ? "fixed" : "percentage";
  const type = (slots.type === "free_shipping" || slots.type === "amount_off_products" ? slots.type : "amount_off_order") as DiscountType;
  const code = `${AUDIENCE_CODE[audience]}${valueKind === "percentage" ? value : ""}`;
  return { step: 0, type, valueKind, value, minOrder: Number(slots.minOrder ?? 0), code: h.discounts.some((d) => d.code === code) ? `${code}B` : code, audience, method: "code", startsAt: isoDay(new Date()), endsAt: "" };
}
function discountReview(h: Quay, d: DiscountDraft) {
  const value = Math.max(0, Number(d.value) || 0);
  const min = Math.max(0, Number(d.minOrder) || 0);
  const reach = audienceOf(h, d.audience);
  const typeText = DISCOUNT_TYPE_LABEL[d.type] ?? DISCOUNT_TYPE_LABEL.amount_off_order;
  const valueText = d.type === "free_shipping" ? "Free shipping" : d.valueKind === "fixed" ? `${money(value)} off` : `${value}% off`;
  const codeText = d.method === "automatic" ? "Automatic, applied at checkout" : (d.code || "").toUpperCase().trim() || "Enter a code";
  const whenText = `${d.startsAt ? dateOnly(fromDay(d.startsAt).toISOString()) : "Today"}${d.endsAt ? ` to ${dateOnly(fromDay(d.endsAt).toISOString())}` : ", no end date"}`;
  return {
    typeText,
    valueText,
    minText: min > 0 ? `Minimum purchase of ${money(min)}` : "No minimum",
    codeText,
    audienceText: AUDIENCE_LABEL[d.audience] ?? AUDIENCE_LABEL.everyone,
    reachText: `${plural(reach.length, "customer")} can use it today`,
    whenText,
    summary: `${valueText} ${d.type === "amount_off_products" ? "products" : d.type === "free_shipping" ? "" : "the order"}${min > 0 ? `, minimum ${money(min)}` : ""} for ${(AUDIENCE_LABEL[d.audience] ?? "all customers").toLowerCase()}, ${d.method === "automatic" ? "applied automatically" : `with code ${codeText}`}.`,
  };
}
function discountConfirm(h: Quay, slots: Record<string, unknown>) {
  const d = { ...discountDraft(h, slots), ...(slots.draft as Partial<DiscountDraft> | undefined) };
  const r = discountReview(h, d);
  const code = d.method === "automatic" ? "" : (d.code || "").toUpperCase().trim();
  const live = !d.startsAt || d.startsAt <= isoDay(new Date());
  const reach = audienceOf(h, d.audience).length;
  return {
    draft: d,
    title: `Create ${d.method === "automatic" ? "this automatic discount" : code}?`,
    label: "Create discount",
    name: d.method === "automatic" ? `Automatic · ${r.valueText}` : code,
    detail: r.summary,
    initials: d.method === "automatic" ? "AU" : code.slice(0, 2),
    liveText: live ? "Live on the store as soon as you confirm" : `Goes live ${dateOnly(fromDay(d.startsAt).toISOString())}`,
    reachText: `${plural(reach, "customer")} can use it`,
    endText: d.endsAt ? `Ends ${dateOnly(fromDay(d.endsAt).toISOString())}` : "Runs until you end it",
    review: r,
    consequence: `${live ? "The discount is live the moment you confirm" : `The discount goes live on ${dateOnly(fromDay(d.startsAt).toISOString())}`} and ${plural(reach, "customer")} can use it at checkout. You can end it from Discounts at any time; orders that used it keep their price.`,
  };
}

/* ---- Refund an order ---- */

const REASONS = ["Damaged in transit", "Wrong item sent", "Customer changed their mind", "Other"];
function refundTarget(h: Quay, slots: Record<string, unknown>) {
  const byNumber = slots.order ? orderByNumber(h, Number(String(slots.order).replace(/\D/g, ""))) : undefined;
  const byId = order(h, String(slots.orderId));
  return byId ?? byNumber ?? h.orders.filter((o) => o.paymentStatus === "paid" && o.status !== "canceled").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
function refundReceipt(h: Quay, o: (typeof h.orders)[number], itemIds: string[]) {
  const items = o.items.filter((it) => itemIds.includes(it.id) && it.refunded < it.qty);
  const subtotal = round2(items.reduce((s, it) => s + (it.qty - it.refunded) * it.price, 0));
  const orderNet = round2(o.subtotal - o.discountAmount);
  const share = orderNet ? subtotal / orderNet : 0;
  const discount = round2(o.discountAmount * share);
  const tax = round2(o.tax * share);
  // Shipping comes back only when everything does.
  const all = items.length === o.items.filter((it) => it.refunded < it.qty).length && items.length > 0;
  const shipping = all ? o.shipping : 0;
  const already = refundedTotal(o);
  const total = round2(Math.min(o.total - already, subtotal - discount + tax + shipping));
  return { items, subtotal, discount, tax, shipping, total, already, all, itemsText: items.length ? `${plural(items.reduce((s, it) => s + it.qty - it.refunded, 0), "item")} of ${plural(o.items.reduce((s, it) => s + it.qty, 0), "item")}` : "Nothing selected" };
}
function refundForm(h: Quay, slots: Record<string, unknown>) {
  const o = refundTarget(h, slots);
  const c = customer(h, o.customerId);
  const options = o.items.filter((it) => it.refunded < it.qty).map((it) => ({ id: it.id, label: `${it.qty - it.refunded} × ${it.title}${it.variantTitle !== "Default" ? ` (${it.variantTitle})` : ""}, ${money(it.price)}${it.fulfilled ? "" : ", not yet shipped"}` }));
  const itemIds = Array.isArray(slots.itemIds) ? (slots.itemIds as string[]) : options.map((x) => x.id);
  const r = refundReceipt(h, o, itemIds);
  return {
    orderId: o.id,
    number: `#${o.number}`,
    intro: `Order #${o.number}, placed ${dateOnly(o.createdAt)} by ${c ? fullName(c) : "a guest"}. ${o.paymentStatus === "paid" ? `Paid ${money(o.total)}` : `${PAYMENT_LABEL[o.paymentStatus]}; ${money(r.already)} already refunded`}. Untick what stays.`,
    items: options,
    draft: { itemIds, reason: REASONS.includes(String(slots.reason)) ? String(slots.reason) : REASONS[0], restock: slots.restock !== false },
    receipt: { itemsText: r.itemsText, subtotal: r.subtotal, discount: r.discount, tax: r.tax, shipping: r.shipping, total: r.total, note: r.all ? "Shipping is refunded with a full refund." : "Shipping stays with a partial refund." },
  };
}
function refundConfirm(h: Quay, slots: Record<string, unknown>) {
  const o = refundTarget(h, slots);
  const c = customer(h, o.customerId);
  const itemIds = Array.isArray(slots.itemIds) ? (slots.itemIds as string[]) : o.items.filter((it) => it.refunded < it.qty).map((it) => it.id);
  const r = refundReceipt(h, o, itemIds);
  const reason = REASONS.includes(String(slots.reason)) ? String(slots.reason) : REASONS[0];
  const restock = slots.restock !== false;
  const name = c ? fullName(c) : "the customer";
  const paidEvent = o.timeline.find((e) => e.kind === "paid");
  const card = paidEvent?.text.match(/\((.+)\)/)?.[1] ?? "the original payment method";
  return {
    orderId: o.id,
    itemIds,
    reason,
    restock,
    title: `Refund ${money(r.total)} to ${c?.firstName ?? "the customer"}?`,
    label: `Refund ${money(r.total)}`,
    amount: r.total,
    customer: { name, initials: initials(name), detail: `Order #${o.number} · ${card}` },
    backText: `${money(r.total)} goes back to ${card}`,
    restockText: restock ? `${r.items.reduce((s, it) => s + it.qty - it.refunded, 0)} items return to inventory` : "Nothing returns to inventory",
    emailText: `${name} is emailed a refund receipt`,
    reasonText: reason,
    itemsText: r.itemsText,
    subtotal: r.subtotal,
    discount: r.discount,
    tax: r.tax,
    shipping: r.shipping,
    total: r.total,
    afterText: r.total >= round2(o.total - r.already) ? "Payment status becomes Refunded" : "Payment status becomes Partially refunded",
    consequence: `${money(r.total)} leaves your balance and reaches ${card} in 5 to 10 business days. ${name} gets a receipt by email. A refund can't be taken back; charging again means a new order.`,
  };
}

/* ---- Change prices ---- */

interface RepriceDraft { percent: number; type: string }
function repricePreview(h: Quay, d: RepriceDraft) {
  const pct = Math.max(-50, Math.min(100, Number(d.percent) || 0));
  const type = d.type && d.type !== "all" ? (d.type as ProductType) : undefined;
  const rows = h.products
    .filter((p) => p.status !== "archived" && (!type || p.type === type))
    .flatMap((p) => p.variants.map((v) => ({ id: v.id, name: p.title, initials: initials(p.title), line: `${p.option ? `${v.title} · ` : ""}${TYPE_LABEL[p.type]}`, before: v.price, after: newPrice(v.price, pct), delta: round2(newPrice(v.price, pct) - v.price) })));
  const totalDelta = round2(rows.reduce((s, r) => s + r.delta, 0));
  const avgBefore = rows.length ? round2(rows.reduce((s, r) => s + r.before, 0) / rows.length) : 0;
  const avgAfter = rows.length ? round2(rows.reduce((s, r) => s + r.after, 0) / rows.length) : 0;
  const what = type ? `${TYPE_LABEL[type].toLowerCase()} prices` : "prices";
  return {
    rows,
    count: rows.length,
    caption: `${plural(rows.length, "variant")}: prices before and after a ${pct}% change`,
    summaryText: rows.length ? `${pct >= 0 ? "Raises" : "Lowers"} ${plural(rows.length, what.replace(/ prices$/, " price"))} by ${Math.abs(pct)}%. The average goes from ${money(avgBefore)} to ${money(avgAfter)}. Prices round to the nearest 50 cents.` : "No products of that type.",
    totalDelta,
    avgBefore,
    avgAfter,
    pct,
  };
}
/** Round to the nearest 50 cents, so a 5% raise on $28 is $29.50, not $29.40. */
const newPrice = (price: number, pct: number) => Math.max(0.5, Math.round((price * (1 + pct / 100)) / 0.5) * 0.5);
function repriceConfirm(h: Quay, slots: Record<string, unknown>) {
  const d = { percent: Number(slots.percent ?? 5), type: String(slots.type ?? "candle") };
  const p = repricePreview(h, d);
  const what = d.type !== "all" ? `${TYPE_LABEL[d.type as ProductType].toLowerCase()} prices` : "prices";
  return {
    percent: p.pct,
    type: d.type,
    count: p.count,
    title: `${p.pct >= 0 ? "Raise" : "Lower"} ${plural(p.count, what.replace(/ prices$/, " price"))} by ${Math.abs(p.pct)}%?`,
    label: `Change ${plural(p.count, "price")}`,
    scopeText: d.type !== "all" ? `Every ${TYPE_LABEL[d.type as ProductType].toLowerCase()} variant` : "Every variant in the store",
    liveText: "New prices show on the store at once",
    cartsText: "Open carts and checkouts see the new price",
    changeText: `${p.pct >= 0 ? "+" : ""}${p.pct}%`,
    avgBefore: p.avgBefore,
    avgAfter: p.avgAfter,
    totalDelta: p.totalDelta,
    consequence: `${plural(p.count, "price")} change on the store the moment you confirm; anyone with a cart open sees the new price. The change can be undone from the toast for a few seconds, then it's a new price change.`,
  };
}

/* ---- Recover abandoned checkouts ---- */

function recover(h: Quay, slots: Record<string, unknown>) {
  const since = daysAgo(6);
  const rows = h.checkouts
    .filter((c) => c.emailStatus !== "recovered" && isoDay(c.createdAt) >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => ({ id: c.id, name: c.name, email: c.email, initials: initials(c.name), left: c.createdAt, items: c.items.reduce((s, it) => s + it.qty, 0), itemsText: c.items.map((it) => it.title).join(", "), value: c.subtotal, emailStatus: c.emailStatus === "not_sent" ? "Not sent" : c.emailStatus === "sent" ? "Sent" : c.emailStatus === "opened" ? "Opened" : "Recovered" }));
  const wanted = Array.isArray(slots.checkoutIds) ? (slots.checkoutIds as string[]) : rows.filter((r) => r.emailStatus === "Not sent").map((r) => r.id);
  const discounts = [{ id: "none", name: "No discount", detail: "A reminder with a link back to the cart" }, ...h.discounts.filter((d) => d.code && discountState(d) === "active").map((d) => ({ id: d.id, name: d.code!, detail: summaryOf(h, d.id) }))];
  const value = round2(rows.reduce((s, r) => s + r.value, 0));
  return {
    intro: rows.length ? `${plural(rows.length, "checkout")} left in the last 7 days, worth ${money(value)}. ${rows.filter((r) => r.emailStatus === "Not sent").length} haven't been reminded; those are ticked.` : "Nobody has left a checkout this week.",
    caption: "Abandoned checkouts from the last 7 days",
    rows,
    selection: { ids: rows.filter((r) => wanted.includes(r.id)).map((r) => r.id), discountId: h.discounts.some((d) => d.id === slots.discountId) ? String(slots.discountId) : "none" },
    discounts,
    count: rows.length,
  };
}
function summaryOf(h: Quay, id: string) {
  const d = h.discounts.find((x) => x.id === id)!;
  return d.type === "free_shipping" ? "Free shipping" : `${d.valueKind === "percentage" ? `${d.value}%` : money(d.value)} off ${d.type === "amount_off_products" && d.appliesTo ? `${TYPE_LABEL[d.appliesTo].toLowerCase()}s` : "the order"}${d.audience !== "everyone" ? ` · ${AUDIENCE_LABEL[d.audience].toLowerCase()}` : ""}`;
}
function recoverConfirm(h: Quay, slots: Record<string, unknown>) {
  const r = recover(h, slots);
  const ids = Array.isArray(slots.checkoutIds) && slots.checkoutIds.length ? (slots.checkoutIds as string[]) : r.selection.ids;
  const chosen = r.rows.filter((x) => ids.includes(x.id));
  const d = h.discounts.find((x) => x.id === slots.discountId);
  const value = round2(chosen.reduce((s, x) => s + x.value, 0));
  const n = chosen.length;
  return {
    checkoutIds: chosen.map((x) => x.id),
    discountId: d?.id ?? "none",
    title: n === 1 ? `Send 1 reminder?` : `Send ${n} reminders?`,
    label: n === 1 ? "Send 1 reminder" : `Send ${n} reminders`,
    count: n,
    value,
    discountText: d?.code ? `Includes code ${d.code}: ${summaryOf(h, d.id)}` : "No discount included",
    sendText: n === 1 ? `1 email goes out now, from ${h.shop.email}` : `${n} emails go out now, from ${h.shop.email}`,
    cartText: `${money(value)} of carts, with a link back to each`,
    recipientsText: chosen.length <= 3 ? chosen.map((x) => x.name).join(", ") : `${chosen.slice(0, 3).map((x) => x.name).join(", ")} and ${chosen.length - 3} more`,
    discountLabel: d?.code ?? "None",
    fromText: h.shop.email,
    consequence: `${n === 1 ? "One person gets" : `${n} people get`} an email from ${h.shop.name} with their cart${d?.code ? ` and code ${d.code}` : ""}. An email can't be recalled; a second reminder to the same cart is only sent by hand.`,
  };
}

/* ---- Slots and surface data ---- */

/** Turn matched slot text into ids and numbers the views understand. */
export function resolveSlots(h: Quay, slots: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (slots.order) out.order = Number(slots.order.replace(/\D/g, ""));
  if (slots.percent) out.percent = Number(slots.percent);
  if (slots.amount) out.amount = Number(slots.amount);
  if (slots.days) out.days = Number(slots.days);
  if (slots.quantity) out.quantity = Number(slots.quantity);
  if (slots.direction && /lower|cut|reduce|drop|decrease/i.test(slots.direction) && typeof out.percent === "number") out.percent = -Math.abs(out.percent);
  if (slots.type) out.type = typeFrom(slots.type);
  if (slots.audience) {
    const a = slots.audience.toLowerCase();
    out.audience = /repeat|returning|loyal|existing/.test(a) ? "returning" : /new|first/.test(a) ? "new" : /lapsed|inactive|haven't/.test(a) ? "lapsed" : "everyone";
  }
  if (slots.shipping) out.type = "free_shipping";
  if (slots.variant) {
    const v = findVariant(h, slots.variant);
    if (v) out.variant = v.variant.id;
  }
  return out;
}
function typeFrom(text: string): ProductType | undefined {
  const t = text.toLowerCase();
  if (/candle/.test(t)) return "candle";
  if (/diffuser/.test(t)) return "diffuser";
  if (/melt/.test(t)) return "melt";
  if (/gift|set/.test(t)) return "gift";
  if (/accessor/.test(t)) return "accessory";
  return undefined;
}
/** "the lavender candle" → the Lavender Field Candle's lowest-stock variant. */
function findVariant(h: Quay, text: string) {
  const words = text.toLowerCase().replace(/[^a-z0-9& ]/g, " ").split(/\s+/).filter((w) => w && !["the", "a", "an", "some", "more", "of", "for", "candle", "candles", "diffuser", "diffusers", "melts", "melt", "set", "sets"].includes(w));
  const type = typeFrom(text);
  let best: { product: Product; score: number } | undefined;
  for (const p of h.products) {
    const title = p.title.toLowerCase();
    let score = words.filter((w) => title.includes(w)).length;
    if (type && p.type === type) score += 0.5;
    if (score > (best?.score ?? 0)) best = { product: p, score };
  }
  if (!best || best.score < 1) return undefined;
  const variant = [...best.product.variants].sort((a, b) => a.inventory - b.inventory)[0];
  return { product: best.product, variant };
}

/** Build the surface's data from the intent's data map. */
export function surfaceData(h: Quay, intent: Pick<IntentFile, "data" | "fill">, slots: Record<string, unknown>): Record<string, unknown> {
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
 * What changes in a surface's data when its inputs change: the list under a filter panel, the
 * receipt beside a refund, the preview under a price change. The host writes the result back into
 * the surface, so the numbers people see are computed from the store, never from the document.
 */
export function live(h: Quay, intentId: string, data: Record<string, any>): Record<string, unknown> | null {
  switch (intentId) {
    case "inventory.low": {
      const f = data.filters ?? {};
      return { results: lowResults(h, { days: Number(f.days) || 14, types: Array.isArray(f.types) ? f.types : [] }) };
    }
    case "inventory.restock":
      return data.draft ? { note: restockNote(h, data.draft) } : null;
    case "discount.create":
      return data.draft ? { review: discountReview(h, data.draft) } : null;
    case "order.refund": {
      const o = order(h, data.refund?.orderId);
      if (!o) return null;
      const r = refundReceipt(h, o, Array.isArray(data.refund?.draft?.itemIds) ? data.refund.draft.itemIds : []);
      return { refund: { ...data.refund, receipt: { itemsText: r.itemsText, subtotal: r.subtotal, discount: r.discount, tax: r.tax, shipping: r.shipping, total: r.total, note: r.all ? "Shipping is refunded with a full refund." : "Shipping stays with a partial refund." } } };
    }
    case "products.reprice":
      return data.reprice ? { preview: repricePreview(h, data.reprice) } : null;
    default:
      return null;
  }
}

/* Things the screens reuse from here. */
export { REASONS };
export const paymentLabel = (s: keyof typeof PAYMENT_LABEL) => PAYMENT_LABEL[s];
export const isPausedToday = (h: Quay) => h.campaigns.some((c) => c.status === "paused" || campaignPausedOn(c, daysAgo(0)));
export const netOf = netTotal;
export const productOf = product;
export const revenueOfVariant = revenueOf;
