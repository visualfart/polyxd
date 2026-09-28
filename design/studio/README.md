# Studio designs

Source for the "Polyxd Studio" Claude Design canvas: 64 artboards (desktop, 1440 wide, as tall as their content) covering every flow a design-system team runs in Studio, from signing up to signing out, with create, read, update and delete for everything they own.

| Row | Flows |
|---|---|
| Sign up and sign in | Sign up; verify email with a code; sign in; a failed sign-in; SSO; two-step verification |
| Password, invites, signing out | Forgot and reset password; accept an invite; session expired over the app; signed out |
| Getting started | Create a workspace; home with setup checklist and quality; workspace switcher; account menu; notifications; search (⌘K) |
| Your account | Profile; sign-in and security (password, 2-step, sessions, delete account); notification settings |
| Design systems: import | Your systems and the 13 built in; import from Figma variables, Tokens Studio, DTCG or CSS; a scan of what was found (3,142 tokens by tier and type, modes, broken and circular references); mapping Polyxd's 87 roles onto your semantic tier, with alias chains, bulk accept and contrast fixes found on your own ramp |
| Design systems: browse, edit, delete | Polyxd roles; your tokens as a tree by tier and group with references and usage; edit a token in a draft; preview real screens at phone and desktop width, in every mode; delete one in use with a typed check |
| Components | Catalog; a component page with guidance, props mapping, phone and desktop previews and checks on your implementation; connect your own; create a custom one with a fallback; delete with undo |
| Patterns | The six patterns and the rules each brings |
| Direction | Profile and voice; rules with pass rates; a rule tested before it's saved; undo on delete; no rules yet; exemplars at both widths |
| Reviews | The queue; one screen with its data, checks and comments; ranking three options; a comment becoming a rule; all caught up |
| Capabilities and journeys | Capabilities by risk; editing one; journeys with checkpoints and an agent test; the flow map |
| Releases | What changes and what it affects, at both widths; a gradual rollout with guardrails; history; rollback |
| Insights | Quality over time, what fails most, what people ask for that the product can't do |
| Workspace settings | Team and roles; invites; integrations, including your own generator; export and delete the workspace |
| When something's missing | No access; page not found |

The look is Polyxd's own brand (`brand/BRAND-2026.md`, the Polyxd Design System): paper, ink, one signal orange that carries ink text, Young Serif for titles, Hanken Grotesk for text and DM Mono for tokens, round 44 px controls and squircle cards, and the mark in the sidebar. Every control is a real element, and text meets 4.5:1.

`python3 build.py` (Python 3.12 or later) writes the artboards and `canvas.json` into `out/project/`. `measure.mjs` renders each artboard and records in `heights.json` how tall its content is, so the next build sizes it to fit. `kit.py` holds the building blocks, including phone and desktop previews of generated screens, and shares the flow designs' icons; `screens_ds.py` holds the design-system flows, `screens_c.py` accounts, the shell and states, and `screens_a.py` and `screens_b.py` the rest.
