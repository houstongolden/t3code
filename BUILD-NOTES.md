# You: build notes (M0, memory-first)

Date: 2026-11-04. Branch: `you/m0-brief` on houstongolden/t3code. Working tree: /workspace/you (box, not iCloud).

## Positioning applied

Memory first: every dispatch to Claude Code and Codex now carries a compact brief of who the user is, how they want
agents to work, the active project, current goals and relevant skills. Harness, Sandbox and station come later.

## Done

- Cloned houstongolden/t3code (fork of pingdotgg/t3code) at a21d78875. Branched `you/m0-brief`.
- Licenses: t3code is MIT (Copyright (c) 2026 T3 Tools Inc.), LICENSE kept verbatim; attribution in NOTICE-YOU.md.
  houstongolden/cloudroom-core reports Apache-2.0 on GitHub; not vendored yet. NOTICE obligations recorded in NOTICE-YOU.md.
- `packages/brief` (`@you/brief`), zero runtime deps:
  - Sources, in order: `$YOU_BRIEF_PROFILE`, `~/.you/you.json`, `~/.you/cache/public-you.json`
    (`node packages/brief/src/cli.ts fetch <username>` caches the public you.md/<user>/you.json, portrait stripped),
    bundled fixture (`fixtures/example-you.json`, invented, brief is labeled EXAMPLE DATA).
  - Skills: frontmatter name/description only from `~/.agent-shared/skills/*/SKILL.md` and `~/.you/skills`, ranked by
    overlap with the active project. Skill bodies are never read into the brief.
  - Active project: cwd matched to profile projects by `paths`, then by normalized name.
  - Goals: personal / project / global levels; project goals for other projects are filtered out.
  - Budget: priority packing (identity > directives > active project > goals > skills > now > other projects),
    line-level truncation, UTF-8 safe hard cap. Codex 4,000 bytes (Codex truncates additionalContext values over
    1,000 tokens = bytes/4; see CODEX_ADDITIONAL_CONTEXT_VALUE_MAX_BYTES). Claude 8,000 bytes.
  - Memoized per cwd/harness/budget, invalidated by profile mtime. Never throws into a dispatch.
  - `YOU_BRIEF=off` disables. Under VITEST it is off unless `YOU_BRIEF=on` (upstream tests assert exact params).
- Injection:
  - Codex (`CodexAdapterV2.ts`): `additionalContext.you_brief` (kind application), sent on every turn, independent
    of T3 MCP availability.
  - Claude (`ClaudeAdapterV2.ts`, `makeClaudeQueryOptions`): brief is the first block of `systemPrompt.append`.
- Minimal rebrand: app base name "You" (web branding + index.html), brand tokens in
  `packages/shared/src/youBrandTokens.ts` (vermilion #E5482F, G0-G9 warm grays, Inter + Geist Mono, hairline G4).
- License script: `@you/` treated as first-party like `@t3tools/`.

## Results

- `packages/brief`: 9/9 tests pass, typecheck clean.
- apps/server: adapters + provider suites 74 files / 1,620 tests pass, including a new Claude injection test.
- Repo `pnpm typecheck`: pass (suggestions only).
- `pnpm build`: web, server, marketing build. Desktop fails on this box only: the Linux browser-import helper needs
  pkg-config + libsecret-1-dev, which apt can't install here. Unrelated to the changes.
- apps/web unit tests touching branding: 338 pass; `*.browser.test.tsx` need browser mode (not run).
- Toolchain on box: Node 26.12.1 + pnpm 12.14.0 under /workspace/.tools (system node is 20).

## Next (M0 remaining)

1. Authenticated source: you.md MCP `get_agent_brief` / `you` CLI so private goals and projects land in ~/.you/you.json
   (needs a you.md API key on the box; the MCP returned "authentication required").
2. Codex adapter test for `you_brief` (the turn-param builder is inside the Effect layer; needs a testkit hook).
3. Brief for Cursor, Grok, Pi, OpenCode adapters; a "brief preview" panel in the UI showing exactly what was sent.
4. Wire youBrandTokens into a default "You" theme and the alien-head mark; replace remaining T3 strings and icons.
5. Then the sweep: ingest sessions from Claude/Codex/Cursor/Grok Bot into ~/.you, dedupe, propose memory writes.

## Blockers for Houston

- you.md API key on the box for the private brief (or run `you login` there).
- Decide repo home: keep on houstongolden/t3code branch, or create houstongolden/you (not created).
- npm login only if publishing @you/brief.
