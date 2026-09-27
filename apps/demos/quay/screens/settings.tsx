import { useState } from "react";
import { useQuay } from "../session.ts";
import { Button, Card, Field, Kbd, Page, Segmented, plural } from "../ui.tsx";
import { MOD } from "../app.tsx";

export function Settings() {
  const { h, store, say } = useQuay();
  const [shop, setShop] = useState({ name: h.shop.name, email: h.shop.email, phone: h.shop.phone, line1: h.shop.address.line1, city: h.shop.address.city, state: h.shop.address.state, zip: h.shop.address.zip });
  const [owner, setOwner] = useState({ name: h.shop.owner.name, email: h.shop.owner.email });
  const shopDirty = shop.name !== h.shop.name || shop.email !== h.shop.email || shop.phone !== h.shop.phone || shop.line1 !== h.shop.address.line1 || shop.city !== h.shop.address.city || shop.state !== h.shop.address.state || shop.zip !== h.shop.address.zip;
  const ownerDirty = owner.name !== h.shop.owner.name || owner.email !== h.shop.owner.email;
  const saveShop = () => {
    if (!shop.name.trim()) return;
    const undo = store.commit("Store details", (d) => {
      d.shop.name = shop.name.trim();
      d.shop.email = shop.email.trim();
      d.shop.phone = shop.phone.trim();
      Object.assign(d.shop.address, { name: shop.name.trim(), line1: shop.line1.trim(), city: shop.city.trim(), state: shop.state.trim(), zip: shop.zip.trim() });
    });
    say("Store details saved.", undo);
  };
  const saveOwner = () => {
    if (!owner.name.trim()) return;
    const undo = store.commit("Account", (d) => {
      d.shop.owner.name = owner.name.trim();
      d.shop.owner.email = owner.email.trim();
    });
    say("Account saved.", undo);
  };
  return (
    <Page title="Settings" subtitle="Store details, your account, how Quay looks, and the demo's reset switch." narrow>
      <Card title="Store details">
        <form
          className="q-form"
          onSubmit={(e) => {
            e.preventDefault();
            saveShop();
          }}
        >
          <div className="q-form-row">
            <Field label="Store name" htmlFor="shop-name">
              <input id="shop-name" className="q-input" value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} required />
            </Field>
            <Field label="Store contact email" htmlFor="shop-email" hint="Customers see this on receipts and reminders.">
              <input id="shop-email" className="q-input" type="email" value={shop.email} onChange={(e) => setShop({ ...shop, email: e.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="shop-phone">
              <input id="shop-phone" className="q-input" value={shop.phone} onChange={(e) => setShop({ ...shop, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Address" htmlFor="shop-line1" hint="Where orders ship from. Taxes are charged by the customer's state.">
            <input id="shop-line1" className="q-input" value={shop.line1} onChange={(e) => setShop({ ...shop, line1: e.target.value })} />
          </Field>
          <div className="q-form-row">
            <Field label="City" htmlFor="shop-city">
              <input id="shop-city" className="q-input" value={shop.city} onChange={(e) => setShop({ ...shop, city: e.target.value })} />
            </Field>
            <Field label="State" htmlFor="shop-state">
              <input id="shop-state" className="q-input" value={shop.state} onChange={(e) => setShop({ ...shop, state: e.target.value })} maxLength={2} />
            </Field>
            <Field label="ZIP" htmlFor="shop-zip">
              <input id="shop-zip" className="q-input" value={shop.zip} onChange={(e) => setShop({ ...shop, zip: e.target.value })} />
            </Field>
          </div>
          <div className="q-row" style={{ justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" disabled={!shopDirty}>
              Save
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Your account">
        <form
          className="q-form"
          onSubmit={(e) => {
            e.preventDefault();
            saveOwner();
          }}
        >
          <div className="q-form-row">
            <Field label="Name" htmlFor="owner-name" hint="Shown on comments you leave.">
              <input id="owner-name" className="q-input" value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} required />
            </Field>
            <Field label="Email" htmlFor="owner-email">
              <input id="owner-email" className="q-input" type="email" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
            </Field>
          </div>
          <div className="q-row" style={{ justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" disabled={!ownerDirty}>
              Save
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Appearance">
        <div className="q-stack">
          <Segmented label="Appearance" value={h.settings.appearance} onChange={(v) => store.commit("Appearance", (d) => void (d.settings.appearance = v))} options={[{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }]} />
          <p className="q-small q-muted">Follows the system unless you pick one. Polaris ships both, so the screens Quay writes follow too.</p>
        </div>
      </Card>
      <Card title="Keyboard">
        <dl className="q-kv">
          <dt>
            <Kbd>{MOD}</Kbd> <Kbd>K</Kbd>
          </dt>
          <dd>Search orders, products and customers, or ask Quay</dd>
          <dt>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>↵</Kbd>
          </dt>
          <dd>Move through the results and open</dd>
          <dt>
            <Kbd>esc</Kbd>
          </dt>
          <dd>Close a sheet, the search or the navigation</dd>
        </dl>
      </Card>
      <Card title="This demo">
        <div className="q-stack" style={{ gap: 12 }}>
          <p className="q-small q-muted" style={{ maxWidth: "70ch" }}>
            The screens you ask for are generated as Polyxd documents, rendered in Polaris through Polyxd's semantic tokens, and verified in thirteen design systems before they show. Lantern &amp; Wick, its {plural(h.products.length, "product")}, {plural(h.orders.length, "order")} and {plural(h.customers.length, "customer")} are invented. Everything you do here stays in this browser; Reset puts the seed back.
          </p>
          <div className="q-row">
            <Button
              onClick={() => {
                store.reset();
                say("Back to the start: the store as it was this morning.");
              }}
            >
              Reset the demo
            </Button>
          </div>
        </div>
      </Card>
    </Page>
  );
}
