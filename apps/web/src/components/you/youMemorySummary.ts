/**
 * Client view of GET /api/you-memory/summary. Metadata only: the server never sends
 * brief text, proposal content or credentials on this route, and the parser drops
 * anything it does not recognise so a changed server cannot smuggle extra fields into UI.
 */
export const YOU_MEMORY_SUMMARY_PATH = "/api/you-memory/summary";

export interface YouMemorySummary {
  readonly identity: { readonly name: string | null; readonly username: string | null } | null;
  readonly identitySource: string | null;
  readonly brief: {
    readonly source: string;
    readonly scope: "personal" | "project";
    readonly activeProject: string | null;
    readonly bytes: number;
    readonly maxBytes: number;
    readonly reviewedEligible: number;
    readonly privateStatus: string;
    readonly included: ReadonlyArray<string>;
  } | null;
  readonly review: { readonly accepted: number; readonly pending: number } | null;
}

export type YouMemoryState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly summary: YouMemorySummary }
  | { readonly status: "locked" }
  | { readonly status: "unavailable" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 80): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, max) : null;
const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 10_000_000
    ? value
    : null;

export function parseYouMemorySummary(input: unknown): YouMemorySummary | null {
  if (!isRecord(input) || input.version !== 1) return null;
  const identity =
    isRecord(input.identity) && input.identity.status === "ready" ? input.identity : null;
  let brief: YouMemorySummary["brief"] = null;
  if (isRecord(input.brief)) {
    const bytes = count(input.brief.bytes);
    const maxBytes = count(input.brief.maxBytes);
    const reviewedEligible = count(input.brief.reviewedEligible);
    const source = text(input.brief.source, 32);
    if (
      bytes !== null &&
      maxBytes !== null &&
      maxBytes > 0 &&
      reviewedEligible !== null &&
      source
    ) {
      brief = {
        source,
        scope: input.brief.scope === "project" ? "project" : "personal",
        activeProject: text(input.brief.activeProject),
        bytes,
        maxBytes,
        reviewedEligible,
        privateStatus: text(input.brief.privateStatus, 32) ?? "unknown",
        included: Array.isArray(input.brief.included)
          ? input.brief.included
              .map((section) => text(section, 32))
              .filter((section): section is string => section !== null)
              .slice(0, 12)
          : [],
      };
    }
  }
  let review: YouMemorySummary["review"] = null;
  if (isRecord(input.review) && input.review.status === "ok") {
    const accepted = count(input.review.accepted);
    const pending = count(input.review.pending);
    if (accepted !== null && pending !== null) review = { accepted, pending };
  }
  return {
    identity: identity
      ? { name: text(identity.name), username: text(identity.username, 64) }
      : null,
    identitySource: identity ? text(identity.source, 32) : null,
    brief,
    review,
  };
}

const SOURCE_LABELS: Record<string, string> = {
  "local-you": "local ~/.you",
  "env-file": "profile file",
  "public-cache": "public profile cache",
  "cli-cache": "you cli cache",
  fixture: "example fixture",
  provided: "provided",
};

export const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source;

/** Initials for the dotted identity tile, from the real name or handle only. */
export function identityInitials(summary: YouMemorySummary): string {
  const name = summary.identity?.name ?? summary.identity?.username ?? "";
  const parts = name.split(/[\s._-]+/).filter((part) => /^[\p{L}\p{N}]/u.test(part));
  const initials = parts
    .slice(0, 2)
    .map((part) => [...part][0]!.toUpperCase())
    .join("");
  return initials || "?";
}

export function formatBriefSize(bytes: number, maxBytes: number): string {
  const kb = (value: number) => `${(value / 1000).toFixed(1)} KB`;
  return `${kb(bytes)} of ${kb(maxBytes)}`;
}

/** Facts shown on the context line. Every entry is derived from the summary; nothing is inferred. */
export function describeMemoryFacts(summary: YouMemorySummary): ReadonlyArray<string> {
  const facts: string[] = [];
  if (summary.brief) {
    facts.push(
      summary.brief.activeProject ? `project ${summary.brief.activeProject}` : "personal scope",
    );
    facts.push(formatBriefSize(summary.brief.bytes, summary.brief.maxBytes));
    facts.push(
      `${summary.brief.reviewedEligible} reviewed ${summary.brief.reviewedEligible === 1 ? "memory" : "memories"}`,
    );
  }
  if (summary.review && summary.review.pending > 0) {
    facts.push(`${summary.review.pending} to review`);
  }
  return facts;
}
