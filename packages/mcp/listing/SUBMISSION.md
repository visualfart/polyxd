# Polyxd: directory listing for Claude and ChatGPT

Everything the Claude Connectors Directory portal (claude.ai/directory/manage) and the OpenAI
plugin/app submission portal (platform.openai.com) ask for, ready to paste. Values in `[brackets]`
are placeholders for the owner to fill before submitting.

Files beside this one:

| File | What |
|---|---|
| `icon-1024.png`, `icon-512.png` | The icon: `brand/chosen-mark.svg`, unchanged, on paper `#F3F1EC`, full bleed, square |
| `screenshots/1-…5-….png` | Carousel screenshots, 1600 px wide, cropped to the app's response |
| `screenshots/documents/*.json` | Each screenshot's prompt, pack, mode and the exact document shown |
| `screenshots/checked.tsv` | Each document's result from the spec validator and the verifier (all valid, no errors, no warnings) |
| `render.ts` | Rebuilds the icon and screenshots: `npm run build -w @polyxd/mcp && node packages/mcp/listing/render.ts` |

---

## Before you submit (checks on the hosted server)

These live in code outside this folder. Tick each before opening either portal.

- [ ] `https://mcp.polyxd.com/mcp` is live over HTTPS and answers `initialize`, `tools/list` and `resources/read` for `ui://polyxd/surface.html`.
- [ ] Every tool has a `title` and `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false` (true of `src/server.ts` today; the hosted build must keep them).
- [ ] The MCP App resource declares its Content Security Policy. OpenAI requires one for any server that returns UI. The page loads nothing from outside, so an empty policy is right: `_meta.ui.csp = { connectDomains: [], resourceDomains: [] }` on the `ui://polyxd/surface.html` resource. `src/server.ts` does not set it today.
- [ ] The hosted server's logs hold only method, path, status and duration, as the privacy policy says. If it runs on Cloudflare Workers with `observability` on, turn invocation logs off (`"observability": { "logs": { "invocation_logs": false } }`) or the policy is wrong: invocation logs record request details.
- [ ] https://polyxd.com/privacy/ and https://polyxd.com/terms/ are deployed with the placeholders filled.
- [ ] https://polyxd.com/docs/mcp/ documents the hosted server: its URL (`https://mcp.polyxd.com/mcp`), that it needs no account, and how to add it as a custom connector in Claude and as an app in ChatGPT. Today the page covers the local server only. Claude needs public documentation by the publish date.
- [ ] You have added the server to Claude as a custom connector and called all six tools from a conversation, and run them in MCP Inspector (the Claude portal asks you to confirm this).
- [ ] OpenAI domain verification is served (see "OpenAI: identity and domain verification").

---

## Listing (both portals)

**Name** (6 of 100 characters)

```
Polyxd
```

**One-liner** (185 of 200 characters)

```
Ask for a screen and get a real, working one in the chat: forms, dashboards and comparisons, checked against the spec and drawn in Material 3, Carbon, GOV.UK or 22 other design systems.
```

**Description** (1,654 of 2,000 characters)

```
Polyxd shows interactive screens right in the conversation. Ask Claude to split a bill, return an order, fill in a form, compare plans or summarise a week of numbers, and instead of a wall of text you get a real interface: fields to fill in, choices to make, a receipt that adds up, a chart with a plain-words summary, and buttons that do what they say.

Claude writes each screen as a small Polyxd document, a JSON description of what the screen means rather than how it looks. The connector checks it against the open Polyxd specification before anything is shown: every value bound to real data, labels that say what happens, one primary action at a time, no more than six inputs per view, and confirmations before anything consequential. A screen with errors is never shown; Claude fixes it first.

Then Polyxd draws it in the design system you choose. The same screen looks native in Material 3, IBM Carbon, GOV.UK, Fluent 2, shadcn/ui, Shopify Polaris, GitHub Primer, Adobe Spectrum 2, Ant Design, Bootstrap, Chakra UI, Mantine and Radix Themes, or in one of twelve original templates, in light or dark mode.

When you press a button, the choice comes back to Claude as your next message, with the values you entered, so the conversation carries on from what you did.

Designers and product teams use it to try out a flow in their own design system in seconds. Anyone can use it to get a clear, usable screen instead of a long answer.

Every tool is read-only. The connector needs no account, sees only the screens Claude sends it, stores nothing, and does not reach the internet. Polyxd is open source (Apache-2.0); the specification is CC-BY-4.0.
```

**Categories** (pick the closest one to five from the portal's list)

1. Design
2. Developer tools
3. Productivity

**Documentation URL**

```
https://polyxd.com/docs/mcp/
```

**Privacy policy URL**

```
https://polyxd.com/privacy/
```

**Terms of use URL** (OpenAI asks; Claude doesn't)

```
https://polyxd.com/terms/
```

**Support contact**

```
[hello@polyxd.com]
```

Also: https://github.com/visualfart/polyxd/issues

**Website**

```
https://polyxd.com
```

**Icon**: `icon-1024.png` (or `icon-512.png` where a smaller file is asked for).

**Listing slug** (Claude; permanent once published)

```
polyxd
```

**Allowed link URIs** (Claude, optional): none. The MCP App never calls `ui/open-link`.

---

## Use cases (Claude "Use cases" step)

**Primary use cases**

```
- Turn a request into an interactive screen in the chat: a form to fill in, a review before submitting, a comparison to choose from, a dashboard with charts and tables, a confirmation.
- Try a product flow in a real design system (Material 3, Carbon, GOV.UK, Fluent, shadcn/ui, Polaris and more) in light or dark mode, without writing code.
- Check a Polyxd UI document against the specification and a team's Design Direction, with every issue located and a hint to fix it.
- Look up Polyxd's components, their props and when to use each, and the design-system packs available.
```

**What users need before they can connect**

```
Nothing. No account, plan, API key or setup. Screens show in hosts that support MCP Apps; other hosts get a text summary, and every tool still works.
```

**Reads or writes data**

```
Read only. All six tools have readOnlyHint: true. They check and display what the model sends and change nothing anywhere.
```

---

## Company (Claude "Company" step; OpenAI "Basic information")

| Field | Value |
|---|---|
| Company / publisher name | Neelank Sachan (individual developer; publishes as Polyxd) |
| Website | https://polyxd.com |
| Primary contact for review updates | Neelank Sachan, [hello@polyxd.com] |

---

## Server and authentication

| Field | Value |
|---|---|
| MCP server URL | `https://mcp.polyxd.com/mcp` (one URL for everyone) |
| Transport | Streamable HTTP |
| Authentication | None. The tools work only on what the model sends them and touch no user account or private data. |
| OAuth credentials | None |
| Test credentials | None needed: no account exists to sign in to |

---

## Tools (both portals sync these from the server)

| Tool | Title | What it does | Annotations |
|---|---|---|---|
| `polyxd_guide` | Polyxd guide | Returns the spec as instructions: document shape, rules, bindings, actions, every component and the patterns | readOnly, not destructive, idempotent, closed world |
| `polyxd_validate` | Validate a Polyxd document | Validates a document; every issue with its JSON Pointer, component and a fix hint | readOnly, not destructive, idempotent, closed world |
| `polyxd_verify` | Verify a Polyxd document | The verifier's document checks, optionally against a Design Direction and a capability registry | readOnly, not destructive, idempotent, closed world |
| `polyxd_show` | Show a Polyxd screen | Validates, then returns the document for the MCP App to draw in the chosen pack and mode; shows nothing when there are errors | readOnly, not destructive, idempotent, closed world |
| `polyxd_packs` | List Polyxd packs | The 25 design-system packs a screen can be drawn in | readOnly, not destructive, idempotent, closed world |
| `polyxd_components` | List Polyxd components | The components with a summary each, or one component's full definition | readOnly, not destructive, idempotent, closed world |

`openWorldHint` is `false` for every tool: nothing reaches the internet or any outside system.

Resources: `ui://polyxd/surface.html` (the MCP App, `text/html;profile=mcp-app`, self-contained, no external origins), `polyxd://examples/<name>.json` and `polyxd://directions/<name>.json` (the spec's examples).

---

## Data handling (Claude "Data handling" step; OpenAI privacy answers)

| Question | Answer |
|---|---|
| Whose API does the connector call? | Its own. The server runs the Polyxd checks itself. It calls no other API, first-party or third-party. |
| Proxied from a partner? | No. |
| Personal health data? | No. The connector has no health features. A screen shows only what the model puts in it. |
| Sponsored content or advertising? | No. |
| What does the connector receive? | Tool arguments only: a Polyxd document, the data it shows, and optionally a pack, a mode, a Design Direction or a capability registry. No conversation history, no user identifiers, no location. |
| What does it store? | Nothing. Each call is answered and forgotten. |
| What does it log? | One line per request: method, path, status and duration. No request contents. |
| What does it return? | The check result or the document to show. No session IDs, trace IDs, internal identifiers, secrets or personal data beyond what the model sent. |
| Payment card, government ID, credentials, health data (OpenAI restricted data)? | Not requested by any tool. Tool inputs have no fields for them. |
| Sends data outside its boundary? | No. When the user presses a button in a shown screen, the MCP App sends a user message to the host's chat (`ui/message`). That goes to the host, never to us or anyone else. |
| Users' controls | No account, so nothing to delete. Users stop using it by disconnecting the connector. |
| Privacy policy | https://polyxd.com/privacy/ ("The hosted MCP server" section) |

---

## Claude compliance acknowledgements (all seven required)

1. **Directory guidelines** (Software Directory Terms and Policy). Fine: accurate listing, read-only tools, all with titles and annotations, no authentication games, public docs and a privacy policy.
2. **First-party API usage.** Fine: the server calls no API at all. The checks run in the server, on code the owner wrote and publishes. The MCP host name `mcp.polyxd.com` matches the service.
3. **Financial transactions.** Fine: the connector cannot move money, crypto or any asset. A screen can show amounts (for example a bill split), but its buttons only send a message back to the chat. Nothing is paid, charged or transferred.
4. **AI media generation.** Fine: the connector generates no images, video or audio. It draws user interfaces from structured documents, which the directory allows ("design tools that produce diagrams, charts, or UI mockups").
5. **Prompt injection.** Fine: tool descriptions say what each tool does. They don't tell Claude to call other software, don't interfere with other tools, don't pull instructions from outside sources, and hide nothing. The server's instructions only describe the order to use its own tools (guide, validate, show). A button press reaches the chat as a message the user caused by pressing it, labelled with the screen and the action.
6. **Conversation data collection.** Fine: no tool asks for conversation history, memory, chat summaries or user files. Inputs are the document to check and its data. Nothing is stored.
7. **Public documentation.** Fine once the hosted server is on https://polyxd.com/docs/mcp/ (see the checklist above). The page, the README and the spec are public.

---

## OpenAI: identity and domain verification

**Identity.** Publish under the owner's own name as an individual.

1. In the OpenAI Platform dashboard, open Settings, then Organization, then Verification.
2. Choose individual verification and complete it with the owner's government ID (the dashboard's provider takes the ID; never send it anywhere else).
3. Make sure the account submitting has Apps Management set to Write (organisation owners have it).
4. In the submission form, pick that verified individual identity as the Developer Identity.

**Domain.** The portal checks you control the MCP server's host.

1. Enter the MCP server URL, `https://mcp.polyxd.com/mcp`. The portal shows a verification token.
2. Serve exactly that token, as plain text and nothing else (no JSON, no HTML, no other tokens), at:
   `https://mcp.polyxd.com/.well-known/openai-apps-challenge`
3. Or set the Challenge Base URL to the parent host `https://polyxd.com` and serve it from the site's Worker at `https://polyxd.com/.well-known/openai-apps-challenge`. A route for `apps/site/worker/index.ts`, with the token kept as a secret (`npx wrangler secret put OPENAI_APPS_CHALLENGE`):

   ```ts
   if (url.pathname === "/.well-known/openai-apps-challenge")
     return env.OPENAI_APPS_CHALLENGE
       ? new Response(env.OPENAI_APPS_CHALLENGE, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } })
       : new Response("Not found", { status: 404 });
   ```

4. Make sure no WAF rule, bot challenge or mTLS blocks OpenAI's request to that path.
5. Press Verify in the portal, then Scan Tools.

**Country availability** (suggestion): every country where ChatGPT apps are available. Nothing in the connector is specific to one country, it collects no personal data, and it has no commerce. The interface text is English; the GOV.UK pack is a UK style but works anywhere.

**Localization**: English (`en`).

**Supported surfaces**: ChatGPT (web, desktop, mobile). Screens show wherever MCP Apps render; the tools also work in Codex without the screen.

**Commerce and advertising**: none.

**Audience**: general, suitable for 13 and over. Not directed at children.

---

## Carousel screenshots and their prompts

Each PNG is 1600 px wide, cropped to the app's response only (no prompt, no chat chrome). Each was
drawn by the real server's `polyxd_show` result in the real MCP App (`dist/view.html`) in
headless Chromium, after the document passed `@polyxd/spec`'s validator, `polyxd_validate` and
`polyxd_verify` with no errors or warnings.

| # | Screenshot | Paired prompt | Pack, mode |
|---|---|---|---|
| 1 | `screenshots/1-split-dinner-material3.png` | Split Friday's dinner with Priya, Sam and Jo. The bill was £126.40 and I'd like to add a 10% tip. Show it in Material 3. | Material 3, light |
| 2 | `screenshots/2-return-shoes-carbon.png` | I need to return the running shoes from order #4821, they're too small. Use Carbon. | IBM Carbon, light |
| 3 | `screenshots/3-change-address-govuk.png` | Help me tell the council I've moved house. Make it a GOV.UK form. | GOV.UK, light |
| 4 | `screenshots/4-support-dashboard-dark.png` | Here's this week's helpdesk export. Show my support team's week as a dashboard, in dark mode. | shadcn/ui, dark |
| 5 | `screenshots/5-compare-broadband-editorial.png` | Compare the three broadband deals you found for my flat and help me pick one. I mostly work from home. | Editorial (original template), light |

---

## Reviewer test instructions (Claude "Test & launch"; OpenAI reviewer notes)

```
No account or credentials are needed. The server has no authentication.

1. Add the connector: in Claude, Settings > Connectors > Add custom connector, URL https://mcp.polyxd.com/mcp (in ChatGPT, add it as an app with the same URL). Leave authentication empty.
2. Start a new conversation with the connector on and send any test prompt below. Claude calls polyxd_guide (once per conversation), then polyxd_validate, then polyxd_show.
3. The screen appears inline in the reply, drawn in the design system named in the prompt. Pressing a button in it sends a message into the chat naming the action and the values entered; Claude continues from it.
4. For the other tools, ask: "Which design systems can Polyxd draw in?" (polyxd_packs), "What props does the Polyxd Choice component take?" (polyxd_components), and "Check this Polyxd screen against the calm-finance direction" after any screen (polyxd_verify).

Every tool is read-only and changes nothing. Screens use whatever data is in the conversation; nothing is fetched from anywhere.
```

---

## Test cases (OpenAI: five positive, three negative)

No test account or fixture data is needed: the data comes from the prompt. The exact documents
for the first four cases are in `screenshots/documents/`, valid and verified.

### Positive

**P1. Split a bill in Material 3**

- Prompt: "Split Friday's dinner with Priya, Sam and Jo. The bill was £126.40 and I'd like to add a 10% tip. Show it in Material 3."
- Expected tools: `polyxd_guide` (first use in the conversation), `polyxd_validate` until valid, then `polyxd_show` with `pack: "material3"`.
- Expected result: `polyxd_show` returns `structuredContent.shown: true`, `pack: "material3"`. The screen is a form with the three friends chosen, "Equally" selected, a 10% tip toggle, and a receipt: bill £126.40, tip £12.64, each person pays £34.76, you get back £104.28. Buttons "Not now" and "Review requests". Pressing "Review requests" sends a chat message naming `split.review` with the chosen people. No money moves.
- Fixture: `screenshots/documents/1-split-dinner-material3.json`.

**P2. Return an order in Carbon**

- Prompt: "I need to return the running shoes from order #4821, they're too small. Use Carbon."
- Expected tools: `polyxd_validate`, then `polyxd_show` with `pack: "carbon"`.
- Expected result: `shown: true`, `pack: "carbon"`. A form with the item and order, "Too small" selected, drop-off or courier collection, where the refund goes, and a receipt beside it (item £89.99, postage free, send back by date, you get back £89.99). Pressing "Review return" sends `return.review` with the choices to the chat.
- Fixture: `screenshots/documents/2-return-shoes-carbon.json`.

**P3. A GOV.UK form, checked by the verifier**

- Prompt: "Help me tell the council I've moved house. Make it a GOV.UK form, and check it follows good form design before you show it."
- Expected tools: `polyxd_validate`, `polyxd_verify`, then `polyxd_show` with `pack: "govuk"`.
- Expected result: `polyxd_verify` reports no errors (at most six inputs, one primary action, readable labels). The screen, in GOV.UK style, shows the current address and fields for the new address, postcode and move-in date, with one "Continue" button. Pressing it sends `address.review` with what was typed.
- Fixture: `screenshots/documents/3-change-address-govuk.json`.

**P4. A dark-mode dashboard**

- Prompt: "Here's this week's helpdesk export: 42 open tickets (down 12%), median first reply 38 minutes (down 21%), satisfaction 94% (up 2%). Tickets opened and solved per day, Monday to Sunday: opened 18, 24, 19, 22, 17, 9, 8; solved 21, 20, 23, 25, 21, 12, 10. Show my support team's week as a dashboard in shadcn, dark mode."
- Expected tools: `polyxd_validate`, then `polyxd_show` with `pack: "shadcn"`, `mode: "dark"`.
- Expected result: `shown: true`, `mode: "dark"`. Three metrics with their changes coloured by whether the change is good, a line chart of opened and solved per day with a one-sentence summary, and a table of top topics. The numbers are the ones in the prompt, none invented.
- Fixture: `screenshots/documents/4-support-dashboard-dark.json`.

**P5. Packs, components and a comparison**

- Prompt: "Which design systems can Polyxd draw in? Then compare these broadband deals in the Editorial pack and help me pick: Fibre 150 at £27 a month, 145/30 Mbps, 24 months; Full Fibre 500 at £32, 500/70 Mbps, 18 months; Flex 900 at £45 plus £35 set-up, 900/110 Mbps, 1 month. I work from home."
- Expected tools: `polyxd_packs`, optionally `polyxd_components` with `name: "Comparison"`, `polyxd_validate`, then `polyxd_show` with `pack: "editorial"`.
- Expected result: the reply lists the 25 packs (13 published design systems and 12 original templates). The screen compares the three plans across cost, speed and terms, marks the best value of each row, recommends one with a one-line reason, and has a "Choose this plan" button per plan that sends `plan.choose` with that plan to the chat.
- Fixture: `screenshots/documents/5-compare-broadband-editorial.json`.

### Negative

**N1. A request that isn't about an interface**

- Prompt: "What's the weather in Leeds tomorrow?"
- Expected behaviour: no Polyxd tool is called. Polyxd draws screens from data in the conversation; it has no weather data and fetches nothing. The assistant answers another way or says it can't.
- Why: the tool descriptions are narrow, so the model should not choose them for unrelated requests.

**N2. Asking it to move money**

- Prompt: "Send £40 to Priya from my bank account now."
- Expected behaviour: the assistant says it can't make payments. It may offer a screen to review a transfer, but must not say money was sent. If a screen is shown, pressing its button only sends a message back to the chat; nothing is paid.
- Why: the connector is read-only and has no payment capability. Actions in a screen are chat messages, not transactions.

**N3. A design system Polyxd doesn't have, and a broken document**

- Prompt: "Show me a login form in the Tailwind UI pack."
- Expected behaviour: the assistant says there is no Tailwind UI pack and offers the nearest one (for example shadcn/ui) or asks which to use. The packs are listed in `polyxd_show`'s description and its `pack` enum, and `polyxd_packs` returns them. If the model still passes `pack: "tailwind"`, the call fails with "data/pack must be equal to one of the allowed values" and nothing is shown. If the model's document has an error, `polyxd_show` returns `isError: true` with `structuredContent.shown: false` and the issues, and no screen is shown; the model fixes the document with `polyxd_validate` and tries again.
- Why: nothing unchecked or unsupported is ever shown to the user, and errors say exactly what to change.
