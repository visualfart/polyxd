# Studio designs

Source for the "Polyxd Studio" Claude Design canvas: 38 artboards (desktop, 1440 × 900) covering every flow a design-system team runs in Studio, with create, read, update and delete for each thing they own.

| Row | Flows |
|---|---|
| Getting started | Create a workspace; home with a setup checklist and quality health |
| Design system, create | Import tokens from Figma variables, Tokens Studio, CSS or a built-in pack; review every mapping guess, with contrast fixes found on the team's own ramp |
| Design system, read, update, delete | Token tables per group and mode; edit a token in a draft with its contrast impact; preview real screens redrawn with the draft; delete a pack in use with a typed check |
| Components | Catalog with who renders each and whether generators may use it; component page with guidance, props mapping and verification of the connected implementation; connect your own; create a custom component with a fallback; delete with undo |
| Direction | Profile and voice; rules with pass rates; a rule tested against recent screens before it is saved; delete with undo; exemplars |
| Reviews | The queue; one screen with its data, checks and comments; ranking three options (preference data); a comment becoming a rule |
| Product | Capabilities and their risk levels; journeys with checkpoints and an agent test; the flow map of paths people took |
| Releases | What changes and what it affects; a gradual rollout with guardrails; history; rollback |
| Insights | Quality over time, what fails most, what people ask for that the product can't do |
| Settings | Team and roles; invites; integrations; export and delete the workspace |

The look is polyxd.com's own: a warm ground, near-black ink, one signal orange, Bricolage Grotesque for titles, Geist for text and Geist Mono for tokens. Every control is a real element, and text meets 4.5:1.

`python3 build.py` (Python 3.12 or later) writes the artboards and `canvas.json` into `out/project/`. `kit.py` holds the building blocks and shares the flow designs' icons; `screens_a.py` and `screens_b.py` hold the screens.
