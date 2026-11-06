// @effect-diagnostics globalDate:off
// Wall-clock metadata at the synchronous Node persistence boundary.
// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeCrypto from "node:crypto";
import { redactText, byteLength } from "@you/brief";
import {
  materializeReview,
  readReviewLedger,
  reviewRevision,
  reviewEventHash,
  sameScope,
  validateReviewLedger,
  type ReferenceScope,
  type ReviewEvent,
} from "@you/brief/review";
import { ensureOutsideGit, inspectSweep } from "./sweep.ts";

export interface ReviewInput {
  readonly action: "accept" | "reject" | "correct" | "undo";
  readonly expectedRevision: string;
  readonly proposalId: string;
  readonly scope: ReferenceScope;
  readonly key: string;
  readonly content: string;
  readonly target: string;
  readonly reviewed: boolean;
}

/** Local explicit decision only. Imported text remains reference data, never directives. */
export function reviewProposal(
  directory: string,
  input: ReviewInput,
  actor: string,
): { revision: string; eventId: string } {
  ensureOutsideGit(directory);
  if (!input.reviewed) throw new Error("Explicit review confirmation is required");
  NodeFS.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = NodePath.join(directory, ".review.lock");
  const fd = NodeFS.openSync(lock, "wx", 0o600);
  const staged = NodePath.join(directory, `review-${NodeCrypto.randomUUID()}.tmp`);
  try {
    const ledger = readReviewLedger(directory);
    if (reviewRevision(ledger) !== input.expectedRevision)
      throw new Error("Review revision changed; reload before deciding");
    const active = materializeReview(ledger);
    const proposal =
      input.action === "undo"
        ? undefined
        : inspectSweep(directory).find((p) => p.id === input.proposalId);
    if (input.action !== "undo" && (!proposal || !sameScope(input.scope, proposal.scope)))
      throw new Error("Proposal or destination scope mismatch");
    if (
      input.action === "reject" &&
      active.references.some((r) => r.proposalId === input.proposalId)
    )
      throw new Error("An accepted proposal cannot be rejected; undo or correct it explicitly");
    if ((input.action === "accept" || input.action === "reject") && input.target !== "")
      throw new Error("Unexpected review target");
    if (input.action === "accept" && active.decisions.get(input.proposalId)?.status === "accepted")
      throw new Error("Proposal already accepted; use correction");
    if (
      input.action === "correct" &&
      active.references.some((r) => r.proposalId === input.proposalId && r.id !== input.target)
    )
      throw new Error("Proposal already accepted under another key");
    if (input.action === "undo") {
      const target = ledger.events.find((e) => e.id === input.target);
      if (!target || !sameScope(target.scope, input.scope)) throw new Error("Undo scope mismatch");
    }
    const content =
      input.action === "accept" || input.action === "correct"
        ? redactText(input.content).trim()
        : "";
    if (
      (input.action === "accept" || input.action === "correct") &&
      (!content || byteLength(content) > 4000)
    )
      throw new Error("Reviewed reference must be 1–4000 UTF-8 bytes");
    if (
      input.action !== "undo" &&
      active.decisions.get(input.proposalId)?.status === "rejected" &&
      input.action !== "reject"
    )
      throw new Error("Undo the rejection before accepting this proposal");
    const body = {
      id: NodeCrypto.randomUUID(),
      at: new Date().toISOString(),
      actor,
      action: input.action,
      proposalId: input.action === "undo" ? "undo" : input.proposalId,
      key: input.action === "undo" ? "undo" : input.key,
      content,
      scope:
        input.scope.kind === "personal"
          ? { kind: "personal" }
          : { kind: "project", projectId: input.scope.projectId },
      target: input.target,
      evidence: (proposal?.evidence ?? []).map((e) => ({
        sourceId: e.sourceId,
        provider: e.provider,
        sessionId: e.sessionId,
        eventId: e.eventId,
        line: e.line,
        timestamp: e.timestamp,
        redactedBodyHash: e.redactedBodyHash,
      })),
      previous: reviewRevision(ledger),
    } satisfies Omit<ReviewEvent, "hash">;
    const event = { ...body, hash: reviewEventHash(body) };
    const next = validateReviewLedger({ version: 1, events: [...ledger.events, event] });
    const encoded = JSON.stringify(next, null, 2);
    if (Buffer.byteLength(encoded) > 20_000_000) throw new Error("Review ledger limit exceeded");
    const file = NodeFS.openSync(staged, "wx", 0o600);
    try {
      NodeFS.writeFileSync(file, encoded);
      NodeFS.fsyncSync(file);
    } finally {
      NodeFS.closeSync(file);
    }
    NodeFS.renameSync(staged, NodePath.join(directory, "review.json"));
    return { revision: event.hash, eventId: event.id };
  } finally {
    NodeFS.closeSync(fd);
    NodeFS.unlinkSync(lock);
    if (NodeFS.existsSync(staged)) NodeFS.unlinkSync(staged);
  }
}
