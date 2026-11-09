import { getDispatchBrief, loadSources } from "@you/brief";
import {
  materializeReview,
  readReviewLedger,
  reviewDirectory,
  reviewRevision,
  type ReferenceScope,
  type ReviewedReference,
} from "@you/brief/review";
import { inspectSweep, type ProposedMemory } from "@you/memory";
import type { ReviewInput } from "@you/memory/review";

const MAX_ITEMS = 40;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const bounded = (value: unknown, max: number) =>
  typeof value === "string" && Buffer.byteLength(value) <= max ? value : null;

/** Decode one explicit decision. Unknown shapes are refused before the ledger is touched. */
export function parseReviewDecision(value: unknown): ReviewInput | null {
  if (!isRecord(value)) return null;
  const action = value.action;
  if (action !== "accept" && action !== "reject" && action !== "correct" && action !== "undo")
    return null;
  if (value.reviewed !== true) return null;
  const expectedRevision = bounded(value.revision, 128);
  const proposalId = bounded(value.proposalId, 128) ?? "";
  const key = bounded(value.key, 128) ?? "";
  const content = bounded(value.content, 4000) ?? "";
  const target = bounded(value.target, 128) ?? "";
  if (!expectedRevision) return null;
  const scope =
    value.scope === "personal"
      ? { kind: "personal" as const }
      : value.scope === "project" && bounded(value.projectId, 128)
        ? { kind: "project" as const, projectId: String(value.projectId) }
        : null;
  if (!scope) return null;
  if (action === "undo" && target.length === 0) return null;
  if (action !== "undo" && proposalId.length === 0) return null;
  return { action, expectedRevision, proposalId, scope, key, content, target, reviewed: true };
}

export function reviewFailure(error: unknown): {
  readonly status: 400 | 409;
  readonly code: "confirmation" | "stale" | "conflict" | "rejected";
  readonly message: string;
} {
  const text = error instanceof Error ? error.message : "";
  if (text.includes("confirmation"))
    return {
      status: 400,
      code: "confirmation",
      message: "Confirm you reviewed this before saving.",
    };
  if (text.includes("revision"))
    return {
      status: 409,
      code: "stale",
      message: "This changed while you were reading it. Look again.",
    };
  if (text.includes("Conflicting memory key"))
    return {
      status: 409,
      code: "conflict",
      message:
        "That name is already kept for this place. Replace the kept note, or choose another name.",
    };
  return {
    status: 409,
    code: "rejected",
    message: "That was not saved. Check where it applies and try again.",
  };
}

export interface MemoryReviewScope {
  readonly kind: "personal" | "project";
  readonly projectId: string | null;
}

export interface MemoryReviewKnown {
  readonly id: string;
  readonly proposalId: string;
  readonly key: string;
  readonly content: string;
  readonly scope: MemoryReviewScope;
}

export interface MemoryReviewPending {
  readonly id: string;
  readonly content: string;
  readonly suggestedKey: string;
  readonly scope: MemoryReviewScope;
  readonly from: string;
}

export interface MemoryReviewDocument {
  readonly version: 1;
  readonly revision: string;
  readonly identity:
    | {
        readonly status: "ready";
        readonly source: string;
        readonly name?: string;
        readonly username?: string;
        readonly tagline?: string;
      }
    | { readonly status: "none" };
  readonly place: {
    readonly scope: "personal" | "project";
    readonly project: string | null;
    readonly source: string;
  } | null;
  /** Accepted notes that match this chat and are eligible for the next task. */
  readonly ready: ReadonlyArray<MemoryReviewKnown>;
  /** Accepted notes kept for a different project. */
  readonly elsewhere: ReadonlyArray<MemoryReviewKnown>;
  readonly pending: ReadonlyArray<MemoryReviewPending>;
  readonly undo: {
    readonly eventId: string;
    readonly action: string;
    readonly summary: string;
    readonly scope: MemoryReviewScope;
  } | null;
}

const short = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, max) : undefined;

const scopeOf = (scope: ReferenceScope): MemoryReviewScope =>
  scope.kind === "personal"
    ? { kind: "personal", projectId: null }
    : { kind: "project", projectId: scope.projectId };

const knownOf = (reference: ReviewedReference): MemoryReviewKnown => ({
  id: reference.id,
  proposalId: reference.proposalId,
  key: reference.key,
  content: reference.content,
  scope: scopeOf(reference.scope),
});

const appliesHere = (scope: ReferenceScope, activeProject: string | undefined): boolean =>
  scope.kind === "personal" || (activeProject !== undefined && scope.projectId === activeProject);

const fromLabel = (proposal: ProposedMemory) => {
  const evidence = proposal.evidence[0];
  if (!evidence) return "Imported note";
  const provider = evidence.provider.replaceAll(/[_-]+/g, " ");
  return `From a ${provider} session`;
};

const suggestedKey = (content: string, id: string) => {
  const slug = content
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug.length >= 3 ? slug : `note-${id.slice(0, 8)}`;
};

/**
 * Owner view of the same review ledger and brief the dispatch path reads.
 * Bodies are reference quotes, never instructions. Callers must keep this off traces.
 */
export function buildMemoryReview(cwd: string | null | undefined): MemoryReviewDocument {
  const directory = reviewDirectory();
  const ledger = readReviewLedger(directory);
  const state = materializeReview(ledger);
  const proposals = inspectSweep(directory);
  const brief = getDispatchBrief({ cwd, harness: "Codex", maxBytes: 4000 });
  let identity: MemoryReviewDocument["identity"] = { status: "none" };
  try {
    const sources = loadSources();
    const env = process.env;
    if (!(sources.source === "fixture" && env.YOU_BRIEF !== "example")) {
      const name = short(sources.profile.identity?.name, 80);
      const username = short(sources.profile.username, 64);
      const tagline = short(
        sources.profile.identity?.tagline || sources.profile.identity?.bio?.short,
        240,
      );
      if (name || username) {
        identity = {
          status: "ready",
          source: sources.source,
          ...(name === undefined ? {} : { name }),
          ...(username === undefined ? {} : { username }),
          ...(tagline === undefined ? {} : { tagline }),
        };
      }
    }
  } catch {
    identity = { status: "none" };
  }
  const activeProject = brief?.activeProject;
  const known = state.references.map(knownOf);
  const ready = known.filter((_, index) =>
    appliesHere(state.references[index]!.scope, activeProject),
  );
  const readyIds = new Set(ready.map((item) => item.id));
  const stack = ledger.events.reduce<Array<(typeof ledger.events)[number]>>((events, event) => {
    if (event.action === "undo") events.pop();
    else events.push(event);
    return events;
  }, []);
  const last = stack.at(-1);
  return {
    version: 1,
    revision: reviewRevision(ledger),
    identity,
    place:
      brief === undefined
        ? null
        : {
            scope: brief.provenance.scope,
            project: activeProject ?? null,
            source: brief.provenance.source,
          },
    ready: ready.slice(0, MAX_ITEMS),
    elsewhere: known.filter((item) => !readyIds.has(item.id)).slice(0, MAX_ITEMS),
    pending: proposals
      .filter((proposal) => !state.decisions.has(proposal.id))
      .slice(0, MAX_ITEMS)
      .map((proposal) => ({
        id: proposal.id,
        content: proposal.content,
        suggestedKey: suggestedKey(proposal.content, proposal.id),
        scope: scopeOf(proposal.scope),
        from: fromLabel(proposal),
      })),
    undo: last
      ? {
          eventId: last.id,
          action: last.action,
          summary:
            last.action === "reject"
              ? "the last skip"
              : last.action === "correct"
                ? `the correction to ${last.key}`
                : `keeping ${last.key}`,
          scope: scopeOf(last.scope),
        }
      : null,
  };
}
