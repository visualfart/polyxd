# Gold set

30 UI documents in 10 groups of 3, used to check that the verifier's scores agree with a designer's judgement (Phase 3 exit test). Each group starts from one of the spec examples (`packages/spec/examples/`):

- **a**: the original example.
- **b**: mild drift. Still valid, but slightly worse: vaguer labels, fields reordered, weaker copy.
- **c**: clearly worse, but still schema-valid: a worse control, a missing summary, a confusing order, or an unsafe flow.

All 30 pass `validateDocument`. The letters show the intended order, but the human ranking is what counts: if a designer thinks a `b` is better than its `a`, record that.

## Ranking page

The easiest way to rank is the blind ranking page in the local gallery: run `npm run dev -w @polyxd/gallery` and open <http://localhost:5173/?rank>. It shows each group's three variants side by side in a shuffled order under neutral names, fully interactive, and saves to `ranking.json` as you go. You can also leave notes:

- **Notes on each option** and **notes on the group** (why you ranked them this way, what they all miss) are saved as `notes` (by variant) and `comment`.
- **Annotate** lets you click any element in an option and write a note on it. Each annotation records the component's id and type in that variant's document, and the exact part clicked (for example `button "Next"`), saved under `annotations`.

Notes and annotations don't affect the agreement score. They're the qualitative half: where you disagree with the verifier, they say which check is missing.

## Filling in `ranking.json` by hand

1. Render each group's three documents side by side. Use `apps/gallery` or the verifier harness, and look at a phone width and a desktop width. Don't read the answer key below, or run `npm run gold`, until you've finished.
2. For each group, set `humanRank` to the variant names from **best to worst**, for example `["send-form-a", "send-form-c", "send-form-b"]`. The short forms `["a", "c", "b"]` also work. Ties aren't allowed: if two variants seem equal, pick the one you'd ship.
3. Put your name in `rater`. For more than one rater, make one copy of the file per person (`ranking.<name>.json`) and average the results.

Judge each variant as a UI someone has to use, not on how it looks. Ask whether it's clear what will happen, whether the right control is used, whether it shows what you need before you commit, and whether a screen-reader user or an agent could tell the controls apart.

## How agreement is computed

`npm run gold -w @polyxd/verifier` verifies all 30 documents in 3 design systems, in light mode, at 390 and 1100 px, and ranks each group by score. Equal scores count as a tie. Two measures are reported, using only the groups that have a `humanRank`:

- **Exact order agreement**: the share of groups where the verifier puts every pair of variants in the same order the human did. A tie where the human saw a difference counts as a miss.
- **Mean Kendall tau-b**: the rank correlation between the verifier and the human in each group, averaged over groups. It runs from −1 (reversed) through 0 (unrelated, or everything tied) to 1 (identical), and tau-b gives partial credit when the verifier ties two variants.

Until any group is ranked, the script prints only the verifier's own ranking and says the human ranking is pending. When disagreements come up, they point to missing checks, or to checks that are weighted wrongly.

## Answer key (read after ranking)

| Group | Source | b (mild) | c (clearly worse) |
|---|---|---|---|
| send-form | money-send-form | Vaguer labels, reference help removed, "Next" instead of "Continue" | Recipient typed freely, amount first, fees hidden, sends money with no review, "Submit" |
| send-confirm | money-send-confirm | Vaguer title and consequence, wordy confirm label | No amount, recipient, fee or consequence; "Confirm" button |
| delete-account | settings-delete-account | No typed confirmation, less specific consequence, plain "Cancel" | A bare danger button: no dialog, no consequence, no way back |
| browse-lamps | shop-browse-filter | Vaguer section and field labels, terse empty message | Filters after the results, no empty state, exact-number price box |
| compare-plans | shop-compare-plans | No recommendation or summary, storage before price, shorter attribute labels | A plain plan picker: no prices or storage to compare, "Submit" |
| hotel-review | travel-booking-review | Terms checkbox before the summary, "Details" instead of "Stay" | No summary of hotel, dates or price; "Continue" takes payment |
| add-task | tasks-add | Notes moved above priority and due date, "Done" instead of "Add task" | Date and priority typed as text, four extra fields: eight inputs in one view |
| notifications | settings-notifications | Terse section titles and push label, email toggle sends a misnamed setting | No sections; push and email are both called "Notifications" |
| find-slot | calendar-find-slot | Generic field labels, "Continue" instead of "Send invite" | Free-text time with no availability shown, two fields named "Date and time", "OK" |
| reading-list | personal-reading-log | Terser labels and empty message, import before add | No empty state, "Click here" and "Go", add triggers an unregistered capability |

Known blind spots (as of v0): the verifier scores **browse-lamps-b** and **reading-list-b** the same as their originals. Vaguer labels, terser empty-state copy and reordered actions aren't checked yet.
