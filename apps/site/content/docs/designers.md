---
title: The designer's job
description: Where taste enters a system that generates its own interfaces — the four touchpoints, what each one is for, and who owns what.
order: 14.5
section: Concepts
---

# The designer's job

When interfaces are generated, the designer's job moves. It stops being "draw every screen" and becomes "decide what every screen must be like, and prove it". That is not less design work. It is the same judgement, applied once instead of a thousand times.

There are four touchpoints, each on a different clock.

## 1. Direction — set once, revisited occasionally

The [Design Direction](/docs/design-direction) package is a company's taste, versioned like code. A designer sets:

- **Voice and tone**: sentence case or title case, British or American spelling, how an error is phrased, words to avoid and what to say instead, whether the product says "we".
- **Profile**: [density](/docs/dense-software#density), how many primary actions a view may have, how eagerly secondary detail goes behind a disclosure, whether charts or tables are preferred.
- **Patterns**: which of the [core patterns](/docs/patterns) this product prefers, and which it never uses.
- **The design system pack**: where colour, type, spacing and shape come from.

Today this is a JSON file that lives with the product's code. It is meant to be edited through visual controls, which is what Studio is for.

**How often:** at the start, then when the brand or the product's stance changes.

## 2. Rules — written when something goes wrong, then held forever

This is the main lever, and the one that changes the job most.

When a designer sees something wrong in a generated screen, the useful response is not to fix that screen. It is to write the rule that makes the whole class of screens impossible:

```json
{ "id": "no-typed-confirm-on-reversible",
  "description": "A typed confirmation is only for actions that can't be undone",
  "severity": "error",
  "rule": { "check": "not", "checks": [{ "check": "requires", "component": "Confirm",
    "where": { "severity": "consequential" }, "props": ["typeToConfirm"] }] } }
```

Rules use the same [check vocabulary](/docs/patterns#how-a-pattern-checks-itself) the patterns use, so a rule written on Tuesday fails a bad screen on Wednesday, in every generated surface, for everyone.

A designer who writes ten good rules has done more for the product than one who reviews a hundred screens.

**How often:** whenever a review turns up something that will recur.

## 3. Review and ranking — regularly, on a sample

The system proposes several versions of the same interface. A designer ranks them, blind, and annotates what is wrong with each — down to a single element.

That ranking is the taste signal. It does three things:

- It measures the gap between what the verifier can check and what a designer actually wants. When we last did this, the verifier's order matched the designer's exactly in 5 of 10 cases: it knows safety, not taste ([what the score is not](/docs/verifier#what-the-score-is-not)).
- It becomes preference data: ranked pairs you can hand to whichever generator you use, as exemplars, as prompt guidance, or as tuning data if your generator takes it.
- It tells us which rules are missing. Anything a designer downranks that the verifier scored full marks for is a rule waiting to be written.

**How often:** a sample every release, and after any change to the generator or the direction.

## 4. Exemplars — whenever something is exactly right

A designer marks a finished surface as "this is what good looks like for this kind of task". The generator draws on exemplars for similar requests, and the verifier can hold new surfaces to their shape.

**How often:** rarely, and deliberately. Ten exemplars a designer stands behind beat a hundred nobody checked.

## Who owns what

| Decision | Owner |
|---|---|
| Voice, tone, density, patterns, the pack | Designer |
| Rules that constrain every generated surface | Designer, with engineering for the checks |
| What the product can do, and how risky each thing is ([capabilities](/docs/product#capabilities)) | Product manager, with engineering |
| Which journeys matter, and what "done" means for each | Product manager |
| Component semantics and the token contract | The spec (shared, versioned) |
| How a component looks on each platform | The design system pack |
| What appears on a given screen, right now | The generator, within all of the above |

The accessibility floor is not anyone's to trade away: it holds above direction, above rules, above preference.

## What this does not replace

- **Hand-designed critical flows.** Some screens deserve to be drawn and fixed. The way to do that today is an exemplar plus strict rules; a way to pin a surface outright is on the roadmap.
- **Research.** Nothing here tells you what people need. It tells the system how to say it once you know.
- **Judgement about the product.** The system will make a competent screen for a bad idea.

## Getting started as a designer

1. Read the [components](/docs/components) once. You are choosing meanings, not widgets.
2. Write your Design Direction: voice first, it changes every screen.
3. Rank a gold set of ten. Note what annoys you.
4. Turn the three most repeated annoyances into rules.
5. Re-rank. The gap between your order and the verifier's is your remaining work.
