---
title: Your design system
description: Make a Polyxd pack out of your own tokens with one command, and find out in a minute what the contract still needs from you.
order: 3
section: Start
---

# Your design system

Polyxd ships thirteen packs — Material 3, Carbon, Ant, Fluent, shadcn, Bootstrap, Mantine, Radix, Polaris, Primer, Spectrum, GOV.UK, Chakra. You almost certainly want a fourteenth: yours.

```sh
npx polyxd pack ./src/tokens.css
```

That reads your CSS custom properties, works out which of the contract's 87 tokens each one is, and writes a pack plus `polyxd.mapping.json` recording every guess it made. Correct the wrong lines, fill the blanks, run it again.

It takes a DTCG JSON file too, and `--dark ./dark.css` when your two modes live in separate files.

## What one run looks like

```
read 42 variables from tokens.css

mapped 61 of 87 contract tokens
  46 from their names
  color.surface.default ← acme-bg (the lightest colour you define)
  color.text.default ← acme-text (17.8:1 on your page colour)

15 tokens took a Polyxd default (state opacities, touch target, focus ring, motion).

still needed — nothing in your tokens matched, and there is no sensible default:
  color.scrim                        (color)
  color.text.link                    (color)
  color.action.secondary.border      (color)

3 of your own pairs don't meet the contrast the contract requires:
  color.border.strong on color.surface.default: 2.56:1, needs 3:1
  color.border.focus on color.surface.default: 1.80:1, needs 3:1
  These are your tokens, not ours — the pack won't paper over them.
```

Three questions to answer and two decisions to make, rather than a specification to read.

## How it guesses

**Names first.** A variable called `--border-focus` is telling you what it is. Patterns are matched against the name and every suffix of it, so `--acme-border` and `--border` map alike — real files mix prefixed and bare names, so guessing one project-wide prefix doesn't work.

**Then the kind of value.** A `16px` never becomes a colour, whatever it's called.

**Then measurement,** for the two roles defined by contrast rather than by name: your page colour is the lightest you define, and your body text is the furthest from it that still clears 4.5:1.

**Then what one role implies about another.** A system that names a success colour has said enough for a chart's positive series. A system with an informative tint has said enough for a selected row. Each of these is marked `derived` and names where it came from, so you can disagree.

**Never invention.** Where the contract needs something your tokens don't have, it says so. It will not pick a colour for you.

## What Polyxd fills in

Fifteen tokens aren't values a design system publishes: state-layer opacities, the 44px touch target, the focus ring's width and offset, the 65-character measure, and motion durations when you have none. These are the same for everyone and you shouldn't have to invent them. Override any of them in the mapping.

## Then check it

```sh
npx polyxd check ./ds-acme/manifest.json
```

Every token present and correctly typed, all 34 contrast pairs measured with alpha compositing, every constraint met. This is the same check the thirteen shipped packs pass, and it's the thing that tells you a generated interface in your design system will be readable before anyone sees it.

## The contrast failures are worth reading

Every pack in this repository needed adjustments, including ones built by very large teams: Ant's primary blue is 4.10:1 with white text, Chakra's focus ring is 1.48:1 on the page, Carbon's light warning colour is 1.68:1. Yours will have some too. Where a role fails, move it to the nearest passing step of your own ramp rather than inventing a colour, and write down why — that's what [every pack here does](/docs/design-systems).
