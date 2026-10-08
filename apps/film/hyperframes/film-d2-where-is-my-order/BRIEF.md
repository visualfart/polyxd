---
workflow: general-video
flow: automation
storyboard: no
message: "One ask, four verbs: describe the screen, style it in any design system, wire it to your code, trust it. Every ask gets a screen."
destination: website
aspect: 1920x1080
language: en
audience: "developers"
length: "about 91 s with the sting and outro"
---

## Intent

The developer film, second cut (`../STORY-DEV-2.md`): film D re-storied around one ask, #933 "Where's
my order? Show tracking in the app", in a deep IDE dark look. Film D (`../film-d-ship-the-screen/`) is
kept as it was; its machinery is reused (camera pose ladder, hw doodles, caption-clip-wipe, code typing,
token morph, the verifier's matrix, the payoff on the board).

Owner changes after the spec (8 Oct 2026), applied here:

- Payoff caption: "Every ask gets a screen." (was "Ship the screen, not the backlog.").
- Payoff board: To Do stays inside its column ("+N more"); each card moves To Do → In progress, where
  its real screen assembles on it, → Done, which is a wall of finished screens (film D's wall), each
  ticked; the camera pulls back to the whole wall. About a third of the asks are B2B and build into
  desktop screens (Carbon, Ant Design, Fluent, Polaris, Primer).
- Style it: kinds of design system, labelled beside the one prop: consumer app (Material 3), enterprise
  (Carbon, with crm-accounts-list in a desktop window), developer/minimal (shadcn/ui), public service
  (GOV.UK, which has no dark mode and renders light), two templates with character (terminal,
  brutalist), then yours (acme, from `npx polyxd pack`).
- The phone is always whole in frame, or deliberately out of it (the push-ins on code).
- Intro and outro: an ASCII glyph field that converges on the lockup (`shared/sting-ascii.html`,
  `shared/outro-ascii.html`, `shared/ascii-field.js`); the outro types the address with an orange cursor.
- Score: "Stylish Deep Electronic" (nveravetyanmusic), supplied by the owner, re-cut on its bars: the
  first accent is the ASCII hit, the impact bar opens the turn and the payoff's flight, the drop is the
  hit, the final hit is the outro's blink.
- The Open count rolls up with every issue that lands, ending at 412 (odometer chip, never clipped).
- The turn: the lifted card holds alone, then the mark and the question, then the morph.
- Describe it: "You or your agent / describe the screen. / Polyxd draws it."; the typing hands over from
  "you" to "✦ agent · via MCP", with "MCP server: mcp.polyxd.com/mcp" under the caption. (A separate MCP
  beat was built and then dropped at the owner's request.)
- Captions: left blocks of short lines, the picture composed to their right; no strips along the top.
- The order items (Desk lamp, LED bulbs) use the owner's supplied photos (.media/images), cropped on
  the product and passed through `resolveMedia` wherever the order screen renders.

## Rules kept

- Reading: every caption holds for at least words × 0.3 s + 1 s after it has finished appearing
  (at least 2.5 s). Code at 28 px or more on screen.
- Real: the screens are drawn by `@polyxd/web`'s browser build in each pack's dark mode; the order
  document is `packages/spec/examples/shop-order-status.json` plus one Action and `order.id`, and it
  passes `validateDocument` and `polyxd-verify` (100, agent 12/12); terminal output is what the commands
  printed in this repository, trimmed.
- No blue or purple in the film's own palette (the packs' own colours are theirs).
- Mix at −14 LUFS integrated, true peak at or under −1 dBTP.
