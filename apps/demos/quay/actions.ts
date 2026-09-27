import type { ActionEvent } from "@polyxd/react";
import type { Store, Undo } from "../kit/store.ts";
import { AUDIENCE_LABEL, TYPE_LABEL, customer, fullName, isLate, order, variantOf, type Audience, type DiscountType, type ProductType, type Quay } from "./seed.ts";
import { fromDay, isoDay, money, plural, round2, shortDate } from "./format.ts";
import { rangeOf, reportCsv } from "./views.ts";

/**
 * What Quay does when a generated surface asks for a capability. Every action changes the data
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
const tracking = () => `9400 1000 0000 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`;
const newPrice = (price: number, pct: number) => Math.max(0.5, Math.round((price * (1 + pct / 100)) / 0.5) * 0.5);

/** A real CSV of what a report shows, the way Export does in a store admin (a no-op outside a browser). */
function download(name: string, text: string) {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return;
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function runAction(store: Store<Quay>, e: ActionEvent): Outcome {
  const h = store.get();
  const c = e.context as Record<string, any>;
  switch (e.name) {
    case "product.open":
      return { go: `/products/${c.id}`, close: true };
    case "order.open":
      return { go: `/orders/${c.id}`, close: true };
    case "products.open":
      return { go: typeof c.type === "string" && c.type in TYPE_LABEL ? `/products?type=${c.type}` : "/products?view=low", close: true };
    case "restock.open": {
      const ids: string[] = Array.isArray(c.variantIds) ? c.variantIds : [];
      return { next: { intent: "inventory.restock", slots: ids.length ? { variant: ids[0] } : {} } };
    }

    // The authored screens: their buttons open a screen or an ask the way a React screen's did.
    case "discount.open":
      return { go: `/discounts/${c.id}`, close: true };
    case "discount.new":
      return { next: { intent: "discount.create" } };
    case "analytics.range": {
      const range = rangeOf(c);
      return { go: range === "30" ? "/analytics" : `/analytics?range=${range}` };
    }
    case "report.export": {
      const file = reportCsv(h, String(c.report), c);
      if (!file) return { say: `Quay has no "${c.report}" report to export.` };
      download(file.name, file.text);
      return { say: `Exported ${file.count} as ${file.name}.` };
    }

    case "inventory.adjust": {
      const v = variantOf(h, c.variantId);
      const qty = Math.floor(Number(c.quantity) || 0);
      if (!v) return { say: "Choose the variant first." };
      if (qty <= 0) return { say: "Enter how many are coming." };
      const expected = typeof c.expectedAt === "string" && c.expectedAt ? c.expectedAt : isoDay(new Date());
      const arrived = expected <= isoDay(new Date());
      const name = v.product.option ? `${v.product.title} (${v.variant.title})` : v.product.title;
      const undo = store.commit(`Restock ${name}`, (d) => {
        const dv = variantOf(d, v.variant.id)!.variant;
        if (arrived) dv.inventory += qty;
        else dv.incoming = { qty: (dv.incoming?.expectedAt === expected ? dv.incoming.qty : 0) + qty, expectedAt: expected };
      });
      return { say: arrived ? `${qty} added to ${name}: ${v.variant.inventory + qty} now in stock.` : `${qty} of ${name} on the way for ${shortDate(fromDay(expected).toISOString())}.`, undo, close: true, go: `/products/${v.product.id}` };
    }

    case "fulfillment.review": {
      const ids: string[] = Array.isArray(c.orderIds) ? c.orderIds : [];
      const orders = ids.map((id) => order(h, id)).filter((o) => o && o.status === "open" && o.fulfillmentStatus !== "fulfilled");
      if (!orders.length) return { say: "Select at least one order." };
      return { next: { intent: "orders.fulfill.confirm", slots: { orderIds: orders.map((o) => o!.id) } } };
    }
    case "orders.fulfill": {
      const ids: string[] = Array.isArray(c.orderIds) ? c.orderIds : [];
      const orders = ids.map((id) => order(h, id)).filter((o): o is NonNullable<typeof o> => !!o && o.status === "open" && o.fulfillmentStatus !== "fulfilled");
      if (!orders.length) return { say: "Nothing left to fulfill.", close: true };
      const customers = new Set(orders.map((o) => o.customerId));
      store.commit(`Fulfill ${orders.length}`, (d) => {
        for (const o of orders) {
          const dd = order(d, o.id)!;
          const t = tracking();
          dd.tracking = t;
          dd.fulfilledAt = now();
          dd.fulfillmentStatus = "fulfilled";
          for (const it of dd.items) it.fulfilled = it.qty;
          dd.timeline.push({ id: uid("ev"), at: now(), kind: "fulfilled", text: `All items fulfilled via USPS, tracking ${t}` });
          dd.timeline.push({ id: uid("ev"), at: now(), kind: "email", text: `Shipping confirmation emailed to ${customer(d, dd.customerId)?.email ?? "the customer"}` });
        }
      });
      const late = orders.filter(isLate).length;
      return { say: `${plural(orders.length, "order")} fulfilled${late ? `, ${late} of them late` : ""}. ${plural(customers.size, "customer")} emailed with tracking.`, close: true, go: "/orders?view=unfulfilled" };
    }

    case "discount.review": {
      const draft = discountDraftFrom(c);
      if (!draft) return { say: "Enter an amount off." };
      if (draft.method === "code" && (!draft.code || draft.code.length < 3)) return { say: "Enter a code of at least 3 characters." };
      if (draft.method === "code" && h.discounts.some((d) => d.code === draft.code)) return { say: `${draft.code} is already a discount. Choose another code.` };
      return { next: { intent: "discount.create.confirm", slots: { draft, percent: draft.valueKind === "percentage" ? draft.value : undefined, audience: draft.audience } } };
    }
    case "discount.create": {
      const draft = discountDraftFrom(c);
      if (!draft) return { say: "Enter an amount off." };
      if (draft.method === "code" && h.discounts.some((d) => d.code === draft.code)) return { say: `${draft.code} already exists. Nothing was created.` };
      const id = uid("dsc");
      store.commit(`Create ${draft.code || "discount"}`, (d) => {
        d.discounts.unshift({
          id,
          title: draft.method === "code" ? draft.code : `${draft.valueKind === "percentage" ? `${draft.value}% off` : `${money(draft.value)} off`} for ${AUDIENCE_LABEL[draft.audience].toLowerCase()}`,
          code: draft.method === "code" ? draft.code : undefined,
          method: draft.method,
          type: draft.type,
          valueKind: draft.valueKind,
          value: draft.value,
          minOrder: draft.minOrder || undefined,
          audience: draft.audience,
          startsAt: new Date(`${draft.startsAt}T00:00:00`).toISOString(),
          endsAt: draft.endsAt ? new Date(`${draft.endsAt}T23:59:00`).toISOString() : undefined,
          enabled: true,
          createdAt: now(),
        });
      });
      const live = draft.startsAt <= isoDay(new Date());
      return { say: `${draft.method === "code" ? draft.code : "The automatic discount"} is ${live ? "live" : `scheduled for ${shortDate(fromDay(draft.startsAt).toISOString())}`} for ${AUDIENCE_LABEL[draft.audience].toLowerCase()}.`, close: true, go: `/discounts/${id}` };
    }

    case "refund.review": {
      const o = order(h, c.orderId);
      const itemIds: string[] = Array.isArray(c.itemIds) ? c.itemIds : [];
      if (!o) return { say: "That order isn't here." };
      if (!itemIds.length) return { say: "Tick at least one item to refund." };
      return { next: { intent: "order.refund.confirm", slots: { orderId: o.id, itemIds, reason: c.reason, restock: c.restock !== false } } };
    }
    case "order.refund": {
      const o = order(h, c.orderId);
      const itemIds: string[] = Array.isArray(c.itemIds) ? c.itemIds : [];
      if (!o) return { say: "That order isn't here." };
      const items = o.items.filter((it) => itemIds.includes(it.id) && it.refunded < it.qty);
      if (!items.length) return { say: "Those items were already refunded.", close: true };
      const subtotal = round2(items.reduce((s, it) => s + (it.qty - it.refunded) * it.price, 0));
      const orderNet = round2(o.subtotal - o.discountAmount);
      const share = orderNet ? subtotal / orderNet : 0;
      const all = items.length === o.items.filter((it) => it.refunded < it.qty).length;
      const already = o.refunds.reduce((s, r) => s + r.amount, 0);
      const amount = round2(Math.min(o.total - already, subtotal - round2(o.discountAmount * share) + round2(o.tax * share) + (all ? o.shipping : 0)));
      const restock = c.restock !== false;
      const reason = String(c.reason || "Other");
      const name = customer(h, o.customerId);
      store.commit(`Refund #${o.number}`, (d) => {
        const dd = order(d, o.id)!;
        dd.refunds.push({ id: uid("rf"), at: now(), amount, reason, items: items.map((it) => ({ lineItemId: it.id, qty: it.qty - it.refunded })), restocked: restock });
        for (const it of dd.items) if (itemIds.includes(it.id)) it.refunded = it.qty;
        const total = dd.refunds.reduce((s, r) => s + r.amount, 0);
        dd.paymentStatus = total >= dd.total - 0.005 ? "refunded" : "partially_refunded";
        if (restock) for (const it of items) variantOf(d, it.variantId)!.variant.inventory += it.qty - it.refunded;
        dd.timeline.push({ id: uid("ev"), at: now(), kind: "refund", text: `Refunded ${money(amount)} to the original payment method: ${reason.toLowerCase()}${restock ? "; items restocked" : ""}` });
        dd.timeline.push({ id: uid("ev"), at: now(), kind: "email", text: `Refund receipt emailed to ${name?.email ?? "the customer"}` });
      });
      return { say: `${money(amount)} refunded to ${name ? name.firstName : "the customer"} for #${o.number}. They'll see it in 5 to 10 business days.`, close: true, go: `/orders/${o.id}` };
    }

    case "pricing.review": {
      const pct = Math.max(-50, Math.min(100, Number(c.percent) || 0));
      if (pct === 0) return { say: "Enter a change other than 0%." };
      return { next: { intent: "products.reprice.confirm", slots: { percent: pct, type: String(c.type || "all") } } };
    }
    case "products.reprice": {
      const pct = Math.max(-50, Math.min(100, Number(c.percent) || 0));
      const type = c.type && c.type !== "all" ? (String(c.type) as ProductType) : undefined;
      if (pct === 0) return { say: "Nothing changed: the change was 0%." };
      let n = 0;
      const undo = store.commit(`Reprice ${type ?? "all"} ${pct}%`, (d) => {
        for (const p of d.products) {
          if (p.status === "archived" || (type && p.type !== type)) continue;
          for (const v of p.variants) {
            v.price = newPrice(v.price, pct);
            if (v.compareAt !== undefined && v.compareAt <= v.price) v.compareAt = undefined;
            n++;
          }
        }
      });
      return { say: `${plural(n, "price")} ${pct > 0 ? "raised" : "lowered"} ${Math.abs(pct)}% across ${type ? `${TYPE_LABEL[type].toLowerCase()}s` : "the store"}.`, undo, close: true, go: type ? `/products?type=${type}` : "/products" };
    }

    case "recovery.review": {
      const ids: string[] = Array.isArray(c.checkoutIds) ? c.checkoutIds : [];
      const live = ids.filter((id) => h.checkouts.some((x) => x.id === id && x.emailStatus !== "recovered"));
      if (!live.length) return { say: "Tick at least one checkout." };
      return { next: { intent: "checkouts.recover.confirm", slots: { checkoutIds: live, discountId: c.discountId && c.discountId !== "none" ? c.discountId : undefined } } };
    }
    case "checkouts.recover": {
      const ids: string[] = Array.isArray(c.checkoutIds) ? c.checkoutIds : [];
      const chosen = h.checkouts.filter((x) => ids.includes(x.id) && x.emailStatus !== "recovered");
      if (!chosen.length) return { say: "Nothing to send.", close: true };
      const d = h.discounts.find((x) => x.id === c.discountId);
      store.commit(`Remind ${chosen.length}`, (draft) => {
        for (const x of draft.checkouts) {
          if (!ids.includes(x.id)) continue;
          x.emailStatus = "sent";
          x.remindedAt = now();
          x.discountCode = d?.code;
        }
      });
      return { say: `${plural(chosen.length, "reminder")} sent${d?.code ? ` with ${d.code}` : ""}. Opens and recoveries show under Abandoned checkouts.`, close: true, go: "/orders/checkouts" };
    }
    default:
      return { say: `Quay can't do "${e.name}" yet.` };
  }
}

interface DiscountDraft { type: DiscountType; valueKind: "percentage" | "fixed"; value: number; minOrder: number; code: string; method: "code" | "automatic"; audience: Audience; startsAt: string; endsAt: string }
function discountDraftFrom(c: Record<string, any>): DiscountDraft | null {
  const type = (["amount_off_order", "amount_off_products", "free_shipping"].includes(c.type) ? c.type : "amount_off_order") as DiscountType;
  const value = type === "free_shipping" ? 0 : Number(c.value);
  if (type !== "free_shipping" && !(value > 0)) return null;
  return {
    type,
    valueKind: c.valueKind === "fixed" ? "fixed" : "percentage",
    value,
    minOrder: Math.max(0, Number(c.minOrder) || 0),
    code: String(c.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
    method: c.method === "automatic" ? "automatic" : "code",
    audience: (["everyone", "returning", "new", "lapsed"].includes(c.audience) ? c.audience : "everyone") as Audience,
    startsAt: typeof c.startsAt === "string" && c.startsAt ? c.startsAt.slice(0, 10) : isoDay(new Date()),
    endsAt: typeof c.endsAt === "string" ? c.endsAt.slice(0, 10) : "",
  };
}

export { fullName };
