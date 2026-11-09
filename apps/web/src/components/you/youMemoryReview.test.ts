import { describe, expect, it } from "vite-plus/test";

import { keptWithKey, parseYouMemoryReview, type YouMemoryReview } from "./youMemoryReview";

const review = {
  version: 1,
  revision: "genesis",
  csrf: "1.aa",
  identity: {
    status: "ready",
    name: "Synthetic Demo",
    username: "synthetic-demo",
    source: "env-file",
  },
  place: { scope: "project", project: "example-app", source: "env-file" },
  ready: [
    {
      id: "kept-1",
      proposalId: "proposal-1",
      key: "shared-key",
      content: "Kept for this chat",
      scope: { kind: "project", projectId: "example-app" },
    },
  ],
  elsewhere: [],
  pending: [
    {
      id: "pending-1",
      content: "Waiting note",
      suggestedKey: "note-pending",
      scope: { kind: "project", projectId: "example-app" },
      from: "From a codex session",
    },
  ],
  undo: null,
  briefText: "must not survive",
  secret: "sk-live-must-not-survive",
};

describe("you memory review", () => {
  it("keeps owner review fields and drops anything else", () => {
    const parsed = parseYouMemoryReview(review);
    expect(parsed?.identity).toMatchObject({ name: "Synthetic Demo", username: "synthetic-demo" });
    expect(parsed?.ready[0]?.content).toBe("Kept for this chat");
    expect(parsed?.pending).toHaveLength(1);
    expect(JSON.stringify(parsed)).not.toContain("must not survive");
    expect(parseYouMemoryReview({ ...review, error: "conflict" })).toBeNull();
    expect(parseYouMemoryReview({ version: 1 })).toBeNull();
  });

  it("finds the kept note a duplicate name would replace", () => {
    const parsed = parseYouMemoryReview(review) as YouMemoryReview;
    const scope = { kind: "project" as const, projectId: "example-app" };
    expect(keptWithKey(parsed, scope, "shared-key")?.id).toBe("kept-1");
    expect(keptWithKey(parsed, scope, "other-key")).toBeNull();
    expect(keptWithKey(parsed, { kind: "personal", projectId: null }, "shared-key")).toBeNull();
  });
});
