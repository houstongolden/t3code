# You memory: local M1 contracts

You is the identity and memory layer for agents you already use. This bounded milestone adds local imports and
inspectable references, not a new Sandbox or orchestration runtime.

## Brief sources and trust

Dispatch resolution: `YOU_BRIEF_PROFILE` → `~/.you/you.json` → `~/.you/cache/cli-you.json` →
`~/.you/cache/public-you.json`. The bundled **invented example** fixture is preview-only unless explicitly selected
with `YOU_BRIEF=example`. `YOU_BRIEF=off` disables injection. Tests opt in with `YOU_BRIEF=on` so exact upstream
request tests remain isolated.

Profiles must contain a username or identity name. Unknown fields, `custom_files`, conversation bodies and memories
are discarded. Only identity, owner preference metadata, goals, current-focus metadata and project descriptors are
supported. Credential-pattern redaction is defense in depth, not a guarantee that arbitrary text contains no secrets.
Do not point profile sources at credential files.

Explicit project `paths` must be absolute roots and match on directory boundaries. Otherwise only the normalized
cwd leaf is matched to the project name. No prefix or ancestor guessing. Other-project goals and descriptors do not
enter the brief; orphan project goals are ignored. Personal identity/preferences/goals remain cross-project context.
Skills come from metadata in `~/.agent-shared/claude-skills` (canonical), legacy `~/.agent-shared/skills`, and
`~/.you/skills`. Only keyword-relevant names/descriptions are included, never skill bodies.

Every brief includes source, scope and `reference-only` trust labels. Imported session proposals are a separate
format and are NEVER read by the brief resolver. Changing source files takes effect at the next dispatch; no stale
profile/skill memo is retained. The stateless reader fails open (dispatch without a brief), not with a provider failure.

### Provider paths actually implemented

| Adapter        | Reference transport                                                           | Budget                |
| -------------- | ----------------------------------------------------------------------------- | --------------------- |
| Claude Code    | First block in SDK `systemPrompt.append`, explicitly reference-only           | 8,000 UTF-8 bytes     |
| Codex          | `additionalContext.you_brief`, kind `untrusted`, app keys cannot overwrite it | 4,000 bytes per value |
| Cursor SDK     | Reference envelope in normal user prompt                                      | 4,000 bytes           |
| Pi RPC         | Reference envelope in normal prompt payload                                   | 4,000 bytes           |
| Grok ACP       | Reference envelope in Grok flavor's normal prompt                             | 4,000 bytes           |
| OpenCode v1/v2 | Reference envelope in normal prompt                                           | 4,000 bytes           |

Native slash commands are unchanged. Non-Grok ACP flavors are not modified. This does not claim Hermes support,
live-provider smoke tests, or separate streaming-steer reinjection for OpenCode. Existing sessions retain the
references already sent; these are not remotely revocable memory entries.

Codex's upstream `CodexDeveloperInstructions.ts` defines 4,000 bytes per additionalContext **value**, documenting
1,000 tokens counted as UTF-8 bytes / 4. This is not 4 KiB (4,096), not a 4,000-byte limit on the whole context map,
and not a tokenizer/model-window guarantee. Tests assert byte-budget parity with that upstream constant and use
multibyte text. UTF-8 truncation never splits code points. Priority: identity → preferences → active project → goals
→ owner-reviewed references → relevant skills → current focus. The opt-in fresh private CLI reference is budgeted after active project context. Included/truncated/dropped sections are available in preview metadata.

### Supported CLI integration (no credential extraction)

```sh
node packages/brief/src/cli.ts refresh-cli
node packages/brief/src/cli.ts print /path/to/project
node packages/brief/src/cli.ts preview-ui /tmp/you-brief.html /path/to/project
```

`refresh-cli` invokes the installed `you export --json -o <temporary-directory>`. The You CLI owns its existing login;
no config/key file is read, no credential is passed, output is not logged, execution has a 15-second timeout.
A schema-allowlisted identity cache is written mode 0600, and the temporary export is removed. This is an identity
export, **not** a private-memory `get_agent_brief` integration. If unavailable, install the CLI and use supported
`you login`, then retry; public cache/fixtures keep development unblocked.

The `preview-ui` HTML inspector is a static local preview of the real source snapshot and budget, not a last-sent receipt or an
in-app live-sync dashboard. It has no script/network access. File creation refuses repository locations. Brand uses
the locked v5 alien-head mark, vermilion and warm gray; installed fonts have system fallbacks.

## Explicit session imports (local sweep foundation)

Only user-supplied normalized `you-session/v1` JSONL exports are supported. This is **not** native Claude, Codex,
Cursor, Pi, Grok or OpenCode session-format parsing. The provider field records claimed provenance, not verified
origin or support for reading a vendor's private storage.

Invented **example manifest** (save outside git alongside `export.jsonl`):

```json
{
  "version": 1,
  "sources": [
    {
      "id": "example-export",
      "file": "export.jsonl",
      "format": "you-session-jsonl-v1",
      "provider": "codex",
      "scope": { "kind": "project", "projectId": "example-app" }
    }
  ]
}
```

Invented **example JSONL** (one complete, newline-terminated event per line):

```json
{
  "schema": "you-session/v1",
  "id": "example-event",
  "sessionId": "example-session",
  "timestamp": "2026-11-06T20:00:00Z",
  "role": "user",
  "text": "Example: prefer small reviewed changes."
}
```

```sh
node packages/memory/src/cli.ts import /path/to/manifest.json /tmp/you-memory-state
node packages/memory/src/cli.ts inspect /tmp/you-memory-state
node packages/memory/src/cli.ts inspect /tmp/you-memory-state --show-content
```

- No directory discovery, native app storage, databases, background daemon, network or credential inspection.
  Inputs must be explicit regular exported `.jsonl` files, not symlinks or files under known app-private roots.
- Each source must explicitly declare personal or named-project scope. Identical text in different scopes stays
  separate. Inputs' embedded scope/authority fields are ignored; manifest scope is the import boundary.
- Only user messages become **quoted observations** with `status=proposed`, `trust=untrusted-session`,
  `promotion=manual-only`. Assistant/tool/system messages are counted as skipped. Quotes may contain malicious
  requests; they remain inert evidence, never trusted directives or automatically inferred facts.
- Redact recognized token/JWT/PEM/credential patterns before storage. Credential-looking provenance IDs are rejected.
  No generic redactor guarantees perfect detection: review sanitized exports locally before importing/sharing.
- Dedupe on full normalized redacted text + explicit scope, not truncated display text. Preserve multiple evidence
  references: source/provider/session/event/line/timestamp/full-redacted-body hash. Display is UTF-8 limited to
  4,000 bytes and reports truncation. No raw original transcript is copied to state.
- Incremental byte-offset checkpoints include prefix/config hashes. Rewrites/truncation/config changes reset that
  source scan while preserving prior proposals and their evidence; they do not auto-delete stale observations.
- Incomplete trailing lines wait for the next append. Invalid JSON/schema/UTF-8 aborts without checkpoint changes.
  Proposals and checkpoints share a single atomic state replacement, mode 0600, guarded by an exclusive writer lock.
  A stale crash lock must be inspected and removed manually; no unsafe lock stealing.
- State must be outside git (including worktrees/symlinked paths). The read path validates trust/scope/content again.
  Import limits: 64 sources, 5 MB per file, 64 KB per record, 10,000 records per source/run, 20 MB state.
- Inspect is metadata-only unless `--show-content` is explicit. Imported quotes remain proposals; M2 adds explicit local review below, never autonomous promotion.

## M2: explicit local review and dispatched reference context

The importer does not accept anything. An owner must inspect each quote, edit its reference content/key if needed,
and confirm the unchanged personal/project scope. `reviewProposal` (`@you/memory/review`) supports `accept`, `reject`,
`correct`, and latest-active-decision `undo`. A conflicting scoped key requires `correct` with the exact active target ID;
rejection must be explicitly undone before acceptance. Stale revisions fail, rather than overwriting another decision.
Undo is deliberately LIFO; arbitrary historical reversal is not implemented. Correction preserves both original and
replacement provenance. No private proposal has been accepted by the build executor.

`review.json` lives beside `state.json` outside git, mode 0600, with an exclusive writer lock and atomic fsynced replacement.
Its append-only logical event chain records UUID, actor, wall time, scope, proposal, redacted reference, source/session/event/
line/time/body-hash evidence, target, previous hash and current hash. This is an inspectable local corruption detector,
not a signature, identity authority, encrypted store or tamper-proof audit. Undo appends an event; it does not erase evidence.

A decision JSON has `action`, `expectedRevision` (initially `genesis`, then the last event hash), `proposalId`, `scope`,
`key` (identifier), `content` (1–4000 UTF-8 bytes for accept/correct), `target` (empty except correct/undo), `reviewed:true`.
Keep decision files outside git. Example synthetic decision:

```json
{
  "action": "accept",
  "expectedRevision": "genesis",
  "proposalId": "EXAMPLE_PROPOSAL_ID",
  "scope": { "kind": "project", "projectId": "example-app" },
  "key": "example-fact",
  "content": "Example reference only.",
  "target": "",
  "reviewed": true
}
```

```sh
node packages/memory/src/cli.ts review /private/local-state /private/explicit-decision.json
```

Normal adapter dispatch reads the materialized references on every call. Personal references intentionally cross projects.
Project IDs must equal the matched profile project's exact `memoryScope` (or exact `name` if omitted); no fuzzy scope matching
or scope widening. Reviewed references are quoted data in a separate section, never `agent_directives`. IDs connect brief
lines to the evidence/audit; count metadata describes eligible references, not a promise every line fits the provider budget.
Codex still marks the whole You entry `untrusted` and caps each value at **4000 UTF-8 bytes**.

## M2: supported private CLI/MCP boundary

```sh
node packages/brief/src/cli.ts refresh-private /absolute/project/cwd
```

Only this explicit refresh (or its authenticated UI button) spawns `you mcp` with the installed CLI's existing auth in place.
It sends MCP `initialize`, `notifications/initialized`, `tools/list`, then `get_agent_brief` with
`{format:"json",includeMemories:true}`. These tool arguments were checked against the live MCP schema. No credential/config
file is read, copied, transferred or logged. GET/dispatch do not refresh or launch login. Missing CLI/auth is a status, not a
reason to search local files. On the box the CLI remains unavailable; Mac authentication has not been transferred.

Transport: 15-second deadline, 4 MB aggregate output ceiling, suppressed stderr, bounded line parsing, UTF-8 stream decoding,
malformed/non-object messages ignored, child termination. Normalize only the observed `generatedAt`,
`user.{summary,authenticated}` fields. Unknown memory bodies, portfolio graph, next moves, paths and directives are dropped.
`project:null` is the live observed shape. Optional `project.{scopeId,summary}` plus exact `environment.cwd` is a defensive
local extension tested synthetically, **not** a verified upstream non-null project contract; unknown shapes are ignored.
Skill selection remains the existing local metadata-only flow, not private skill-body import.

Cache: `~/.you/cache/private-brief.json` (override `YOU_PRIVATE_BRIEF_PATH`), outside git, mode 0600. It stores only allowlisted,
redacted reference text and metadata, never the raw response. Auth is **reported by the cached CLI response**, not a live auth
check or authorization grant. Both upstream generated time and local refresh time must be ≤30 minutes old, with bounded future
skew. Stale/invalid/failed-auth caches contribute no private reference. Refresh failure invalidates old content and writes only
sanitized attempt-status metadata. Project reference is bound to the exact refresh cwd; personal reference is intentionally global.
No automatic sync or write-back to the hosted brain exists.

## M2: authenticated in-app inspector

Settings → About → You memory embeds `/api/you-memory`, a server-rendered same-origin form view backed by the actual brief
builder, proposals and review ledger. Requires the existing authenticated **browser cookie** session with `settings:write`;
bearer/DPoP/background sessions and read-only sessions cannot inspect or mutate this owner-local state. This is the primary local
runtime's inspector, not a remote multi-environment selector or last-sent/live-provider receipt.

POST requires same-origin/dev-origin, session-bound expiring HMAC CSRF, 32 KB body limit and explicit checked review confirmation.
Revision checks and immutable destination scope are enforced by the writer too. The owner can accept/reject/correct/undo and
explicitly refresh the CLI. All responses are private/no-store, escaped HTML, script-free CSP with self-only form/framing,
no-referrer, no body logging/analytics; route tracing is disabled. The iframe permits forms and same-origin but no scripts.
Private data is loaded server-side only after authentication, never compiled into web assets. The preview shows actual source,
reported auth, freshness, exact project match, byte budget, eligible reviewed-reference count and audit/proposal state.

Tests use synthetic exports, subprocesses and auth-service fixtures. One end-to-end test imports → accepts through authenticated
HTTP → exercises the actual Codex parameter builder → verifies untrusted bounded context and project isolation → undoes and
verifies its removal. This is dispatch-construction verification, not a paid/live Codex call. Browser visual QA is still required.

## Chat identity summary (M3)

`GET /api/you-memory/summary` returns metadata for the chat identity card: identity name/handle and
source, brief source/scope/active project/bytes/section names/eligible reviewed count/private status
word, and accepted/pending review counts. Same owner-session gate as `/api/you-memory`. It never
returns brief text, proposal content, evidence or credential data, and is `private, no-store`.

## In-app review

`GET` and `POST /api/you-memory/review` are the owner session's review surface. They use the same
browser-cookie `settings:write` gate, session CSRF, revision check, and `reviewProposal` writer as
the HTML inspector. The JSON document includes identity name/handle/tagline, which chat the notes
apply to, pending quotes, accepted notes eligible for the next task, and accepted notes kept for
another project. It does not include the dispatch brief text, private CLI bodies, evidence hashes,
or credentials. POST body is JSON, at most 32 KB, same-origin, with `reviewed: true`. Responses are
`private, no-store` and untraced. The HTML inspector remains for the same ledger.
