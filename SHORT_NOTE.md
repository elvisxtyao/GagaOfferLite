# GagaOfferLite — short note

**Live:** https://gagaofferlite.app.space

**Repository:** https://github.com/elvisxtyao/GagaOfferLite

GagaOfferLite turns pasted application instructions into a private checklist. A signed-in user saves a source URL and text, asks AI for up to eight requirements with exact source quotations, edits and confirms them, then tracks completion and personal notes across visits.

The app uses DeepSpace authentication, Records, server-side ownership checks, confirmed mutations and hosting. Its one third-party integration is OpenAI chat completion (`gpt-4.1-mini`) through DeepSpace. Input and output are bounded, model requests can time out, quotations and dates are checked against the source, and unsuccessful extraction preserves the saved input and offers manual entry.

The main tradeoff is merging requirements and tasks into the same record. Changing `draft` to `accepted` makes an existing requirement part of the checklist, avoiding an import transaction and duplicate tasks on repeated confirmation. We omit automatic source refresh, full version history, background jobs, calendars and collaboration.

We reused the original GagaOffer's domain design and validation ideas: source traceability, explicit confirmation, completion/reopening, and separation of source dates from personal targets. DeepSpace authentication, storage, permissions, real model calls and this English workflow were implemented for this independent project. The original repository was not modified.

Codex implemented the code, reviewed security boundaries, deployed it, and completed 25 local checks plus four final-URL acceptance tests using two ordinary test accounts. A fresh final-candidate run called the real model, saved three drafts, and passed edit/confirm, completion/reopening, notes, refresh, idempotency and server-side isolation checks. Desktop and mobile screenshots were also inspected. Model-outage recovery was tested with an explicitly controlled simulation. Developer verification currently includes completing the platform login; the full developer-performed six-step acceptance has not yet been reported. See `docs/ACCEPTANCE.md` for the current evidence and limitations.

This submission uses **one** real third-party integration. Auth, records and synchronization are not counted as extra integrations. The source has a public GitHub mirror for reviewers. Portal submission remains pending its URL and actual requirements.
