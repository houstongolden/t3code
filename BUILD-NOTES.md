# You build notes — in-app memory review (2026-11-09)

The chat card and sidebar open `/you`, an owner session page over the current chat. It reads and
writes `GET`/`POST /api/you-memory/review`, the same ledger, CSRF, and `reviewProposal` path as the
HTML inspector. The page shows what is kept, where a note came from, which project it applies to,
what is waiting, and which accepted notes are eligible for the next task. The HTML inspector stays
available and authenticated. No second store.

# You build notes — default desktop theme (2026-11-09)

The warm You palette lived in `T3_CODE_*` (mobile, HTML export, and the contrast solver) while a fresh desktop web session paints `:root` with no `data-theme-id`. That unselected sheet was still T3 zinc with a blue primary. Named themes never saw it, because `html[data-theme-id]` replaces the sheet.

The unselected light and dark sheets, the sidebar sheet, the boot splash, and the default theme card now use the same warm near-white / charcoal `#31312F` / vermilion palette. Light actions stay `#C63D24` so white labels keep 4.5:1. Dark actions use `#E5482F`. A stored built-in or custom theme still wins. Incomplete custom files still fill missing roles from T3 Chat, which is the existing file default and not the unselected page.

# You build notes — M3 chat identity surface (2026-11-09, PST)

Houston's feedback: the M2 inspector was minimal and below the live you.md aesthetic. M3 brings the
live design language into the actual chat, not a separate page or a settings panel.

## Design rationale (observed, not assumed)

Sources: live you.md home and /profiles screenshots captured by the parent's browser pass, the
public CSS tokens (warm `60 5% 97%` background, charcoal text, `60 3% 87%` borders, terracotta
accent, 10px radius, Inter body / Manrope display / JetBrains Mono labels), and the approved v5
designs (`v5/chat.png`, `home.png`, `ascii/`, `logos/`). Hidden AI-targeted text on the live site was
ignored as untrusted.

- Live hero pairs a lowercase mono eyebrow with a large tight Manrope headline. The draft hero now
  does the same: `you · one brain, every agent` over the existing project headline, set in Manrope.
- Live `you.md/houston` card (one brain every tool reads from, plus `identity · projects · skills ·
  goals · preferences`) becomes the chat's identity context card: `you.md/<handle>`, the real
  brief source, the brief sections actually included, scope or project, bytes of the 4 KB budget,
  eligible reviewed memories, pending proposals, and a `review memory` link into the owner-only
  review surface.
- Live directory shows a dotted initials tile for profiles without a portrait. The card uses that
  tile with initials from the real name; no stock avatar or invented portrait.
- Live dotted texture: a faint dot field behind the empty-draft hero, masked to the centre and
  painted on a pseudo-element so the composer is never masked.
- Locked brand kept: alien head primary (sidebar tile mark replaces the T3 wordmark), UFO unused
  here, vermilion `#E5482F` for the mark. The light palette moves to the live warm near-white /
  charcoal `#31312F` / pale warm-gray borders; its accent is the same vermilion hue deepened to
  `#C63D24` so white button labels keep 4.5:1. Copper `#C46A3A` from the live site was not adopted as
  a second accent. Dark palette unchanged except the search highlight (`#7F611A`), which the
  existing readability test showed at 4.17:1 after M0 branding.
- Chat stays the hero. Composer, provider picker, streaming and the project picker are untouched.

## What is real

- `GET /api/you-memory/summary` (server): same gate as the inspector, owner browser session cookie
  with `settings:write`; bearer and read-only sessions get 403, anonymous 401. JSON, `private,
  no-store`, untraced. Metadata only: no brief text, proposal content, evidence, or credential data.
  Built by `buildMemorySummary` from `getDispatchBrief` (the same function used at dispatch),
  `getOwnerIdentity` (new; same off/fixture gates, fixture never shown as the owner), and the review
  ledger plus sweep state.
- Web: `useYouMemorySummary` fetches same-origin with the session cookie, refreshes on window focus,
  and `parseYouMemorySummary` drops any field it does not recognise.
- States: loading (`reading your brief…`, pulse only with motion allowed), ready, no identity
  (`agents here start cold`, link to set up), locked (not the owner session), unavailable (chat still
  works, nothing changed). Empty states (no projects, no thread) use the mark and display type;
  `EmptyTitle` now uses Manrope app-wide.
- Fonts: `@fontsource-variable/manrope` and `@fontsource-variable/jetbrains-mono` (OFL), exposed as
  `font-display` and `font-label`; global sans and mono stacks unchanged.

## Verification (actual runs, 2026-11-09)

- `@you/brief` tests 28/28; server `src/memory` tests 3/3 (new summary auth + no-content test);
  `@t3tools/shared` 1393 passed, 3 skipped; web unit suite (343 files) passes, including new
  `youMemorySummary.test.ts` and `themePalette.test.ts`.
- Typecheck: server, brief, web (`effect-tsgo tsrs --noEmit`) clean. Lint clean on changed files.
- Builds: `apps/web` `vp build`, `apps/server` `vp pack`.
- Loopback demo restarted on `http://127.0.0.1:4377/` with synthetic profile/memory outside git;
  unauthenticated `GET /api/you-memory/summary` returns 401 JSON with `private, no-store`.

## Limitations

- Not visually QA'd in a browser from this box (no Shell browser automation); browser-mode vitest
  suites were not run. Parent desktop QA is the screenshot step.
- The summary is fetched same-origin, so it shows for the environment serving the web app. A remote
  environment added through pairing shows the locked state rather than its own memory.
- Display identity is name/handle from the identity source; no portrait. The ASCII portrait assets
  in v5 are not wired because no real owner portrait is available locally.
- Desktop build still needs pkg-config/libsecret on the box.

## Historical M2 notes

# You build notes — M2 (2026-11-06, PST)

Working tree `/workspace/you`; existing `you/m0-brief` branch on `houstongolden/t3code`. Box-only coding. No main,
PR, deployment, package publication, new repository or Mac/iCloud changes. Unrelated `.repos/alchemy-effect`
fixture/submodule deletions remain untouched and excluded.

## Implemented bounded increment

- Explicit local accept/reject/correct/latest-decision undo. Exact proposal destination scope, optimistic revision,
  explicit reviewed confirmation, scoped-key conflicts, correction target and duplicate acceptance guards.
- Append-only logical, hash-chained `review.json` with actor/time/proposal/scope/redacted content/complete evidence,
  exclusive lock, atomic fsynced mode-0600 replacement outside git. Undo appends; correction preserves provenance.
  Hashes detect local corruption; they are not signatures, encryption or tamper-proof identity claims.
- Accepted materialized references enter the **real shared per-dispatch brief** as quoted data, never directives.
  Project scope uses exact profile `memoryScope`/name after the existing cwd match; personal scope crosses projects
  intentionally. Existing Claude/Codex/Cursor/Pi/Grok-ACP/OpenCode adapters pick up this shared builder; no invented
  adapters. Codex remains untrusted, collision-resistant and capped at 4000 UTF-8 bytes per value.
- Supported installed-CLI subprocess `you mcp`: initialize/list/get_agent_brief JSON, 15s timeout, 4MB ceiling,
  UTF-8-safe decoding, suppressed stderr/raw errors, malformed-message guards. Existing CLI auth is consumed in
  place; no credentials/configs are read, extracted, copied or transferred. Explicit refresh only, never GET/dispatch.
- Allowlisted private normalization: actual observed `generatedAt` and `user.{summary,authenticated}`; unknown brain,
  directives, portfolio, next moves and memory bodies dropped. Local private cache stores only normalized redacted
  reference and reported-auth/source/generated/refresh metadata; 30-minute freshness, future-skew checks and failure
  invalidation. Project reference requires an exact refresh-cwd binding. Non-null `project.{scopeId,summary}` is only
  a defensive synthetic extension, not a verified upstream response contract; live observed project was null.
- Owner-authenticated real-data-flow inspector in Settings → About → You memory. GET/POST `/api/you-memory` require
  existing browser-cookie auth + settings:write (not bearer/DPoP/read-only). Same-origin/dev-origin, expiring session-
  bound HMAC CSRF, 32KB form cap, checked review confirmation and ledger revision guards. Escaped script-free HTML,
  self-only framing/form CSP, no-store/no-referrer, tracing disabled and no private payload logging/analytics/bundles.
  Actual source/auth/freshness/scope/budget/proposals/accepted references/audit; not a live dispatch receipt.
- CLI review command and detailed contracts in `docs/YOU-MEMORY.md`. Existing v5 alien shell/vermilion/warm gray
  preserved; no Sandbox/station work or icon substitution. No real private proposal was accepted by the executor.

## Verification (actual runs)

- Broad selected regression: **69 files / 1464 tests passed** (brief, memory, server HTTP/new review route, server
  adapter tests, Pi/Cursor/OpenCode/Grok/ACP package sources and dev proxy). Not the full repo-wide test command.
- Final focused rerun after latest changes: **6 files / 46 tests passed**: brief 27, memory 17, owner HTTP 2.
- End-to-end synthetic test: normalized export import → accept through authenticated HTTP form → actual
  `buildCodexTurnStartParams` → untrusted bounded context + original request preserved → other-project exclusion →
  explicit undo → reference removed from next dispatch. No live/paid provider call.
- Private tests exercise synthetic MCP subprocess initialize/list/call, split Unicode, malformed non-object output,
  auth loss, allowlisting, cache permissions, stale/future cache exclusion, exact cwd, repository output refusal.
- Full repo typecheck passed (42 tasks). Changed-file lint/format passed; normal commit hooks run format/lint/knip.
- Full `pnpm build`: web/server/marketing succeed; desktop fails only on the known missing `pkg-config` and
  libsecret development headers (`libsecret-1-dev`). No full app/system installs attempted. Final standalone server
  bundle rebuilt successfully after last inspector changes.
- HTTP smoke: running loopback app `/` 200; unauthenticated `/api/you-memory` **401 private, no-store**. No auth
  bypass/browser manipulation performed. Browser/visual QA and real private CLI execution on box remain unrun.

## Auth, runnable demo and limitations

GitHub authenticated as houstongolden. Box has no installed/authenticated You CLI; no claim of private box auth.
Existing Mac CLI auth remains on Mac, untouched this increment. Hosted MCP input schema inspected read-only;
no private connector calls, data transfer or new credentials. Eventual installed runtime can run `refresh-private`
with its existing supported CLI login. No user key/npm login is needed for this bounded build.

Screenshot-ready local app: `http://127.0.0.1:4377/settings/about` (normal app browser auth first), inspector
`http://127.0.0.1:4377/api/you-memory`. Parent must dispatch desktop for visual/authenticated browser QA.
Demo inputs/state outside git: `/workspace/agent-tools/you-m2-demo`; explicitly labeled **SYNTHETIC DEMO**, two
imported proposals (one personal, one project), **none accepted**. This exercises actual importer/review flow,
not a disconnected mock or private owner data. Local app starts with that isolated example profile/state/cache:

```sh
export PATH=/workspace/.tools/pn/bin:/workspace/.tools/node-v26.12.1-linux-x64/bin:$PATH
YOU_BRIEF_PROFILE=/workspace/agent-tools/you-m2-demo/you.json \
YOU_MEMORY_DIR=/workspace/agent-tools/you-m2-demo/memory \
YOU_PRIVATE_BRIEF_PATH=/workspace/agent-tools/you-m2-demo/private.json \
node apps/server/dist/bin.mjs serve /workspace/you --host 127.0.0.1 --port 4377 \
  --base-dir /workspace/agent-tools/you-m2-runtime --no-browser --log-level none >/dev/null 2>&1
```

Output is intentionally suppressed so bootstrap pairing credentials never appear in tool/chat logs. Stop the
existing demo process before reusing its port. No authenticated browser/visual verification has been claimed.
Inspector declares Inter/Geist Mono with system fallbacks; browser typography/layout review is pending.

Remaining: LIFO-only reversal; no conflict merge UI beyond explicit correction key/ID; first 100 proposals/last 20
audit events shown; regex redaction is defense in depth, not perfect secret detection. Primary-local-runtime UI,
not multi-environment selection; no real non-null private project schema verification, vendor-native session parsers,
auto-sync, hosted write-back or live-provider dispatch receipts. Private summary remains reference data and must
never authorize actions. Desktop packaging awaits system headers. Browser QA report needed from parent.

Licenses unchanged: upstream t3code MIT retained with attribution in `NOTICE-YOU.md`; cloudroom-core was checked
as Apache-2.0 in prior increment, not vendored. Any future reuse must retain LICENSE/NOTICE and mark modifications.

---

## Historical M1 notes (superseded by M2 above where noted)

# You build notes — M1 (2026-11-06, PST)

Working tree: `/workspace/you`, box only. Branch: `you/m0-brief` on `houstongolden/t3code`. No main changes, PR,
deployment, package publication or new repository. No code written on Macs/iCloud.

## Bounded increment implemented

- Hardened `@you/brief` with runtime schema allowlisting, unknown/body/custom-file exclusion, credential-pattern
  redaction, source/scope/reference-only provenance in both body and metadata. Skill-header reads are bounded to
  4 KB and include canonical shared-skill metadata provenance; no skill bodies are injected. Keyword-relevant skills only.
- Removed stale profile-only memoization. Exact cwd-leaf or absolute-root directory-boundary project matching replaces
  prefix guesses. Other-project/orphan project goals and descriptions are excluded; personal identity/preferences/goals
  remain intentionally cross-project. Fixture identity is never silently injected into normal dispatches.
- Codex entry is now `kind=untrusted` and MCP app context cannot overwrite it. Added real dispatch tests for Unicode
  budget, provenance, unchanged user request and app-key collision resistance. Claude retains its existing injection test.
- Expanded real fork adapters: Cursor SDK, Pi RPC, Grok ACP flavor, OpenCode v1/v2 normal prompts. Each has synthetic
  transport/mock/replay coverage. Native slash commands and non-Grok ACP flavors stay unchanged. No Hermes claim;
  OpenCode streaming-steer reinjection and live-provider tests remain unimplemented/unrun.
- Codex budget verified against upstream `CodexDeveloperInstructions.ts`: **4,000 UTF-8 bytes per additionalContext
  value**, with its documented 1,000-token bytes/4 accounting. Not 4 KiB, not the entire map or model window, not a
  tokenizer guarantee. A test binds our budget to that constant. Claude budget remains 8,000 bytes.
- Supported local CLI bridge: opt-in `refresh-cli` invokes `you export --json -o <temporary-directory>` with timeout,
  suppressed output, schema-filtered mode-0600 cache and temp cleanup. The installed CLI consumes its existing auth;
  no key/config file is read. This is identity export, not private-memory MCP normalization. Mocked contract tests pass;
  real CLI execution on this box is unrun because it is not installed.
- New `@you/memory` sweep foundation accepts only explicit normalized `you-session/v1` JSONL exports and an allowlist
  manifest with personal/named-project scopes. No discovery, native-format parsers, databases, remote APIs or app storage.
- Sweep: recognized secret redaction before storage; credential-like metadata rejected; full-redacted-body dedupe with
  multiple source/session/event/line/timestamp/hash references; Unicode-safe display truncation; prefix/config-hash
  incremental checkpoints; rewrite/truncation detection; atomic mode-0600 state + exclusive writer lock. Invalid schema,
  JSON or UTF-8 aborts the transaction; incomplete trailing lines wait. State output must be outside git.
- Only user messages become quoted `proposed`, `untrusted-session`, `manual-only` observations. Assistant/tool/system
  messages are skipped. No promotion/accept/write-back API and no ingestion of session proposals into dispatch briefs.
  Redaction is defense in depth, not a promise to detect every secret; review exports locally before importing/sharing.
- Minimal honest UI: local static HTML brief inspector with actual source/readiness/scope/budget and escaped preview.
  No script/network access or new HTTP endpoint. Explicitly a preview, not a last-sent receipt or live-sync dashboard.
  `preview-ui OUTPUT.html [cwd]` refuses repository output and writes mode 0600.
- Continued v5 branding: approved alien-head SVG favicon/splash, vermilion/warm-gray dark default palette, existing
  Inter/Geist Mono tokens. Full app icon/string replacement and visual QA are still unfinished. No Sandbox/station work.
- Contracts, examples and limitations are in `docs/YOU-MEMORY.md`. `api-docs-guard` skill was unavailable, so contracts
  were documented directly without blocking implementation.

## Authentication (metadata only)

GitHub authenticated as houstongolden. MacBook Pro's `you`/`youmd` CLI is authenticated as @houstongolden;
its supported `you mcp` server returned structured `get_agent_brief` data using its stored credential in place.
Private response stayed in a mode-0600 Mac temp file outside repositories. No key was read, extracted or transferred.
Hosted you.md MCP still lacks auth; that does not mean local CLI login is missing. Box can keep using public cache
or explicit example preview until runtime integration is ready. No new credential/user decision required to continue.

## Verification

Node 26.12.1 / pnpm 12.14.0 under `/workspace/.tools`. Before the environment interruption below:

- `@you/brief`: 21 tests passed.
- `@you/memory`: 11 tests passed.
- Server adapters/provider suites: 74 files, 1,622 passed.
- Full provider packages: Pi 157, Cursor 124, OpenCode 167, Grok 83, ACP 93 passed.
- Shared/theme package: 1,393 passed; 3 skipped.
- Aggregate executed suites: 3,671 passed, 3 skipped (not the full repo-wide test command).
- Full repo typecheck passed. Changed-file lint/format and `knip:check` passed.
- `pnpm build`: web/server/marketing complete; desktop Linux browser-import helper fails because `pkg-config` and
  `libsecret-1-dev` are missing from this box. No app compile/type error. Prior apt attempt could not install them.

Unrun: full repo-wide test command, browser-mode/visual QA/screenshots, live paid-provider calls, actual CLI bridge
execution on box, and desktop native packaging. The HTML inspector is structurally/security tested, not visually reviewed.

## Execution interruption / recovery

A shell/environment interruption during commits restored an older box snapshot: dependencies and `/tmp` evidence
were lost, and a locally successful but unpushed commit was not retained. Source changes mostly survived as unstaged
files. Recovered only our missing final edits, reinstalled dependencies and reverified before the final commits/push.
Unrelated `.repos/alchemy-effect` fixture/submodule deletions appeared in the restored checkout; left untouched and
excluded from our commits. Never reset/rebase/force-push to recover this interruption.

Post-recovery reruns: brief 21/21, memory 11/11, server 1,622/1,622 passed; full repo typecheck passed; build again
completed web/server/marketing with the same desktop system-header blocker. Final commit hooks rerun format/lint/knip.
Persistent inspector artifact: `/workspace/agent-tools/you-m1-brief-preview.html` (actual public-cache snapshot, 1,935 of
4,000 bytes; personal scope because the public profile has no exact `/workspace/you` project-root mapping). No fake
active-project claim. No generated/private HTML is committed.

## Next bounded step

1. Explicit review/acceptance with a named destination scope (never blanket promotion).
2. Stable allowlisted authenticated CLI/MCP brief normalization and freshness/error metadata.
3. Selected vendor-supported export converters; current importer supports normalized exports only.
4. Authenticated in-app inspector and dispatch receipts with correct server/user boundary, then visual QA.

## Licenses / history

Started at t3code a21d78875; M0 commit 2c2dafedc added initial Claude/Codex injection. M1 supersedes M0's stale-auth,
fixture-injection and profile-only cache assumptions. T3 Code MIT, Copyright (c) 2026 T3 Tools Inc.; original LICENSE
unchanged, upstream credit in NOTICE-YOU.md, third-party notices retained. Approved v5 assets reused.

M0 GitHub check found `houstongolden/cloudroom-core` Apache-2.0. Not vendored. Future Sandbox work must preserve
LICENSE/NOTICE, bundled MIT notices and change attribution; never reuse that upstream name/icon. No higgsfieldclone code.
