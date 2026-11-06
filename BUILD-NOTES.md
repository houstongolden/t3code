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
