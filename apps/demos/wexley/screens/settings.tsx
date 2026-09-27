import { useState, type FormEvent } from "react";
import { oneLine } from "../seed.ts";
import { useWexley } from "../session.ts";
import { Breadcrumbs, Button, Checkbox, Field, Heading, SummaryList, TextField, date } from "../ui.tsx";

export function Settings() {
  const { w, store, say, open } = useWexley();
  const [name, setName] = useState(w.resident.name);
  const [email, setEmail] = useState(w.resident.email);
  const [phone, setPhone] = useState(w.resident.phone);
  const [contact, setContact] = useState(w.settings.contact);
  const [editing, setEditing] = useState(false);
  const save = (e: FormEvent) => {
    e.preventDefault();
    const undo = store.commit("Save details", (d) => {
      d.resident.name = name.trim() || d.resident.name;
      d.resident.firstName = (name.trim() || d.resident.name).split(" ")[0];
      d.resident.email = email.trim() || d.resident.email;
      d.resident.phone = phone.trim();
      d.settings.contact = contact;
    });
    setEditing(false);
    say("Your details are saved.", undo);
  };
  return (
    <>
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Your details" }]} />
      <div className="wx-grid">
        <div>
          <Heading>Your details</Heading>
          {editing ? (
            <form onSubmit={save} noValidate>
              <TextField id="name" label="Full name" value={name} onChange={setName} autoComplete="name" width="20" />
              <TextField id="email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" width="20" />
              <TextField id="phone" label="Mobile number" hint="For text messages about collections and visits" type="tel" value={phone} onChange={setPhone} autoComplete="tel" width="10" />
              <Field id="contact" label="How we contact you" hint="Letters always come to your account. Choose where else you want to hear from us." legend>
                <div className="wx-checkboxes">
                  <Checkbox id="contact-email" label="Email" hint="A copy of every letter" checked={contact.email} onChange={(v) => setContact({ ...contact, email: v })} />
                  <Checkbox id="contact-text" label="Text message" hint="Reminders about bins, visits and payments" checked={contact.text} onChange={(v) => setContact({ ...contact, text: v })} />
                  <Checkbox id="contact-post" label="Post" hint="Paper copies of bills and decisions" checked={contact.post} onChange={(v) => setContact({ ...contact, post: v })} />
                </div>
              </Field>
              <div className="wx-actions">
                <Button type="submit">Save details</Button>
                <Button tone="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <SummaryList
                rows={[
                  { key: "Name", value: w.resident.name, action: <button type="button" className="wx-link" onClick={() => setEditing(true)}>Change<span className="wx-sr-only"> name</span></button> },
                  { key: "Address", value: oneLine(w.resident.address), action: <button type="button" className="wx-link" onClick={() => open("permit.address-change")}>Change<span className="wx-sr-only"> address</span></button> },
                  { key: "Email address", value: w.resident.email, action: <button type="button" className="wx-link" onClick={() => setEditing(true)}>Change<span className="wx-sr-only"> email address</span></button> },
                  { key: "Mobile number", value: w.resident.phone || "Not given", action: <button type="button" className="wx-link" onClick={() => setEditing(true)}>Change<span className="wx-sr-only"> mobile number</span></button> },
                  { key: "How we contact you", value: [w.settings.contact.email && "Email", w.settings.contact.text && "Text message", w.settings.contact.post && "Post"].filter(Boolean).join(", ") || "Your account only", action: <button type="button" className="wx-link" onClick={() => setEditing(true)}>Change<span className="wx-sr-only"> how we contact you</span></button> },
                  { key: "Account since", value: date(w.resident.since) },
                ]}
              />
              <p className="wx-body wx-small wx-muted">Changing your address changes it on your permit and council tax too. We ask you to check the permit zone first.</p>
            </>
          )}
          <section className="wx-section" aria-labelledby="demo">
            <h2 className="wx-h2" id="demo">
              This demonstration
            </h2>
            <p className="wx-body">
              Wexley Borough Council is a fictional council built on <a href="https://polyxd.com">Polyxd</a>. The pages you ask for are written as data, rendered in the GOV.UK Design System through Polyxd's tokens, and checked in 13 design systems before you see them. Everything you do stays in this browser.
            </p>
            <div className="wx-actions">
              <Button
                tone="warning"
                onClick={() => {
                  store.reset();
                  store.commit("Stay signed in", (d) => {
                    d.session.signedIn = true;
                  });
                  say("Everything is back to the start: Amira's permit, repair, claim and letters as they were.");
                }}
              >
                Reset this demo
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
