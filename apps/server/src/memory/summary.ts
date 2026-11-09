import { getDispatchBrief, getOwnerIdentity, type SourceOptions } from "@you/brief";
import { materializeReview, readReviewLedger, reviewDirectory } from "@you/brief/review";
import { inspectSweep } from "@you/memory";

export const SUMMARY_PATH = "/api/you-memory/summary";
const SUMMARY_BRIEF_MAX_BYTES = 4000;

/**
 * Metadata-only view of the owner's memory state for the chat surface.
 * Never contains brief text, proposal content, evidence, or credential state beyond a status word.
 */
export interface YouMemorySummary {
  readonly version: 1;
  readonly identity:
    | {
        readonly status: "ready";
        readonly source: string;
        readonly name?: string;
        readonly username?: string;
      }
    | { readonly status: "none" };
  readonly brief: {
    readonly source: string;
    readonly scope: "personal" | "project";
    readonly activeProject?: string;
    readonly bytes: number;
    readonly maxBytes: number;
    readonly reviewedEligible: number;
    /** Section names only (identity, projects, ...), never section text. */
    readonly included: ReadonlyArray<string>;
    readonly privateStatus: string;
  } | null;
  readonly review:
    | { readonly status: "ok"; readonly accepted: number; readonly pending: number }
    | { readonly status: "unavailable" };
}

export function buildMemorySummary(
  cwd: string | null | undefined,
  opts: SourceOptions = {},
): YouMemorySummary {
  const identity = getOwnerIdentity(opts);
  const brief = getDispatchBrief({
    ...opts,
    cwd,
    harness: "Codex",
    maxBytes: SUMMARY_BRIEF_MAX_BYTES,
  });
  let review: YouMemorySummary["review"];
  try {
    const directory = reviewDirectory(opts);
    const state = materializeReview(readReviewLedger(directory));
    const proposals = inspectSweep(directory);
    review = {
      status: "ok",
      accepted: state.references.length,
      pending: proposals.filter((proposal) => !state.decisions.has(proposal.id)).length,
    };
  } catch {
    review = { status: "unavailable" };
  }
  return {
    version: 1,
    identity: identity === undefined ? { status: "none" } : { status: "ready", ...identity },
    brief:
      brief === undefined
        ? null
        : {
            source: brief.provenance.source,
            scope: brief.provenance.scope,
            ...(brief.activeProject === undefined ? {} : { activeProject: brief.activeProject }),
            bytes: brief.bytes,
            maxBytes: SUMMARY_BRIEF_MAX_BYTES,
            reviewedEligible: brief.reviewedMemoryCount,
            included: brief.included.slice(0, 12),
            privateStatus: brief.privateStatus,
          },
    review,
  };
}
