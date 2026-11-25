# GagaOfferLite agent entry

本仓库独立于原 GagaOffer。与用户沟通和工作记录使用中文；产品界面、README 与提交 short note 使用英语。用户当前指令优先。

## Scope

Only this flow is in scope: source text + URL → real AI drafts → edit and confirm → private checklist → complete/reopen and notes across refreshes. Two business collections only: `applications` and `requirements`. Source evidence and source dates remain distinct from personal target dates and notes.

Read `docs/IMPLEMENTATION_STATUS.md`, `docs/ACCEPTANCE.md` and the relevant worklog before continuing. Do not infer the human operator's nickname from Git or platform account identity. Preserve other contributors' edits; parallel coding uses separate worktrees.

## DeepSpace

Read https://docs.deep.space/llms.txt and the relevant `.md` pages. Installed package types and CLI `--help` are authoritative for the pinned SDK version.

- `npm run dev`: local DeepSpace development (requires platform login).
- `npm test`: TypeScript and unit checks; no paid model calls.
- `npm run test:accounts`: create missing dedicated test accounts through the CLI; credentials are never printed.
- `npm run test:live`: explicit final-URL acceptance. Uses test accounts and may make a real owner-billed model call. See README for configuration and reuse.
- `npm run deploy`: production deployment of committed code to DeepSpace.

The deployed app uses DeepSpace's cloud source (`space`, branch `codex/gagaofferlite`). The public GitHub repository is a source snapshot mirror (`origin`, branch `main`), with an independent privacy-preserving history. Do not force-push or rewrite the deployed history to make the SHAs match. `scripts/publish-mirror.mjs` publishes the current clean committed tree with a GitHub noreply identity.

## Invariants

- Never trust a client `ownerId`. Server action tools bypass RBAC, so check the verified user's ownership before reading, writing or calling the model.
- Keep per-record owner-only permissions, user-bound immutable ownership, immutable sources and the writable-field allowlist.
- Remount `RecordProvider` when `userId` changes so SDK caches cannot cross accounts.
- Await confirmed mutations before showing success. Confirmation updates the same Requirement; it never creates a new Task.
- Validate the whole model response before writing any draft: input ≤8,000 characters, output ≤8 items, exact source quote, quoted deadline or empty date. Never substitute sample output for real AI.
- Generic paid integration proxy and agent-tool routes are deliberately disabled. Only the validated, rate-limited extraction action may make owner-billed model calls. Do not restore the scaffold's unused AI chat/tool wiring.
- Keep daily attempt limits and timeout behavior. Failed calls preserve saved source and offer manual entry.
- Platform auth/records/sync are not three third-party integrations; this project has one real OpenAI integration.
- Never log or commit session tokens, passwords, `.dev.vars`, local account state or applicant data.

Keep verification evidence, limits, the actual live release, GitHub snapshot and submission state in the worklog. Never label portal submission or developer-performed checks complete without direct evidence.
