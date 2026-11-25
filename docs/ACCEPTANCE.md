# Acceptance evidence

**Automated implementation acceptance passed on 2026-11-24.** The applicant subsequently reported completing the core live flow personally. Portal submission remains unfinished; the supplied integration-count instructions conflict.

- Final live URL: https://gagaofferlite.app.space
- Deployed source: `8134468da30ee37b3ea45d98b581c1b83fd14472` on DeepSpace `codex/gagaofferlite`.
- Platform release: `rel_01M8874ZABT5FE82RH7C3PNQS9` (serving and data plane confirmed).
- Public build stamp: `71f8471c-004d-49ae-b285-f643f3575401`, read from `/.well-known/deepspace/release.json`. This UUID and the platform release ID are different identifiers.
- Public repository: https://github.com/elvisxtyao/GagaOfferLite (`main`). Its history is a noreply-identity snapshot; source trees correspond, but commit IDs differ. The snapshot commit message identifies the DeepSpace source commit. Later documentation-only commits do not change the tested runtime.

## Results

| Check | Actual evidence | Result |
| --- | --- | --- |
| TypeScript and local contracts | `npm run validate` | 25 tests passed across 6 files; type check passed |
| Input, AI validation, ownership and daily attempt limits | 22 targeted tests within the above suite | Passed |
| Final-URL regression suite | `tests/live.config.ts`, final build stamp asserted | 4/4 passed in 31.4 seconds |
| Fresh input → real model → review → checklist | Cleared the reuse option and reran the core live test on the final candidate | Passed in 22.0 seconds; real AI saved 3 drafts |
| Edit and confirm | Changed title, description, reviewed source date and personal target date; confirmation updated the original record | Passed |
| Complete/reopen, notes and refresh | Completed, reopened, saved a note, completed again, refreshed and reread persisted fields | Passed |
| Repeated confirmation | Raw confirmed update of the same record; record ID and total count unchanged | Passed |
| Two ordinary accounts | Both WebSocket identities explicitly reported `member`; B could not query A's applications/requirements, write A's note or extract from A's Application | Passed |
| Frozen provenance | Even A could not change its own source text, evidence quote, original source date, owner or parent through raw record writes | Passed |
| Same-page account switch | A signed out and B signed in without navigation; a DOM observer detected no reappearance of A's private application | Passed |
| Empty / oversized source | Authenticated direct actions with empty and 8,001-character source were rejected; no invalid Application was saved | Passed |
| Model failure recovery | Controlled mock outage at the model-action response; source survived refresh, manual draft saved and stayed unconfirmed | Passed; simulated failure, not a claimed real provider outage |
| Anonymous and direct-model access | Anonymous application action returned 401; generic paid model route returned 404 | Passed |
| Desktop/mobile layout | 1440×1100 and 390×844 screenshots; document and main scroll widths checked; visual inspection by Codex | Passed; initial mobile overflow was fixed before this run |
| Genuine integration use | Two successful `openai/chat-completion` calls were verified through platform usage during automated acceptance, including the fresh final-candidate test; this is not a current total after applicant testing | Verified; no sample output used as live AI |
| Public source access | GitHub reports public/main; anonymous HTTP request for README returned 200; published snapshot SHA verified with `ls-remote` | Passed |
| Original repository boundary | Original GagaOffer remains at 866b291 on its original branch with the same three pre-existing changed/untracked paths | Preserved; no old-repository edits by this work |
| Applicant's own manual verification | User reported creating an application, running AI extraction, editing/confirming and completing an item on the live app | Core flow reported passed; notes, reopening, refresh and isolation remain agent-only evidence |
| Submission portal | Full exercise and form labels supplied; actual portal URL still absent. Body says no minimum integration count; helpful bar says at least three | Not submitted; no three-integration compliance claimed |

## Reproduce

From this independent repository, after authenticated CLI setup:

```powershell
npm test
npm run test:accounts
$env:LIVE_URL = 'https://gagaofferlite.app.space'
$env:LIVE_APP_ID = 'app_01M885YWZWGFT88V7DDAA67WFN'
$env:LIVE_EXPECTED_BUILD_STAMP = '71f8471c-004d-49ae-b285-f643f3575401'
npm run test:live
```

A fresh live run makes one real, owner-billed model call. The daily rate limit also counts failed attempts. To recheck persistence and permissions using an existing synthetic application instead, set `LIVE_REUSE_APPLICATION_NAME` to its exact name; that mode does not prove a fresh AI call. The final acceptance explicitly ran both modes: the full four-test regression with an existing, previously verified real AI result, then a fresh core test with the reuse variable cleared. The fresh synthetic application was `__test-1795572367026__ synthetic application`.

The suite uses the dedicated `gagaofferlite-acceptance` test-account label. Credentials stay in the DeepSpace CLI store and are not printed or committed. Browser traces/video are disabled. Synthetic records are left in those dedicated accounts because the Lite product intentionally has no deletion workflow.

## Visual evidence

All screenshots use synthetic test input, not applicant data:

- [Desktop checklist](screenshots/desktop.png)
- [Mobile source](screenshots/mobile-source.png)
- [Mobile checklist](screenshots/mobile-checklist.png)

## Scope of the evidence

The agent performed automated and visual checks; these are not attributed to the developer. A simulated external failure validates app recovery, while unit tests cover invalid JSON, unmatched quotations and timeout behavior. No production provider outage was induced. No completeness, automatic source refresh, collaboration, full version history or three-integration compliance is claimed. Exact quotations establish provenance to the pasted text, not independent verification of a school website.
