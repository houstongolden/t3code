import { loadPrivateBrief } from "./privateBrief.ts";
import { loadReviewedReferences } from "./reviewLedger.ts";
// @effect-diagnostics nodeBuiltinImport:off

import { buildBrief, CLAUDE_BRIEF_MAX_BYTES, CODEX_BRIEF_MAX_BYTES } from "./build.ts";
import { loadSources, type SourceOptions } from "./sources.ts";
import type { BriefResult } from "./types.ts";

export * from "./types.ts";
export * from "./budget.ts";
export * from "./build.ts";
export * from "./sources.ts";

export interface DispatchBriefInput extends SourceOptions {
  readonly cwd?: string | null | undefined;
  readonly harness: string;
  readonly maxBytes: number;
}

/**
 * Brief for one provider dispatch. Returns undefined when disabled with YOU_BRIEF=off.
 * Fresh bounded reads each dispatch: profile and skill changes take effect immediately.
 */
export function getDispatchBrief(input: DispatchBriefInput): BriefResult | undefined {
  const env = input.env ?? process.env;
  if (env.YOU_BRIEF === "off" || env.YOU_BRIEF === "0") return undefined;
  // Upstream adapter tests assert exact turn params; opt in there with YOU_BRIEF=on.
  if (env.VITEST !== undefined && env.YOU_BRIEF !== "on") return undefined;
  try {
    const sources = loadSources(input);
    // Fixture data is for explicit previews/tests, never silently sent as a real user.
    if (sources.source === "fixture" && env.YOU_BRIEF !== "example") return undefined;
    let reviewedReferences: ReturnType<typeof loadReviewedReferences> = [];
    try {
      reviewedReferences = loadReviewedReferences(input);
    } catch {
      /* Corrupt review state never blocks identity dispatch. Inspector reports it. */
    }
    const result = buildBrief(
      {
        profile: sources.profile,
        reviewedReferences,
        privateBrief: loadPrivateBrief(input.cwd, input),
        cwd: input.cwd,
        harness: input.harness,
        skills: sources.skills,
        source: sources.source,
      },
      input.maxBytes,
    );
    return result;
  } catch {
    // A broken brief must never block a dispatch.
    return undefined;
  }
}

export const codexBrief = (cwd: string | null | undefined, opts: SourceOptions = {}) =>
  getDispatchBrief({ ...opts, cwd, harness: "Codex", maxBytes: CODEX_BRIEF_MAX_BYTES });

export const claudeBrief = (cwd: string | null | undefined, opts: SourceOptions = {}) =>
  getDispatchBrief({ ...opts, cwd, harness: "Claude Code", maxBytes: CLAUDE_BRIEF_MAX_BYTES });

export { normalizeProfile } from "./validate.ts";
export { redactText } from "./redact.ts";
