# GagaOfferLite

A small, English-language application checklist built on DeepSpace.

**Live app:** https://gagaofferlite.app.space

**Repository:** https://github.com/elvisxtyao/GagaOfferLite

Paste application instructions and their source URL → extract up to eight AI drafts → edit and confirm → track completion and personal notes. Your checklist is private to your signed-in account and persists across visits.

## Try it

1. Open the live app and sign in with DeepSpace (GitHub or Google).
2. Enter an application name, an HTTP(S) source URL, and one source text of up to 8,000 characters.
3. Choose **Save & extract requirements**. The source is saved before the model runs.
4. Check each exact source quotation, edit its title, description or reviewed date, and choose **Confirm requirement**.
5. Open **My checklist**, mark an item complete, reopen it, or save personal notes. Refresh and revisit the application to check persistence.

For a synthetic demonstration, use `https://example.org/demo-admissions` and the text below. This is invented test input, not a real university's requirements; the AI output is generated live.

> Submit a statement of purpose of no more than 500 words by January 15, 2027. Upload an unofficial transcript by January 20, 2027. Provide two academic recommendation letters. No recommendation deadline is stated here.

If extraction fails, the source remains saved. Retry or use **Add requirement manually**, supplying an exact source quote. Empty source text and text longer than the limit are rejected server-side.

## Run locally

Requires Node 22.15+, 24, or 26 and npm 11.6+ (the checked-in lockfile pins dependencies).

```sh
npm ci
npx deepspace auth login
npx deepspace auth whoami
npm run dev
```

This checkout identifies the existing app in `wrangler.toml`; its owner/collaborators can run or deploy it. To create your own independent app, choose an unused `name` in `wrangler.toml`, then run `npx deepspace app init --new-id` while logged in to your own account. This creates separate data and a separate deployment.

```sh
npm run type-check
npm run test:unit
npm run build
git add .
git commit -m "Describe the change"
npm run deploy
```

The app's source authority is the native DeepSpace cloud repository, branch `codex/gagaofferlite`. `npx deepspace clone gagaofferlite` retrieves the source for accounts permitted to access it. The Git remote is `space`. A public GitHub mirror at https://github.com/elvisxtyao/GagaOfferLite gives reviewers source access without deployment permissions; its remote is `origin`, branch `main`. The public snapshot uses a GitHub noreply author identity and has an independent history. Its tree matches the corresponding DeepSpace source commit; commit IDs differ. `node scripts/publish-mirror.mjs` publishes the current clean, committed tree without rewriting the deployed history.

Never commit `.dev.vars`, `.deepspace`, account credentials, or captured applicant data. The official CLI manages authentication and deployment credentials.

## DeepSpace and the model integration

- **Authentication:** platform sessions/JWTs; actions use the verified caller identity.
- **Storage:** DeepSpace Records backed by the app's Durable Object. Both ordinary members and the app admin have owner-only access to the two business collections.
- **Permissions:** ownership is bound and immutable. Actions explicitly load and check the parent Application because server action tools bypass record RBAC. Source text, source URL, original date, evidence quotation and parent/owner fields cannot be changed through ordinary record mutations.
- **Writes:** review, completion and note changes await `putConfirmed`; the UI reports success only after acceptance by the server.
- **One third-party integration:** OpenAI `openai/chat-completion`, model `gpt-4.1-mini`, through DeepSpace's server-side API. Billing uses the app owner's platform balance; no provider key is sent to the browser.
- **Output reliability:** JSON shape, item count, field lengths, exact source quotation and quoted date are validated before saving any model output. Missing dates remain empty. AI-generated text stays in `draft` until the user confirms it.
- **Request limits:** a 30-second abort timeout, 8,000-character input, at most eight model items and 4,000 output tokens. A transactional, internal RecordRoom counter limits AI attempts to 10 per user and 100 per app per UTC day. Failed attempts count; manual entry remains available. Generic paid integration routes are disabled.

Authentication, records and synchronization are platform features. They are **not** described as three separate third-party integrations.

## Data model and main tradeoff

There are only two business records:

| Record | Purpose |
| --- | --- |
| Application | Owner, name, source URL, frozen source text |
| Requirement | Parent/owner, editable title/description/reviewed date, immutable source date/quote, `draft` or `accepted`, completion, personal target date and notes |

The same Requirement becomes a checklist item when its review status changes to `accepted`. Confirmation does not copy it into a Task collection, so confirming it again cannot create duplicate tasks. Personal target dates remain separate from source dates.

This reduces import transactions and duplicate-generation problems. It deliberately omits automatic source updates, full revision history and multi-user conflict resolution. A completed item is your own progress marker, not proof that a school received anything.

## Scope and limitations

- Pasted text only: no URL crawling, PDFs, extension, portal autofill, calendar, email, payments, collaboration or PostgreSQL migration.
- Source links are retained, not fetched or independently verified. An exact quote proves traceability to the pasted text, not that the text is current or accurate.
- AI drafts still require human review. Editing a reviewed date does not rewrite the preserved original date or quote; no year, time or timezone is inferred.
- A saved source is frozen. To use different source text, create another Application.
- AI extraction runs only while the Application has no requirements. A failed partial database write reports how many drafts were saved; inspect those items and add anything missing manually. Accepted work is never overwritten by a model retry.
- This is a demo-sized app. There is no source-change watcher, audit history, deletion UI or cross-tab merge/conflict workflow.
- Paste application instructions only. Do not include passwords or applicant personal data. Extraction sends source text to OpenAI through DeepSpace.
- The supplied exercise text is inconsistent: its body says there is no minimum integration count, but its “helpful project bar” says at least three. This version uses one real integration and does not claim to meet a three-integration threshold. See [the requirements review](docs/SUBMISSION_REQUIREMENTS.md).

## Verification and provenance

See [acceptance](docs/ACCEPTANCE.md) for actual results and remaining gates, and [short note](SHORT_NOTE.md) for submission text.

The original [GagaOffer](https://github.com/elvisxtyao/GagaOffer) supplied the domain ideas: source-backed requirements, human confirmation, completion/reopening, and separate source/personal dates. This repository implements a new DeepSpace flow with a smaller schema; it does not import the original API, database or full revision/risk engine. Development and automated checks were performed by Codex. The applicant personally reported completing application creation, real AI extraction, editing and confirmation, and marking an item complete on the live app. Notes, reopening, refresh and two-account isolation are agent-verified; they are not claimed as applicant-performed checks.



## Verification commands

`npm test` runs type and unit checks without contacting a model. The original GagaOffer suite is not required for this independent project.

For explicitly requested live acceptance, create two dedicated test accounts using the official CLI, then run the isolated final-URL suite:

```powershell
npm run test:accounts
$env:LIVE_URL = 'https://gagaofferlite.app.space'
npm run test:live
```

The live suite uses synthetic instructions, confirms both accounts are ordinary `member` users, and probes server-side isolation with raw WebSocket messages. A fresh run makes one real model call billed to the app owner; browser traces and video are disabled so session credentials are not captured. Account passwords stay in the CLI's local credential store. See `tests/lite-live.spec.ts` for reuse options and `docs/ACCEPTANCE.md` for the actual run results. A simulated provider failure in the suite is explicitly labeled and does not count as the successful live model call.
