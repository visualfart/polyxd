# Film S: "Who gives AI taste?"

A film about Polyxd Studio, made the way B5 was: a story with a start, a middle and an end, hand-drawn
doodles that arrive, point and leave, a camera that works the interface, captions that hold long enough
to read twice, and its own score. About 75–80 seconds. Uses B's intro sting; the outro is B's, with
the subtext "Polyxd Studio · studio.polyxd.com".

Everything shown is Studio as it exists today (apps/studio, docs/studio.md): importing a design system,
templates, scan, mapping roles with contrast, the tokens editor and rebrand, exports, which components
generated screens may use with guidance, rules as checks with a severity, the Screens editor and shells,
versions and publishing, fetching a published screen by key, the team. Do not show or claim anything
planned (reviews queue, insights or analytics, releases, rollouts, Direction applied during generation).

## The story in one breath

An AI can draw any screen now. But it draws it the way nobody on your team would: three shouting
buttons, "Oops!", the wrong blue. Taste is the thing a model doesn't have. So who gives it taste? The
people who already have it: your designers, in Studio. They bring the design system, tune it, decide
which parts screens may use, write the rules in plain words, author the screens that should never be
generated, and publish. Then the same ask comes back, and the screen is theirs.

## Beat sheet

| Time | Scene | Picture and motion | Words | Sound |
|---|---|---|---|---|
| 0:00–0:05 | Intro | B's logo sting. | | Sting into the score |
| 0:05–0:16 | **Cold open: a tasteless screen** | A product's ask box: "Cancel my subscription". A screen assembles fast and confidently: technically fine, but everything a design team would wince at (render a real document through the renderer, then visibly override its styling for this shot only: three primary buttons side by side, "CANCEL SUBSCRIPTION NOW" in capitals, "Oops! Sad to see you go 😢" copy, a loud off-brand blue, a cramped layout). The camera slowly pushes in. Doodles arrive one at a time, each held to read: a circle round the three buttons, "3 primary buttons?"; an arrow at the copy, "we'd never say that"; a scribble on the colour chip, "not our blue". | "AI can draw any screen." (0:08) → "But who gives it taste?" (0:12) | A quiet, curious opening; a pen scratch per doodle |
| 0:16–0:21 | **The turn** | The screen tilts away and shrinks to a sticky note on paper. The Polyxd mark appears; its pupil looks at the note, then at the camera. A hand-drawn arrow sweeps to a Studio window sliding in. | "Your designers do." (0:17) → "In Studio." (0:19) | The score lifts |
| 0:21–0:31 | **Bring your design system** | Studio's import (real Studio UI): file chips fly in and land: an npm package, a Tokens Studio file, a DTCG file, CSS variables. The scan counts up tokens by tier; the mapping shows Polyxd's roles filling in, and contrast pairs tick green one by one (doodle ticks, a note "every pair measured"). | "Bring your design system as it is." | Soft landings for each chip; ticks |
| 0:31–0:39 | **Tune it** | The tokens editor: the camera pushes in on a colour ramp; the Rebrand slider sweeps the hue; every alias follows; the contrast readout re-measures (doodle: "still passes"). Pull back to show the same screen re-coloured. | "Tune it, and everything follows." | A sweep under the slider |
| 0:39–0:48 | **Decide what screens may use** | Studio's component direction: components switch on and off; one component (Choice) opens with its guidance note typed in by a designer ("Up to six options; more goes in a list"). Doodle: circle round the note, "the generator reads this". | "Decide what screens may use." | Toggle clicks on the beat |
| 0:48–0:58 | **Write the rules** | Studio's rules: three rules are written in plain words and saved as checks with a severity: "One primary action per screen", "Sentence case", "Never say 'Oops'". Each saved rule flies across to the cold-open screen (small, on the left) and fixes its problem with a hand-drawn strike and correction: two of the three buttons become secondary, the capitals become sentence case, "Oops!" is struck through and replaced. | "Write the rules in plain words." (0:49) → "Every screen is checked against them." (0:54) | A tick and a small chime per rule applied |
| 0:58–1:05 | **Author what shouldn't be generated** | The Screens editor: component tree, property panel and live preview; a designer selects a component and the preview follows; then the shell (frame, navigation, outlet) draws itself in hairlines and fills in. Doodle: arrow at the shell, "the part that's always yours". | "Author the screens that shouldn't be generated." | A pencil-line sound under the hairlines |
| 1:05–1:11 | **Publish** | Publish; a version tag stamps on; the screen flies to a phone and a laptop (a product fetching it by key: a tiny code line `GET /screens/cancel`); export chips fan out (CSS, Tailwind, Swift, Kotlin). | "Publish it. Your products fetch it." | A hit on Publish |
| 1:11–1:18 | **Payoff: the same ask again** | Back to the product: "Cancel my subscription" again. This time the screen that arrives is the team's: one clear primary action, their voice ("Your plan ends on 30 October. You can come back any time."), their colours, calm spacing. The mark's pupil turns into the tick beside it. | "Now the screen is yours." | The score resolves toward the ending |
| 1:18–1:26 | Outro | B's outro with the subtext "Polyxd Studio · studio.polyxd.com". | | Final chord |

## Rules

- One focus at a time; each caption and doodle holds for at least its word count × 0.3 s + 1 s after
  it finishes appearing; nothing leaves before it's readable.
- Studio's UI is the real Studio (capture it from a local seeded Studio: apps/studio/scripts/landing-shots.ts
  shows how to seed and capture), zoomed and moved like B5; the product screens are the real renderer.
- Its own score from the HeyGen catalogue: curious and elegant at the start, confident and warm by the
  end, different from B5's track.
