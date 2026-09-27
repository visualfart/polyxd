# Polyxd — launch film, second cut

**Length** 82 s · **Format** 1920×1080 (plus 1080×1080) · **Sound** music + sound design, no voice-over (captions carry the words; a VO can be laid on the same timings later).

**The one idea:** every product has a screen for what you asked last year, and nothing for what you're asking now. Polyxd draws that screen the moment you ask, in the product's own design system, and checks it before you see it. Then it turns out the rest of the product can be written the same way.

**The shape:** a hook that names the pain in three seconds → the reversal → four proofs, each one *shown* rather than described → the turn ("and the rest of the product too") → the close on the mark.

**Visual language:** paper, ink, one accent. Kinetic type in Bricolage Grotesque, never centred for long. Every product moment is real footage of the real products, but *framed* by motion graphics: the JSON is a physical thing that flies, tokens are a swarm that repaints, the verifier is a scan line, the accessibility tree is a second drawing of the same screen. Motion follows the packs' easing (cubic-bezier(0.2, 0, 0, 1)); nothing bounces; hard cuts on the beat, long dissolves only through paper.

**Sound:** one track that starts as a single held note and gains a pulse at the reversal (0:07), opens up at the proofs (0:18), drops to almost nothing for "and the rest" (0:52), and resolves on the tick (1:19). SFX: paper-dry clicks for type, a soft "arrive" for a screen appearing, a tick for the verifier, a low woosh for the token swarm, a single blink. Nothing cartoonish.

---

## 0:00–0:03 · HOOK · "Sorry"

Black-ink frame. Rapid cuts, 0.4 s each, of the dead ends everyone knows, set as plain product copy on the paper of five different fake apps (never a real brand): *"No results."* · *"That feature is coming soon."* · *"I can't help with that here."* · *"Please contact support."* · *"Try the desktop version."* Each one lands with a dry click. The last one is a chat bubble typing "…" that never resolves.

**Music:** a single low note, held.

## 0:03–0:07 · THE LINE

Paper. One line, typed in at reading speed, ink:

> **Every product has a screen for what you asked last year.**

Beat. Then under it, in the accent:

> **Nothing for what you're asking now.**

**SFX:** type clicks; one bass hit on "now".

## 0:07–0:12 · THE REVERSAL

The two lines fold away like paper. The mark blinks once, alone, centre. It looks left (the "reading" state) as an ask box slides in from the left edge and someone types, live:

`send £40 to priya for dinner`

Return. The music gets its pulse.

**On screen (small, bottom):** Halden · a current account · Material 3

## 0:12–0:18 · THE SCREEN ARRIVES

Hard cut to the phone, real footage: the skeleton draws itself in pencil strokes (motion-graphic overlay over the real skeleton), then snaps into the real form. Priya is already chosen, £40 already typed. Thumb taps Continue; the confirmation; **Send £40.00**; the snackbar.

Caption, right side, three lines that appear on the beat:

> Drawn the moment you ask.
> In the product's own design system.
> Checked before you see it.

**SFX:** pencil scratch for the skeleton, the "arrive" as it snaps real, a soft confirm on Send.

## 0:18–0:30 · PROOF 1 · MEANING, NOT PIXELS

The phone screen lifts off the phone and lays flat; it *unfolds* into its JSON: each component becomes a card with its type (`Choice`, `TextInput`, `Confirm`) and the cards hang in a tree, connected by hairlines. Caption: **"The interface is a document. Meaning only. No pixels, no colours, no fonts."**

Then the swarm: thirteen tokens fly in from the edges (`--pxd-color-action-primary-background`, `--pxd-radius-control`, `--pxd-type-title-page-size`…) and hit the tree, and the tree *re-forms* as the real rendered screen — in Carbon. Beat. Swarm again → Polaris. Beat → GOV.UK. Faster → shadcn → Fluent → Spectrum → then slow, deliberate: **Sketch** (the whole frame goes hand-drawn: wobbling borders, a handwritten label) and **Wireframe** (greyscale, dashed). Caption: **"Thirteen design systems' real tokens. Twelve templates to make your own."**

**SFX:** woosh per swarm, a paper-flip per pack, a pencil scribble for Sketch.

## 0:30–0:40 · PROOF 2 · CHECKED

The Sketch screen snaps back to Material 3. A scan line sweeps top to bottom; as it passes, small ticks appear beside each control (contrast ✓, target size ✓, label ✓, reading order ✓). Then the frame multiplies into a 13 × 2 × 2 grid (packs × light/dark × phone/desktop): 52 tiny renders, each ticking green in a wave. Caption: **"Verified in every design system, light and dark, phone and desktop. Before anyone sees it."** Cut to the real Checked mark and the drawer's Report tab, for two seconds, so it's clearly real.

**SFX:** the scan as a rising tone; ticks as a soft cascade; the grid wave as a shimmer.

## 0:40–0:48 · PROOF 3 · PEOPLE AND AGENTS

Split frame. Left: the screen. Right: the same screen drawn as its accessibility tree (role · name · state), one line per control, building as the left renders. A pointer on the left and a highlight on the right move *together* through the form: choose Priya, type 40, Continue. Caption: **"Screen readers read exactly what agents press."** Then the right side alone completes the task, in 1.2 s, no pointer: **"If an agent can't finish by name alone, the surface fails."**

**SFX:** a clean UI click per step; the agent run as a quick ratchet.

## 0:48–0:52 · THE TURN

Everything clears to paper. Music drops to the held note. One line:

> **And the rest of the product?**

## 0:52–1:04 · PROOF 4 · GENERATED OR AUTHORED

Studio, real footage: the Screens editor, a designer selects a component, the property panel updates, the preview follows, in the workspace's own design system. Caption: **"Designers write screens in the same format. Same renderer. Same checks."**

Then Foundry, desktop, dark: the whole frame around the screen — sidebar, top bar — draws itself in hairlines *as a document* (the Frame's regions labelled: header · navigation · main · footer), then fills in as the real product. Caption: **"The shell too. Authored once. A generated screen can never draw it."**

**SFX:** the draw as a pencil line; the fill as the "arrive".

## 1:04–1:12 · YOURS

Four products in quick succession, each with its own ask landing on screen: Quay "why did sales drop last week" → the reasons; Wexley "I've moved" → the wizard; Foundry "accounts renewing with open tickets" → the list; Halden's confirmation from the start. Between them, three words flash: **React** · **Web Components** · **your renderer**. Caption: **"Open spec. Any model, or none. Your design system. Your stack."**

## 1:12–1:22 · CLOSE

Paper. The mark, large, idle. It blinks. The pupil becomes the tick (the "checked" state) — the last thing that moves — and the music resolves on it. The wordmark settles beside it.

> **polyxd.com**
> Open source · Apache-2.0

Hold two seconds. Cut to black.

---

### Captions (SRT source)
See `captions.srt`, generated from `src/script.ts` with these lines and timings.

### Notes for production
- The fake apps in the hook are invented (no logos, generic names like "Ledger", "Tidings"); the dead-end lines are ours.
- Real footage is captured from the running products at 2×; the pencil skeleton, the JSON unfold, the token swarm, the scan, the grid, the a11y tree and the frame-draw are Remotion graphics keyed to the footage.
- Music from Apple Loops (royalty-free with GarageBand) assembled to the structure above, or synthesised if GarageBand can't be driven; SFX synthesised (filtered noise sweeps, sine ticks, paper clicks) with ffmpeg/Web Audio, mixed under the music at −18 dB.
