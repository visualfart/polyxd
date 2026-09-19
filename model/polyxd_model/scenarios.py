"""Generates training scenarios (request + host capabilities + host data) with a local open model.

Scenarios are separate from the benchmark: near-duplicates of benchmark requests are dropped, so
bench/requests.json stays held out. Output: model/data/scenarios.jsonl

    uv run python -m polyxd_model.scenarios --model mlx-community/gemma-4-e4b-it-4bit --count 400
"""

from __future__ import annotations

import argparse
import json
import random
import re
from pathlib import Path

from mlx_lm import load, stream_generate
from mlx_lm.sample_utils import make_sampler

from .constrain import SchemaConstraint
from .prompt import BENCH, REPO, registry

DATA = REPO / "model" / "data"

DOMAINS = {
    "money": "personal banking and budgeting: balances, payments, transfers, cards, bills, savings, spending",
    "productivity": "tasks, projects, notes and to-dos for individuals and small teams",
    "calendar": "events, meetings, availability, reminders and scheduling",
    "commerce": "shopping, orders, returns, subscriptions, baskets and product choice",
    "travel": "flights, hotels, trips, bookings, check-in and itineraries",
    "settings": "account, security, notifications, team members and admin settings",
    "personal": "habits, health tracking, journaling, reading, hobbies and personal records",
    "business": "software teams use at work: customer and account lists, invoices and billing, support tickets, inventory, orders, team admin — records people scan, sort, filter, select and act on in bulk",
}

KINDS = [
    "view something (a summary, a list, a detail)",
    "create something with a few fields",
    "change a setting",
    "do something consequential (pay, book, send)",
    "delete or cancel something",
    "compare a few options and choose",
    "find something in a longer list",
    "a vague or very short request",
    "a request with several steps",
    "work with many records at once (sort, filter, select several, act in bulk)",
    "open one record and see everything about it",
]

SCENARIO_SCHEMA = {
    "type": "object",
    "required": ["request", "intent", "capabilities", "data"],
    "properties": {
        "request": {"type": "string", "minLength": 3, "maxLength": 160},
        "intent": {"type": "string", "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"},
        "capabilities": {"type": "array", "minItems": 0, "maxItems": 4, "items": {"type": "string"}},
        "data": {"type": "object"},
    },
    "additionalProperties": False,
}


def words(s: str) -> set[str]:
    return set(re.findall(r"[a-z]+", s.lower()))


def too_close(request: str, others: list[str]) -> bool:
    w = words(request)
    return any(len(w & words(o)) / max(1, len(w | words(o))) > 0.6 for o in others)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="mlx-community/gemma-4-e4b-it-4bit")
    ap.add_argument("--count", type=int, default=400)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    random.seed(args.seed)
    DATA.mkdir(parents=True, exist_ok=True)
    out_path = DATA / "scenarios.jsonl"
    bench_requests = [r["request"] for r in json.loads((BENCH / "requests.json").read_text())["requests"]]
    caps = registry()
    by_domain: dict[str, list[str]] = {}
    for name in caps:
        by_domain.setdefault(name.split(".")[0], []).append(name)

    model, tokenizer = load(args.model)
    kept: list[dict] = []
    seen: list[str] = []
    if out_path.exists():
        kept = [json.loads(l) for l in out_path.read_text().splitlines() if l.strip()]
        seen = [k["request"] for k in kept]
    attempts = 0
    with out_path.open("a") as f:
        while len(kept) < args.count and attempts < args.count * 3:
            attempts += 1
            domain = random.choice(list(DOMAINS))
            kind = random.choice(KINDS)
            offered = random.sample(list(caps), k=min(14, len(caps)))
            cap_lines = "\n".join(f"- {c} (risk {caps[c]['risk']}): {caps[c]['description']}" for c in offered)
            prompt_text = f"""Invent one realistic request a user might type into an app, and the data the app would have.
Domain: {DOMAINS[domain]}.
Kind of request: {kind}.
Choose 0–3 of these capabilities that the app would offer for this request (use exact names; choose none if nothing fits, which is sometimes right):
{cap_lines}

Return JSON: "request" (what the user types, natural, varied, sometimes terse), "intent" (dotted lower_snake key, e.g. "money.savings.view"),
"capabilities" (chosen names), "data" (small realistic JSON the app would already have: 3–12 fields, lists of 2–6 items with ids where items can be acted on, real-looking names, amounts and ISO dates; no placeholders)."""
            messages = [{"role": "user", "content": prompt_text}]
            try:
                prompt = tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False, enable_thinking=False)
            except TypeError:
                prompt = tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
            constraint = SchemaConstraint(tokenizer, SCENARIO_SCHEMA)
            text = ""
            for resp in stream_generate(model, tokenizer, prompt, max_tokens=900, sampler=make_sampler(temp=0.9, top_p=0.95), logits_processors=[constraint]):
                text += resp.text
                if constraint.matcher.is_stopped():
                    break
            try:
                sc = json.loads(text)
            except json.JSONDecodeError:
                continue
            sc["capabilities"] = [c for c in sc.get("capabilities", []) if c in caps]
            if too_close(sc["request"], bench_requests) or too_close(sc["request"], seen) or not sc.get("data"):
                continue
            sc = {"id": f"train-{len(kept):04d}", "domain": domain, "kind": kind, **sc}
            kept.append(sc)
            seen.append(sc["request"])
            f.write(json.dumps(sc, ensure_ascii=False) + "\n")
            f.flush()
            print(f"{len(kept):4d}  {domain:<12} {sc['request'][:70]}", flush=True)
    print(f"kept {len(kept)} scenarios after {attempts} attempts → {out_path}")


if __name__ == "__main__":
    main()
