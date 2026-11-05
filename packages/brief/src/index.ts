// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";

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

const memo = new Map<string, { stamp: string; result: BriefResult }>();

const stampOf = (path: string) => {
  try {
    return String(NodeFS.statSync(path).mtimeMs);
  } catch {
    return "none";
  }
};

/**
 * Brief for one provider dispatch. Returns undefined when disabled with YOU_BRIEF=off.
 * Cached per (cwd, harness, budget) and invalidated when the profile file changes.
 */
export function getDispatchBrief(input: DispatchBriefInput): BriefResult | undefined {
  const env = input.env ?? process.env;
  if (env.YOU_BRIEF === "off" || env.YOU_BRIEF === "0") return undefined;
  // Upstream adapter tests assert exact turn params; opt in there with YOU_BRIEF=on.
  if (env.VITEST !== undefined && env.YOU_BRIEF !== "on") return undefined;
  try {
    const sources = loadSources(input);
    const key = `${input.cwd ?? ""}|${input.harness}|${input.maxBytes}|${sources.sourcePath}`;
    const stamp = stampOf(sources.sourcePath);
    const hit = memo.get(key);
    if (hit && hit.stamp === stamp) return hit.result;
    const result = buildBrief(
      {
        profile: sources.profile,
        cwd: input.cwd,
        harness: input.harness,
        skills: sources.skills,
        source: sources.source,
      },
      input.maxBytes,
    );
    memo.set(key, { stamp, result });
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
