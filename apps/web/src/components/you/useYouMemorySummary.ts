import { useEffect, useState } from "react";

import { YOU_MEMORY_UPDATED_EVENT } from "./youMemoryReview";
import {
  parseYouMemorySummary,
  YOU_MEMORY_SUMMARY_PATH,
  type YouMemoryState,
} from "./youMemorySummary";

/**
 * Reads the owner's memory metadata from the same-origin server with the browser
 * session cookie. 401/403 means this browser is not the owner session for this
 * machine; the UI says so instead of guessing. Refreshes when the window regains focus
 * so accepting a memory in review shows up without a reload.
 */
export function useYouMemorySummary(): YouMemoryState {
  const [state, setState] = useState<YouMemoryState>({ status: "loading" });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps an abortable same-origin request and a window focus listener in step with this mount; the data lives on the server, not in an app atom.
  useEffect(() => {
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      const { signal } = controller;
      fetch(YOU_MEMORY_SUMMARY_PATH, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json" },
        signal,
      })
        .then(async (response) => {
          if (response.status === 401 || response.status === 403)
            return { status: "locked" } as const;
          if (!response.ok) return { status: "unavailable" } as const;
          const summary = parseYouMemorySummary(await response.json());
          return summary
            ? ({ status: "ready", summary } as const)
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
  return state;
}
