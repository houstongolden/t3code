export const YOU_MEMORY_REVIEW_PATH = "/api/you-memory/review";
export const YOU_MEMORY_UPDATED_EVENT = "you-memory-updated";

export interface YouMemoryScope {
  readonly kind: "personal" | "project";
  readonly projectId: string | null;
}

export interface YouMemoryKnown {
  readonly id: string;
  readonly proposalId: string;
  readonly key: string;
  readonly content: string;
  readonly scope: YouMemoryScope;
}

export interface YouMemoryPending {
  readonly id: string;
  readonly content: string;
  readonly suggestedKey: string;
  readonly scope: YouMemoryScope;
  readonly from: string;
}

export interface YouMemoryReview {
  readonly revision: string;
  readonly csrf: string;
  readonly identity: {
    readonly name: string | null;
    readonly username: string | null;
    readonly tagline: string | null;
    readonly source: string | null;
  } | null;
  readonly place: {
    readonly scope: "personal" | "project";
    readonly project: string | null;
    readonly source: string | null;
  } | null;
  readonly ready: ReadonlyArray<YouMemoryKnown>;
  readonly elsewhere: ReadonlyArray<YouMemoryKnown>;
  readonly pending: ReadonlyArray<YouMemoryPending>;
  readonly undo: {
    readonly eventId: string;
    readonly action: string;
    readonly summary: string;
    readonly scope: YouMemoryScope;
  } | null;
}

export type YouMemoryReviewState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly review: YouMemoryReview }
  | { readonly status: "locked" }
  | { readonly status: "unavailable" };

export type YouMemoryDecision =
  | {
      readonly action: "accept" | "reject" | "correct";
      readonly proposalId: string;
      readonly key: string;
      readonly content: string;
      readonly scope: YouMemoryScope;
      readonly target: string;
    }
  | { readonly action: "undo"; readonly eventId: string; readonly scope: YouMemoryScope };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, max) : null;

function parseScope(value: unknown): YouMemoryScope | null {
  if (!isRecord(value)) return null;
  if (value.kind === "personal") return { kind: "personal", projectId: null };
  const projectId = text(value.projectId, 128);
  if (value.kind === "project" && projectId) return { kind: "project", projectId };
  return null;
}

function parseKnown(value: unknown): YouMemoryKnown | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 128);
  const proposalId = text(value.proposalId, 128);
  const key = text(value.key, 128);
  const content = text(value.content, 4000);
  const scope = parseScope(value.scope);
  if (!id || !proposalId || !key || !content || !scope) return null;
  return { id, proposalId, key, content, scope };
}

function parsePending(value: unknown): YouMemoryPending | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 128);
  const content = text(value.content, 4000);
  const suggestedKey = text(value.suggestedKey, 128);
  const from = text(value.from, 80);
  const scope = parseScope(value.scope);
  if (!id || !content || !suggestedKey || !from || !scope) return null;
  return { id, content, suggestedKey, from, scope };
}

export function parseYouMemoryReview(input: unknown): YouMemoryReview | null {
  if (!isRecord(input) || input.version !== 1 || input.error) return null;
  const revision = text(input.revision, 128);
  const csrf = text(input.csrf, 256);
  if (!revision || !csrf) return null;
  const identity =
    isRecord(input.identity) && input.identity.status === "ready" ? input.identity : null;
  let place: YouMemoryReview["place"] = null;
  if (
    isRecord(input.place) &&
    (input.place.scope === "personal" || input.place.scope === "project")
  ) {
    place = {
      scope: input.place.scope,
      project: text(input.place.project, 80),
      source: text(input.place.source, 32),
    };
  }
  const ready = Array.isArray(input.ready)
    ? input.ready
        .map(parseKnown)
        .filter((item): item is YouMemoryKnown => item !== null)
        .slice(0, 40)
    : [];
  const elsewhere = Array.isArray(input.elsewhere)
    ? input.elsewhere
        .map(parseKnown)
        .filter((item): item is YouMemoryKnown => item !== null)
        .slice(0, 40)
    : [];
  const pending = Array.isArray(input.pending)
    ? input.pending
        .map(parsePending)
        .filter((item): item is YouMemoryPending => item !== null)
        .slice(0, 40)
    : [];
  let undo: YouMemoryReview["undo"] = null;
  if (isRecord(input.undo)) {
    const eventId = text(input.undo.eventId, 128);
    const action = text(input.undo.action, 16);
    const summary = text(input.undo.summary, 160);
    const scope = parseScope(input.undo.scope);
    if (eventId && action && summary && scope) undo = { eventId, action, summary, scope };
  }
  return {
    revision,
    csrf,
    identity: identity
      ? {
          name: text(identity.name, 80),
          username: text(identity.username, 64),
          tagline: text(identity.tagline, 240),
          source: text(identity.source, 32),
        }
      : null,
    place,
    ready,
    elsewhere,
    pending,
    undo,
  };
}

export function sameMemoryScope(left: YouMemoryScope, right: YouMemoryScope) {
  return left.kind === right.kind && left.projectId === right.projectId;
}

/** The kept note a new key would replace in the same place. */
export function keptWithKey(
  review: YouMemoryReview,
  scope: YouMemoryScope,
  key: string,
): YouMemoryKnown | null {
  const name = key.trim();
  if (!name) return null;
  return (
    [...review.ready, ...review.elsewhere].find(
      (item) => item.key === name && sameMemoryScope(item.scope, scope),
    ) ?? null
  );
}

export function scopePhrase(scope: YouMemoryScope) {
  return scope.kind === "personal" ? "Every chat" : (scope.projectId ?? "This project");
}
