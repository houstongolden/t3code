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
→ relevant skills → current focus. Included/truncated/dropped sections are available in preview metadata.

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

The HTML inspector is a static local preview of the real source snapshot and budget, not a last-sent receipt or an
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
- Inspect is metadata-only unless `--show-content` is explicit. No accept/promote/write-back API exists yet.

## Next boundary

Build review/acceptance with explicit destination scope and owner approval; then selected vendor export adapters and
private MCP brief normalization with a stable allowlisted schema. Keep private data and credentials out of source
control. Add an authenticated in-app inspector only with an explicit server/user boundary; do not expose raw brain
contents on a new unauthenticated HTTP endpoint.
