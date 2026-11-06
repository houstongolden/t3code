// @effect-diagnostics nodeBuiltinImport:off
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { redactText } from "./redact.ts";
import type { SourceOptions } from "./sources.ts";

export type ReferenceScope =
  | { readonly kind: "personal" }
  | { readonly kind: "project"; readonly projectId: string };
export interface ReviewEvidence {
  readonly sourceId: string;
  readonly provider: string;
  readonly sessionId: string;
  readonly eventId: string;
  readonly line: number;
  readonly timestamp: string;
  readonly redactedBodyHash: string;
}
export interface ReviewEvent {
  readonly id: string;
  readonly at: string;
  readonly actor: string;
  readonly action: "accept" | "reject" | "correct" | "undo";
  readonly proposalId: string;
  readonly key: string;
  readonly content: string;
  readonly scope: ReferenceScope;
  readonly target: string;
  readonly evidence: ReadonlyArray<ReviewEvidence>;
  readonly previous: string;
  readonly hash: string;
}
export interface ReviewLedger {
  readonly version: 1;
  readonly events: ReadonlyArray<ReviewEvent>;
}
export interface ReviewedReference {
  readonly id: string;
  readonly proposalId: string;
  readonly key: string;
  readonly content: string;
  readonly scope: ReferenceScope;
  readonly evidence: ReadonlyArray<ReviewEvidence>;
}
export const EMPTY_REVIEW_REVISION = "genesis";
export const reviewRevision = (ledger: ReviewLedger) =>
  ledger.events.at(-1)?.hash ?? EMPTY_REVIEW_REVISION;
export const sameScope = (a: ReferenceScope, b: ReferenceScope) =>
  a.kind === b.kind &&
  (a.kind === "personal" || (b.kind === "project" && a.projectId === b.projectId));
export const reviewEventHash = (event: Omit<ReviewEvent, "hash">): string =>
  NodeCrypto.createHash("sha256").update(JSON.stringify(event)).digest("hex");
const scopeKey = (s: ReferenceScope) =>
  s.kind === "personal" ? "personal" : `project:${s.projectId}`;
const identifier = (s: unknown): s is string =>
  typeof s === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(s) && redactText(s) === s;

/** A hash chain detects corruption; it is not an identity signature or permission to execute stored text. */
export function validateReviewLedger(value: unknown): ReviewLedger {
  const v = value as ReviewLedger;
  if (!v || v.version !== 1 || !Array.isArray(v.events) || v.events.length > 10_000)
    throw new Error("Invalid review ledger");
  let previous = EMPTY_REVIEW_REVISION;
  const ids = new Set<string>();
  for (const e of v.events) {
    if (
      !e ||
      !identifier(e.id) ||
      ids.has(e.id) ||
      !identifier(e.actor) ||
      !["accept", "reject", "correct", "undo"].includes(e.action) ||
      typeof e.at !== "string" ||
      !Number.isFinite(Date.parse(e.at)) ||
      typeof e.content !== "string" ||
      Buffer.byteLength(e.content) > 4000 ||
      redactText(e.content) !== e.content ||
      !identifier(e.key) ||
      !identifier(e.proposalId) ||
      typeof e.target !== "string" ||
      !e.scope ||
      !(
        e.scope.kind === "personal" ||
        (e.scope.kind === "project" && identifier(e.scope.projectId))
      ) ||
      !Array.isArray(e.evidence) ||
      e.evidence.length > 500 ||
      e.evidence.some(
        (x: ReviewEvidence) =>
          !identifier(x.sourceId) ||
          !identifier(x.provider) ||
          !identifier(x.sessionId) ||
          !identifier(x.eventId) ||
          !Number.isInteger(x.line) ||
          x.line < 1 ||
          !/^[a-f0-9]{64}$/.test(x.redactedBodyHash) ||
          !Number.isFinite(Date.parse(x.timestamp)),
      )
    )
      throw new Error("Invalid review event");
    const { hash, ...body } = e;
    if (e.previous !== previous || reviewEventHash(body) !== hash)
      throw new Error("Review audit integrity check failed");
    previous = hash;
    ids.add(e.id);
  }
  materializeReview(v); // Also validate reversible transition semantics.
  return v;
}

export function materializeReview(ledger: ReviewLedger): {
  references: ReviewedReference[];
  decisions: Map<string, { status: "accepted" | "rejected" | "superseded"; eventId: string }>;
} {
  const activeEvents: ReviewEvent[] = [];
  for (const e of ledger.events) {
    if (e.action === "undo") {
      if (activeEvents.at(-1)?.id !== e.target)
        throw new Error("Only the latest active review decision can be undone");
      activeEvents.pop();
    } else activeEvents.push(e);
  }
  const references = new Map<string, ReviewedReference>();
  const decisions = new Map<
    string,
    { status: "accepted" | "rejected" | "superseded"; eventId: string }
  >();
  for (const e of activeEvents) {
    if (e.action === "reject") {
      decisions.set(e.proposalId, { status: "rejected", eventId: e.id });
      continue;
    }
    const k = JSON.stringify([scopeKey(e.scope), e.key]);
    const existing = references.get(k);
    if (e.action === "accept" && existing)
      throw new Error("Conflicting memory key: use an explicit correction");
    if (e.action === "correct" && (!existing || e.target !== existing.id))
      throw new Error("Correction target is not the active reference in this scope");
    if (existing)
      decisions.set(existing.proposalId, { status: "superseded", eventId: existing.id });
    references.set(k, {
      id: e.id,
      proposalId: e.proposalId,
      key: e.key,
      content: e.content,
      scope: e.scope,
      evidence: e.evidence,
    });
    decisions.set(e.proposalId, { status: "accepted", eventId: e.id });
  }
  return { references: [...references.values()], decisions };
}

export function readReviewLedger(directory: string): ReviewLedger {
  const path = NodePath.join(directory, "review.json");
  if (!NodeFS.existsSync(path)) return { version: 1, events: [] };
  const stat = NodeFS.lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20_000_000)
    throw new Error("Invalid review ledger file");
  return validateReviewLedger(JSON.parse(NodeFS.readFileSync(path, "utf8")));
}
export const reviewDirectory = (opts: SourceOptions = {}) =>
  (opts.env ?? process.env).YOU_MEMORY_DIR ??
  NodePath.join(opts.home ?? NodeOS.homedir(), ".you", "memory");
export function loadReviewedReferences(opts: SourceOptions = {}): ReviewedReference[] {
  const env = opts.env ?? process.env;
  if (env.VITEST && !env.YOU_MEMORY_DIR) return []; // Never pull real owner state into provider fixtures.
  return materializeReview(readReviewLedger(reviewDirectory(opts))).references;
}
