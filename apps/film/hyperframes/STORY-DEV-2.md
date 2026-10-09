# Film D2: "Ship the screen, not the backlog" (dark, one ask)

Second cut of the developer film (first cut: `STORY-DEV.md`, project `film-d-ship-the-screen`, kept as is).
The owner liked D but found it light and the story confusing: seven ideas in 70 s, design systems twice
30 s apart, six different code panes, three abstract captions saying the same thing. Owner's picks
(8 Oct 2026): backlog as **both** an issues list (opening) and a board (payoff); hero ask **"Where's my
order?"**; storyline **one ask, four verbs**; look **deep IDE dark**.

## The story in one breath

A developer's issue tracker is full of asks nobody will build. We follow one of them, #933 "Where's my
order? Show tracking in the app", through four verbs: **Describe** it, **Style** it, **Wire** it,
**Trust** it. Then the whole backlog moves to Done.

## Look: deep IDE dark

- Ground near-black `#0B0B0A` with a faint dot grid (dots `#F3F1EC` at ~5% opacity, 24 px pitch) that
  drifts very slightly with the camera (parallax), so camera moves read.
- Panels (editor, terminal, tracker): `#141413` / `#1C1B19`, 1 px borders `#2A2825`, soft long shadows
  and a faint orange rim light on the focused panel.
- Type: warm off-white `#F3F1EC`, muted `#A8A298`. Captions Young Serif in off-white, large.
- Signal orange `#FF6E40` is the only accent: cursor, line highlight band (orange at ~14% with a glow),
  hand-drawn doodles (hw family) in orange, ticks in orange or success `#4CC38A`.
- Syntax: a dark theme from the brand: keys off-white, strings `#FF8A63`, numbers `#E8C27A`,
  punctuation muted. No blue/purple (the owner dislikes them).
- Phone screens render in **dark mode** of each pack (polyxd-web `mode="dark"`), so the whole film is dark.
- Sting and outro: B's, on the dark ground (mark keeps orange p, white window, ink pupil; the wordmark
  goes off-white). End-card subtext "polyxd.com/docs · open source".
- Light glows sparingly: a bloom on the orange cursor and ticks, a vignette on the frame.

## Beat sheet (about 75 s)

| Time | Beat | Picture and motion | Caption |
|---|---|---|---|
| 0:00–0:05 | Sting | B's sting on dark. | |
| 0:05–0:15 | **The backlog** | A generic issues list (no GitHub name or logo): header "Issues", tabs "● 412 Open  ✓ 1,208 Closed". Rows land one by one with green open dots, `feature request` labels, avatars, 👍 counts ticking up: "#933 Where's my order? Show tracking in the app" 👍 214, "#1287 Let me cancel without emailing support", "#2041 Rotate my API key from the dashboard", "#1764 Review my booking before I pay", then faster, scrolling, the Open count climbing. hw note "+37 this week". | Your users ask for more than you'll ever build. |
| 0:15–0:20 | **The turn** | The list dims; the mark appears, looks along the rows, blinks; row #933 lifts out and flies to centre. | What if every ask came with its screen? |
| 0:20–0:32 | **1 · Describe it** | The issue card morphs into an editor tab `order-status.json`. About 8 lines stream in (from `packages/spec/examples/shop-order-status.json`, trimmed: Status "Out for delivery", DetailList, Collection of items). Beside it a dark phone draws the real screen part by part as hw arrows land (Status → banner, DetailList → address/courier, Collection → items). | Describe the screen. Polyxd draws it. |
| 0:32–0:44 | **2 · Style it** | Editor swaps to `Order.tsx`: `<PolyxdSurface document={doc} theme="material3" mode="dark" />`. Push in on the theme prop; retyped carbon → shadcn → then a terminal line `npx polyxd pack ./acme.css` (real output, 2–3 lines: "mapped 54 of 87 contract tokens") and the prop becomes `acme`; the phone morphs each time (token morph). hw circle "one prop". | Any design system. Including yours. |
| 0:44–0:51 | **3 · Wire it** | The doc has one action: "Change delivery time" (`order.reschedule`, context `{ orderId }`), see below. A tap; the ActionEvent card `{ name: "order.reschedule", context: { orderId: "4821" } }` flies out and lands on `onAction`, whose lines light with an hw circle round `rescheduleDelivery(context.orderId)`. | Your code decides what it does. |
| 0:51–1:00 | **4 · Trust it** | `npx polyxd-verify order-status.json --tasks tasks.json` types (real run, real score line); the phone fans into the 12-render matrix (3 packs × light/dark × 390/1100) ticking green in a diagonal wave; "100" circled. | Checked before anyone sees it. |
| 1:00–1:08 | **Payoff** | Long camera flight back. The tracker is now a board (To Do · In progress · Done), styled generic (no Jira name/logo): To Do overflowing with the same issues as cards with points and avatars. #933 is already a screen in Done; the rest flip into their real screens and slide to Done, faster and faster; To Do count runs to 0; tick. | Every ask gets a screen. |
| 1:08–1:16 | Outro | B's outro on dark, "polyxd.com/docs · open source". | |

## The order document's action

`shop-order-status.json` has no action. The film's doc is that example plus one Action
`{ "label": "Change delivery time", "action": { "event": { "name": "order.reschedule",
"context": { "orderId": { "path": "/order/id" } } } } }` and `order.id: "4821"` in data. It must pass
`validateDocument` and `polyxd-verify` for real; the terminal shows the real output.

## Cut from D

The agent / accessibility tree beat, the web-component beat, `validateDocument` in a node prompt,
`npm install` terminal, `polyxd dev` browser, the `$schema` squiggle, "Meaning, not pixels",
"A screen is a small document".

## Rules kept from D

Reading holds (words × 0.3 s + 1 s, captions ≥ 2.5 s), code ≥ 28 px on screen, a few lines at a time;
real renderer, real code, real terminal output; only what exists today; a score from the HeyGen catalogue
(re-cut of D's track is fine, on its bars); −14 LUFS, ≤ −1 dBTP.
