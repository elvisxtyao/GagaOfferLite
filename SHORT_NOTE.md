# GagaOfferLite — short note

**Live:** https://gagaofferlite.app.space

**Repository:** https://github.com/elvisxtyao/GagaOfferLite

GagaOfferLite turns pasted application instructions into a private, source-backed checklist. A signed-in user saves a source URL and text, extracts up to eight requirements with exact quotations, edits and confirms the drafts, then tracks completion and personal notes across visits.

It uses DeepSpace authentication, Records, owner-only permissions, server actions, confirmed mutations and hosting. Its **one real third-party integration** is OpenAI chat completion (`gpt-4.1-mini`) through DeepSpace. The server verifies ownership, bounds requests, limits daily attempts and checks every quotation and extracted date against the source before saving drafts. Failed extraction preserves the source and offers manual entry. Exact quotations provide traceability to the pasted text, not independent verification of a website.

The main tradeoff is merging requirements and tasks into one record: changing `draft` to `accepted` puts the existing requirement in the checklist. Repeated confirmation cannot create a second task. I left out source crawling, calendar sync, background jobs, full version history and collaboration to finish and verify this review-to-checklist flow. Extra integrations would add setup and failure paths beyond that scope; authentication, Records and synchronization are not counted as additional third-party integrations.

The original GagaOffer supplied domain and validation ideas, including source traceability and separate source dates and personal targets. This independent repository implements the new DeepSpace workflow; the original repository was not modified.

I set the narrow product scope and directed Codex to implement, deploy and test it. Codex completed 25 local tests and four final-URL acceptance tests, including two ordinary accounts, server-side isolation, repeated confirmation, notes, reopening, refresh and mobile layout. A fresh final-candidate test used the real model; failure recovery was separately tested with an explicitly simulated outage. **I personally created an application, ran AI extraction, edited and confirmed requirements, and marked an item complete on the live app.** The additional checks above were performed by the agent, not claimed as my own manual testing.

The exercise body says there is no minimum integration count, while the portal's “helpful project bar” says at least three. This project deliberately uses one useful integration and does not claim to meet a three-integration threshold. If extending it, I would first improve source-update review and deletion, then add an integration only for a demonstrated user need.
