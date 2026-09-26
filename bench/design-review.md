# Reviewing two models against the approved designs

The reviewer sees, for each request, the approved design's artboards and two answers, X and Y, each rendered in Material 3 at 390 px and 1100 px. Which model wrote which is hidden and shuffled per request. The job is to say which answer is closer to the approved design as a screen someone would ship, not which one is closer in pixels.

`fit: "same"` means the design is this request's own screen. `fit: "analog"` means the design is the same kind of screen for different content: judge structure, hierarchy, controls and flow, not the content.

## What to rate, in order of weight

1. **Job.** Does the screen do what the request asked, with the host's real data? A screen whose values are blank, a placeholder like `{label}`, `[object Object]` or an id where a name belongs fails its job, however tidy it looks. A wrong answer ("No slots found" when there are three) is worse than an incomplete one.
2. **Hierarchy.** Is the most important thing the most prominent, as in the design: the amount on a payment, the free slots on a calendar, the recommended plan on a comparison? One heading, not three saying the same thing.
3. **Structure and controls.** The design's components for the job: chips where it uses chips, a table where it has a dense table, a clear primary action that says what it does, Cancel beside a commit, undo instead of a confirm for low-risk deletes.
4. **Completeness.** What the design shows that the answer leaves out (what's left in the budget, when access ends, who else will be notified), and what the answer adds that the design deliberately doesn't.
5. **Copy.** Plain, specific, second person where the person is acting; no "Are you sure", no descriptions that repeat their label, no filler subtitles.
6. **Layout and visual fit.** Density, spacing, alignment, the action bar where the design puts it, elevation and radius as the design uses them. Phone and desktop both.

## Verdicts

Write `verdicts.json` in the review folder: one entry per request, in any order.

```json
[{ "id": "calendar-find-slot", "winner": "X", "reason": "X shows the three free slots as the main content, as the design does; Y's slots are blank placeholders." }]
```

`winner` is `"X"`, `"Y"` or `"tie"`. Call a tie only when neither is closer to the design in any way that matters: both fail the job the same way, or both do it equally. If one side has no screenshots, it had no answer, and the other side wins unless it too fails the job entirely (then tie). The reason is one or two sentences naming the deciding difference.
