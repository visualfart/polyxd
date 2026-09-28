# Film D: "Ship the screen, not the backlog"

A film for developers, made the way B5 was: a story with a start, a middle and an end, the docs'
ideas made visual, hand-drawn doodles that arrive, point and leave, a camera that works the code and
the interface, captions that hold long enough to read twice, and its own score. About 75–85 seconds.
Uses B's intro sting; the outro is B's, with the subtext "polyxd.com/docs · open source".

Everything shown exists today (see apps/site/content/docs: quickstart, ui-documents, renderers,
verifier, people-and-agents, your-design-system, design-systems). Code in the film is real and would
run: take it from the docs. Do not claim planned things (a runtime SDK, an MCP server, native SwiftUI or
Compose renderers, a model of Polyxd's own).

## The story in one breath

A developer's backlog is full of things users asked for and nobody built: a screen for every ask. Polyxd
turns a screen into data. A screen is a small JSON document of meaning; one component draws it in any
design system; your code handles what it does; the spec and the verifier check it before anyone sees
it; your own design system comes in with one command; and it isn't tied to React. Then the backlog
empties: each ask becomes a screen.

## Beat sheet

| Time | Scene | Picture and motion | Words | Sound |
|---|---|---|---|---|
| 0:00–0:05 | Intro | B's logo sting. | | Sting into the score |
| 0:05–0:15 | **Cold open: the backlog** | A developer's board: sticky notes land one by one, handwritten, each held to read: "Split the dinner bill", "Change my address", "Return these shoes", "Export March as CSV"… then faster, piling up and overflowing the frame. The camera pulls back to show the pile. Doodle: a counter "+37 this week". | "Your users ask for more than you'll ever build." | Paper slaps on the beat, building |
| 0:15–0:19 | **The turn** | The pile freezes. The mark appears; its pupil looks at the pile, blinks. One note ("Split the dinner bill") peels off and flies to the centre. | "What if a screen were just data?" | A drop, a riser |
| 0:19–0:30 | **A screen is a document** | The note becomes a UI document typing itself in an editor (real JSON from packages/spec/examples, short excerpt): `"component": "Choice"`, `"TextInput"`, `"submit"`. Beside it the real renderer draws the screen, part by part. Hand-drawn arrows connect each JSON component to the part it becomes, one at a time. Doodle note: "meaning, not pixels". | "A screen is a small document." (0:20) → "Meaning, not pixels." (0:25) | Typing; a glint per part |
| 0:30–0:40 | **One component draws it** | The editor shows `npm install @polyxd/react` then the quickstart's `<PolyxdSurface document={doc} theme="material3" />`. The camera pushes in on `theme="material3"`; the string is retyped to `"carbon"`, then `"govuk"`, and the screen beside it morphs to match each time (B's token morph). Doodle: circle round the prop, "one prop". | "One component draws it, in any design system." | A whoosh per morph |
| 0:40–0:48 | **Your code decides** | Tap the screen's button: an `onAction` event flies out as a small card `{ name: "transfer.confirm", context: {…} }` and lands in the developer's handler, which lights up. Doodle: arrow, "you decide what happens". | "Your code decides what it does." | A tap; a soft land |
| 0:48–0:59 | **Checked before anyone sees it** | `validateDocument(doc)` returns `valid: true` (a doodle tick). Then `polyxd-verify` runs: the screen multiplies into a grid (design systems × light/dark × phone/desktop) that ticks green in a wave; the accessibility tree draws beside one screen and an agent completes the task by name (the highlight moves through the controls on its own). | "The spec and the verifier check every screen." (0:49) → "People and agents can use it." (0:55) | A shimmer on the wave; a quick ratchet for the agent |
| 0:59–1:08 | **Bring your own design system** | A terminal: `npx polyxd pack ./tokens` guesses the roles and prints a contrast report; `npx polyxd dev` opens a live preview beside it; in the editor, a `$schema` line brings autocomplete and a red squiggle on a mistake that's fixed. Doodle: "your tokens, one command". | "Your design system comes in with one command." | Keys; a small chime on the preview |
| 1:08–1:14 | **Not React? Fine.** | The same document in plain HTML: `<polyxd-surface>`; the same screen renders; a small "same fingerprint" tick between the two renders. | "Not React? The same screen as a web component." | A clean click |
| 1:14–1:22 | **Payoff: the backlog empties** | Back to the board: each sticky note flips into a small real screen (split the bill, change address, return shoes, export CSV…) and is ticked off by hand, faster and faster, until the board is clear. | "Ship the screen, not the backlog." | The score peaks and resolves |
| 1:22–1:30 | Outro | B's outro with the subtext "polyxd.com/docs · open source". | | Final chord |

## Rules

- One focus at a time; each caption, code line and doodle holds for at least its word count × 0.3 s + 1 s
  after it finishes appearing. Code is set large enough to read at 1080p (at least 28 px), and only a
  few lines at once: zoom into the line that matters.
- The screens are the real renderer; the code is the docs' real code; the terminal output is real
  (run the commands and use their actual output, trimmed).
- Its own score from the HeyGen catalogue: upbeat, modern, a clean electronic pulse, different from
  B5's and the Studio film's tracks.
