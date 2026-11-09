import { useEffect, useState } from "react";

import {
  parseYouMemoryReview,
  YOU_MEMORY_REVIEW_PATH,
  YOU_MEMORY_UPDATED_EVENT,
  type YouMemoryDecision,
  type YouMemoryReviewState,
} from "./youMemoryReview";

export type YouMemoryDecisionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

/**
 * Owner review of local memory. The cookie session is the credential; a failed
 * read is locked or unavailable, never a guessed profile.
 */
export function useYouMemoryReview(): {
  readonly state: YouMemoryReviewState;
  readonly decide: (decision: YouMemoryDecision) => Promise<YouMemoryDecisionResult>;
} {
  const [state, setState] = useState<YouMemoryReviewState>({ status: "loading" });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- abortable same-origin read of server memory, refreshed when a decision lands or the window refocuses.
  useEffect(() => {
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      const { signal } = controller;
      fetch(YOU_MEMORY_REVIEW_PATH, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json" },
        signal,
      })
        .then(async (response) => {
          if (response.status === 401 || response.status === 403)
            return { status: "locked" } as const;
          if (!response.ok) return { status: "unavailable" } as const;
          const review = parseYouMemoryReview(await response.json());
          return review
            ? ({ status: "ready", review } as const)
            : ({ status: "unavailable" } as const);
        })
        .then(
          (next) => {
            if (!signal.aborted) setState(next);
          },
          () => {
            if (!signal.aborted) setState({ status: "unavailable" });
          },
        );
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener(YOU_MEMORY_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener(YOU_MEMORY_UPDATED_EVENT, load);
      controller.abort();
    };
  }, []);

  const decide = async (decision: YouMemoryDecision): Promise<YouMemoryDecisionResult> => {
    if (state.status !== "ready")
      return { ok: false, code: "unavailable", message: "Memory could not be read." };
    const body =
      decision.action === "undo"
        ? {
            action: "undo",
            revision: state.review.revision,
            csrf: state.review.csrf,
            scope: decision.scope.kind,
            projectId: decision.scope.projectId ?? "",
            target: decision.eventId,
            proposalId: "",
            key: "",
            content: "",
            reviewed: true,
          }
        : {
            action: decision.action,
            revision: state.review.revision,
            csrf: state.review.csrf,
            scope: decision.scope.kind,
            projectId: decision.scope.projectId ?? "",
            proposalId: decision.proposalId,
            key: decision.key,
            content: decision.content,
            target: decision.target,
            reviewed: true,
          };
    let response: Response;
    try {
      response = await fetch(YOU_MEMORY_REVIEW_PATH, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false, code: "unavailable", message: "Memory could not be reached." };
    }
    const payload: unknown = await response.json().catch(() => null);
    const review = parseYouMemoryReview(payload);
    if (review) {
      setState({ status: "ready", review });
      window.dispatchEvent(new Event(YOU_MEMORY_UPDATED_EVENT));
    }
    if (response.ok && review) return { ok: true };
    const message =
      payload !== null &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "That was not saved.";
    const code =
      payload !== null &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "rejected";
    if (!review) window.dispatchEvent(new Event(YOU_MEMORY_UPDATED_EVENT));
    return { ok: false, code, message };
  };

  return { state, decide };
}
