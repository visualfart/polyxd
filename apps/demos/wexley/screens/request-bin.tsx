import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BIN_NAMES, type BinKind } from "../seed.ts";
import { useWexley } from "../session.ts";
import { BackLink, Button, ErrorSummary, Heading, Radios } from "../ui.tsx";

const REASONS = [
  { value: "My bin is damaged", label: "My bin is damaged" },
  { value: "My bin was lost or stolen", label: "My bin was lost or stolen" },
  { value: "I have moved in and there is no bin", label: "I have moved in and there is no bin" },
  { value: "My household needs a bigger bin", label: "My household needs a bigger bin", hint: "For 6 or more people, or a medical reason" },
];

export function RequestBin() {
  const { store, say } = useWexley();
  const navigate = useNavigate();
  const [bin, setBin] = useState<BinKind | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([]);
  const err = (id: string) => errors.find((e) => e.id === id)?.message;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = [];
    if (!bin) found.push({ id: "bin-refuse", message: "Select which bin you need" });
    if (!reason) found.push({ id: "reason-My bin is damaged", message: "Select why you need it" });
    setErrors(found);
    if (found.length) return;
    const undo = store.commit("Request bin", (d) => {
      d.bins.requests.unshift({ id: `req_${Date.now().toString(36)}`, bin: bin!, reason: reason!, at: new Date().toISOString(), status: "requested" });
    });
    say(`We have your request for a ${BIN_NAMES[bin!].toLowerCase()}. It is delivered within 10 working days.`, undo);
    navigate("/bins");
  };
  return (
    <>
      <BackLink to="/bins" />
      <div className="wx-grid">
        <div>
          <ErrorSummary errors={errors} />
          <form onSubmit={submit} noValidate>
            <Heading caption="Bins">Request a bin</Heading>
            <Radios id="bin" legend="Which bin do you need?" options={(["refuse", "recycling", "food", "garden"] as BinKind[]).map((k) => ({ value: k, label: BIN_NAMES[k] }))} value={bin} onChange={setBin} error={err("bin-refuse")} />
            <Radios id="reason" legend="Why do you need it?" options={REASONS} value={reason} onChange={setReason} error={err("reason-My bin is damaged")} />
            <p className="wx-body">A replacement bin is free. A bigger bin needs a short check first, and we call you about it.</p>
            <Button type="submit">Request bin</Button>
          </form>
        </div>
      </div>
    </>
  );
}
