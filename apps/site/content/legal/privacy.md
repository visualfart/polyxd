---
title: Privacy policy
description: What Polyxd collects on each of its services, why, who else sees it, how long it is kept, and your rights.
updated: "29 September 2026"
---

## The short version

- polyxd.com counts visits and clicks on its buttons with PostHog, without cookies or local storage. It has no advertising and no tracking cookies. If your browser sends Do Not Track or Global Privacy Control, the analytics don't load at all.
- The demos keep their data in your browser. If live generation is switched on, an ask the demos can't answer from their library goes to an AI model provider. We count how asks were answered, never what you asked.
- Studio keeps what it needs to run your account and your workspaces, and sends email through Resend. It records the main steps you take in Studio, tied to a random user id, never your name or email address.
- The hosted MCP server has no accounts. It works on what your AI assistant sends it, answers, and keeps a one-line log of each request. It counts tool calls anonymously, never what was in them.
- The open-source packages, the local MCP server, the generation server, the runtime and the VS Code extension send nothing to us.
- We never sell your data, and we don't use it for advertising.

## Who we are

Polyxd is run by Neelank Sachan, an individual developer based in New South Wales, Australia. In this policy, "we" and "us" means him. We are responsible for the personal information described here, and we handle it in line with the Australian Privacy Principles in the Privacy Act 1988.

Contact: [hello@polyxd.com](mailto:hello@polyxd.com).

You can use the site, the docs, the demos and the hosted MCP server without telling us who you are.

This policy covers polyxd.com (the site, the docs, the gallery and the demos), Polyxd Studio at studio.polyxd.com, and the hosted MCP server at mcp.polyxd.com. It also says what the software you run yourself does and doesn't send.

## polyxd.com

**What we collect.** Nothing that identifies you, unless you join the early-access list.

- **Analytics.** We use PostHog to see how the site, the docs, the gallery and the demos are used. It records:
  - the pages you view, and when you leave them;
  - the page you came from, cut to its address without any query string;
  - your browser's user agent (its name and version, your operating system and device type), and your screen size, language and time zone;
  - the country your IP address is in;
  - clicks on the site's own buttons and links to act, such as "Get started" or "Try Studio", and where they lead;
  - when you copy an install command, and which package it installs;
  - which design system you pick in the gallery;
  - in a demo, whether your ask was answered from the library, generated live, or not yet. Never what you asked.

  Addresses are sent without their query strings or fragments, and without ad-click ids.
- **No cookies or local storage for analytics.** The analytics keep a random id in memory for the page you are on. Each page load gets a new one, so we can't tell your visits apart or recognise you when you come back.
- **Do Not Track and Global Privacy Control.** If your browser sends either signal, the analytics script isn't loaded at all.
- **How it travels.** Events go to polyxd.com first, at `/ingest`, which passes them on to PostHog without cookies. PostHog uses your IP address to work out your country, then discards the address. It isn't stored.
- **No advertising.** The site loads no advertising scripts and sets no cookies of its own.
- **Your theme.** If you choose light or dark, the choice is saved in your browser's local storage as `pxd-theme`. It never leaves your browser.
- **Fonts.** Pages load fonts from Google Fonts. To do that, your browser connects to Google, which sees your IP address and browser details. Google's use of this is covered by the [Google privacy policy](https://policies.google.com/privacy).
- **Hosting.** Cloudflare hosts the site. To deliver pages and protect the site from attacks, Cloudflare processes your IP address and the details of each request. Cloudflare may set a strictly necessary security cookie (such as `__cf_bm`) to tell people from bots.
- **Server logs.** Cloudflare keeps logs for our Workers: the time, method, address and status of each request, how long it took, and technical details Cloudflare attaches, which can include your IP address, rough location and browser. We use them to fix problems and stop abuse. They are kept for up to 7 days.
- **The early-access list.** If you give us your email address to hear about early access, we keep that address and the time you joined. We use it only to tell you about early access. You can ask to be removed at any time. We delete the list once early access is open.

## The demos

The demos at polyxd.com/demos are sample products with made-up data.

- **Your changes stay in your browser.** What you do in a demo is saved in your browser's local storage (keys starting `polyxd-demo:`), so the demo remembers it. It is never sent to us. Reset puts the sample data back.
- **Live generation.** Most asks are answered from a library of screens built into the page. Live generation is switched on only when we choose to run it. When it is on and your ask isn't in the library, your browser sends us:
  - your ask (200 characters at most),
  - which demo product you are in,
  - the screen you were shown last time for the same kind of ask, if there was one, and
  - which actions the screen may use.

  We pass the ask, the product's own sample data and that earlier screen to an AI model provider to write the screen. The provider is Anthropic (the Claude API). Please don't type personal information into a demo.
- **What we keep.** We don't store or log your ask. We log one line per generation: the product, whether it worked, the number of attempts, the number of tokens used and the time taken. We also send those same numbers to PostHog, with a new random id each time and no location. Never the ask.
- **Rate limits.** To stop any one visitor using up the service, we count asks per visitor. We do this with a short code made from your IP address, not the address itself. The code is kept only in the memory of the server that handled your ask, is never written to storage or logs, and is gone when that server restarts.
- **What your browser keeps.** Your browser keeps the screens it was shown and your recent asks in local storage, so asking again gives a familiar screen. Clearing your browser's site data removes them.
- **The provider.** Anthropic processes the ask to answer it, under its commercial terms for the Claude API. Its [privacy policy](https://www.anthropic.com/legal/privacy) says how it handles that data.

## Polyxd Studio

Studio is where teams set up their design systems and screens. It needs an account.

**Your account.**

- Your name, email address and password. The password is stored only as a salted hash, never as the password itself.
- Whether you have verified your email address, and when your account was created and last changed.
- If Studio offers Google sign-in and you use it: your Google account ID, name, email address, profile picture address, and the sign-in tokens Google returns.

**Signing in.**

- Each sign-in creates a session: a random token, when it expires, and the IP address and browser it came from. A session lasts 30 days and is renewed while you use Studio.
- Studio sets cookies that keep you signed in: `studio.session_token` and `studio.session_data` (named with a `__Secure-` prefix on studio.polyxd.com). They are strictly necessary, so we don't ask for consent. If you sign in with Google, a short-lived cookie may also be set while the sign-in happens.
- Studio sets no analytics or advertising cookies.

**Analytics.** We use PostHog to learn which parts of Studio help teams get started. Only once you are signed in, Studio records these steps:

- signing up, and whether with email or Google;
- creating a workspace;
- importing a design system, and whether it came from a file, a package or a template;
- mapping roles, choosing components and adding rules;
- creating a screen, and whether it started blank, from a template, from a shell or from a pasted document;
- publishing a screen (its version number, whether it is a screen or a shell, and how many warnings it has) or a Direction (its version number);
- creating an API key.

We also count each time a product fetches a published screen, Direction or pattern with an API key: which kind, and whether it worked.

Each event is tied to your user id, a random id Studio made for your account, and to your workspace's id. The events Studio sends from your browser also carry your browser's user agent, screen size, language, time zone and country, as the site's do. Addresses are cut to their shape, such as `/w/:workspace/screens/:key`. We never send your name, your email address, a workspace's name or address, tokens, API keys, documents, Directions or anything you type. Studio's analytics use no cookies or local storage, and don't load if your browser sends Do Not Track or Global Privacy Control.

**Your workspaces.** Studio stores what you and your team put into it:

- workspace names and addresses, members and their roles;
- invitations: the invitee's email address, the role, any message, who sent it and when it expires;
- design systems: the token files and packages you import (including the original file), scan results, role mappings and edits;
- components, rules, screens and their versions (including any sample data you add), and Design Directions;
- API keys, stored only as a SHA-256 hash;
- private package registry addresses and tokens. Tokens are encrypted before they are stored and are never shown again.

When you import a package, Studio fetches it from the npm registry or from the private registry you named, using the token you saved.

**Emails.** Studio sends email through Resend: email verification, password resets, and workspace invitations. An invitation goes to the address you enter and includes your name or email address, the workspace name, the role and your message. Resend processes the recipient's address and the content of the email to deliver it.

**Where it is stored.** On Cloudflare: the database on Cloudflare D1 and files on Cloudflare R2. Cloudflare decides where in its network to keep them, which may be outside Australia.

**Deleting.** You can delete design systems, screens, Directions, rules, API keys and registries in Studio at any time. Deleting a design system deletes its files too. To delete your account or a whole workspace, email us from the address on the account. We will do it within one month and confirm when it is done.

**Logs.** Cloudflare keeps logs for Studio's Worker, as for the site: request details and error messages, for up to 7 days.

## The hosted MCP server

The MCP server at mcp.polyxd.com lets an AI assistant (such as Claude or ChatGPT) check and show Polyxd screens.

- **No accounts and no cookies.** You connect to it from your AI assistant. It never asks who you are.
- **What it receives.** The tool calls your assistant makes: Polyxd documents, the data shown in them, and optionally a Design Direction or a list of actions. Your assistant writes these from your conversation, so they can contain whatever you asked it to show.
- **What it does with it.** It checks the document and sends back the result. It does not store what it receives, and uses it for nothing else but the anonymous counts below.
- **What it logs.** One line per request: the method, the path, the response status and how long it took. Nothing from the request's contents. Cloudflare hosts it and processes your assistant's connection details (including the IP address it connects from) to deliver the request.
- **What it counts.** We count its use in PostHog, anonymously. When an assistant connects: the name and version its app reports (such as "claude-ai") and the protocol version. For each tool call: which tool, whether it worked and, if not, the kind of error, the design-system pack and light or dark mode of a shown screen, how many of each component type the document used (such as two Choice and one Form), how many errors and warnings the check found, how long it took, and the product name from the app's User-Agent. Each event gets a new random id, so calls can't be linked to each other or to you. We never send the document, its data, a Direction, the IP address, or anything from your conversation.
- **The screen you see.** A screen is drawn inside your assistant's app. When you press a button in it, the message goes to your assistant, not to us.
- **Your assistant.** Your conversation is handled by the company that runs your assistant, under its own privacy policy. We never see your conversation, only what the assistant sends the server.

## Software you run yourself

The npm packages (`@polyxd/*`), the local MCP server (`npx @polyxd/mcp`), the generation server, the runtime and the VS Code extension send no telemetry. They send nothing to us.

- The runtime and the generation server call the AI model provider you configure, with your own key. That is between you and that provider.
- `polyxd studio push` sends your design tokens to the Studio workspace you name, when you run it.
- Downloading packages from npm or code from GitHub is covered by their own privacy policies.

## Why we use your data

We collect personal information only when we need it for one of these purposes, and we use it only for that purpose or one you would reasonably expect.

| What | Why |
|---|---|
| Studio accounts, workspaces and their emails | To provide Studio to you |
| Server logs, security cookies and rate limits | To keep the services working, secure and fair |
| Live generation in the demos | To answer the ask you typed |
| Hosted MCP server requests | To answer the tool calls your assistant makes |
| Analytics in PostHog | To understand how the site, the demos, Studio and the hosted MCP server are used, and make them better |
| The early-access list | To tell you about early access, as you asked |
| Emails you send us | To reply to you |
| Records we must keep by law | To meet legal obligations |

## Who else sees your data

We use these providers to run the services. Each processes data for us, on our instructions, under a data processing agreement.

| Provider | What for | Where |
|---|---|---|
| Cloudflare, Inc. | Hosting, security, logs, Studio's database and file storage, the early-access list | USA, with a global network |
| Resend (Plus Five Five, Inc.) | Sending Studio's emails | USA |
| Anthropic, PBC | Writing screens for live generation in the demos, only while it is switched on | USA |
| PostHog, Inc. | Product analytics for the site, the demos, Studio and the hosted MCP server | USA |

Two Google services work differently. Web fonts on the site, the demos and Studio load from Google Fonts, so your browser connects to Google directly. If Studio offers Google sign-in and you use it, you sign in with Google. In both cases Google LLC (USA) handles that data itself, under the [Google privacy policy](https://policies.google.com/privacy).

We may also share data if the law requires it, or to protect our rights or someone's safety. If the services pass to someone else, your data would go with them under this policy. We don't sell personal data.

## Overseas disclosure

Our providers are based in the USA and may store and process data there or elsewhere in their networks, outside Australia. Before we share personal information with a provider overseas, we take reasonable steps to make sure it handles that information in line with the Australian Privacy Principles, through its data processing agreement and security commitments.

## How long we keep it

| Data | How long |
|---|---|
| Server logs | Up to 7 days |
| Rate-limit codes | Minutes, in memory only |
| Demo asks | Not kept by us |
| MCP server requests | Not kept; only the one-line log and the anonymous counts above |
| Analytics events in PostHog | Up to 12 months |
| Studio account and workspace data | While your account exists. After you ask us to delete it, within one month, and gone from Cloudflare's database backups within 30 days after that |
| Studio sessions | 30 days from your last use |
| The early-access list | Until early access opens, or until you ask to be removed |
| Emails you send us | Up to two years after our last exchange |

## Your rights

You can ask us to:

- give you a copy of the personal information we hold about you;
- correct information that is wrong, out of date or incomplete;
- delete your information;
- stop using it for a purpose, or take you off the early-access list;
- send you the data you gave us in a format a machine can read.

To do any of these, email [hello@polyxd.com](mailto:hello@polyxd.com). We will reply within 30 days, and it costs nothing. We may ask you to confirm who you are first. If we can't do what you ask, we will tell you why.

Much of what the site, the demos and the hosted MCP server handle never reaches us in a form we can link to you. If you ask about it, we will tell you what we hold, which may be nothing. Studio's analytics are tied to your account's user id: when we delete your account, we delete those events too.

## Complaints

If you are unhappy with how we handle your information, please email us first so we can put it right. We will reply within 30 days. If you are not satisfied with our answer, you can complain to the Office of the Australian Information Commissioner (OAIC): [oaic.gov.au/privacy/privacy-complaints](https://www.oaic.gov.au/privacy/privacy-complaints), or 1300 363 992.

## Security

All our services use HTTPS. Studio stores passwords as salted hashes and API keys as hashes, encrypts registry tokens, and marks its sign-in cookies as secure and not readable by scripts. No system is perfectly secure. If we learn of a breach that puts you at risk, we will tell you, and the OAIC where the law requires it.

## Children

Our services are for people using them for work or study. They are not directed at children under 13, and Studio accounts are for people aged 18 or over. We don't knowingly collect data from children. If you think a child has given us personal data, email us and we will delete it.

## Automated decisions

We don't make decisions about you by automated means that have legal or similarly significant effects.

## Changes to this policy

When we change this policy, we will update this page and the "Last updated" date at the top. If a change affects Studio accounts in a significant way, we will also email account holders before it takes effect.
