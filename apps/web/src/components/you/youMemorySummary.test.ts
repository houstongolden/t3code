import { describe, expect, it } from "vite-plus/test";

import {
  describeMemoryFacts,
  formatBriefSize,
  identityInitials,
  parseYouMemorySummary,
} from "./youMemorySummary";

const ready = {
  version: 1,
  identity: { status: "ready", source: "local-you", name: "Example Owner", username: "example" },
  brief: {
    source: "local-you",
    scope: "project",
    activeProject: "example-app",
    bytes: 1874,
    maxBytes: 4000,
    reviewedEligible: 2,
    privateStatus: "missing",
    included: ["identity", "directives", "projects"],
  },
  review: { status: "ok", accepted: 2, pending: 3 },
};

describe("parseYouMemorySummary", () => {
  it("keeps only recognised metadata fields", () => {
    const parsed = parseYouMemorySummary({
      ...ready,
      brief: { ...ready.brief, text: "PRIVATE BRIEF TEXT" },
      token: "never-rendered",
    });
    expect(parsed).toEqual({
      identity: { name: "Example Owner", username: "example" },
      identitySource: "local-you",
      brief: {
        source: "local-you",
        scope: "project",
        activeProject: "example-app",
        bytes: 1874,
        maxBytes: 4000,
        reviewedEligible: 2,
        privateStatus: "missing",
        included: ["identity", "directives", "projects"],
      },
      review: { accepted: 2, pending: 3 },
    });
    expect(JSON.stringify(parsed)).not.toContain("PRIVATE BRIEF TEXT");
    expect(JSON.stringify(parsed)).not.toContain("never-rendered");
  });

  it("rejects unknown versions and degrades malformed sections to absent", () => {
    expect(parseYouMemorySummary({ ...ready, version: 2 })).toBeNull();
    expect(parseYouMemorySummary(null)).toBeNull();
    const parsed = parseYouMemorySummary({
      version: 1,
      identity: { status: "none" },
      brief: { source: "local-you", bytes: -1, maxBytes: 4000, reviewedEligible: 0 },
      review: { status: "unavailable" },
    });
    expect(parsed).toEqual({ identity: null, identitySource: null, brief: null, review: null });
  });
});

describe("memory context facts", () => {
  it("derives every fact from the summary without inventing counts", () => {
    const parsed = parseYouMemorySummary(ready)!;
    expect(describeMemoryFacts(parsed)).toEqual([
      "project example-app",
      "1.9 KB of 4.0 KB",
      "2 reviewed memories",
      "3 to review",
    ]);
    const quiet = parseYouMemorySummary({
      ...ready,
      brief: { ...ready.brief, activeProject: undefined, reviewedEligible: 1 },
      review: { status: "ok", accepted: 1, pending: 0 },
    })!;
    expect(describeMemoryFacts(quiet)).toEqual([
      "personal scope",
      "1.9 KB of 4.0 KB",
      "1 reviewed memory",
    ]);
    expect(formatBriefSize(0, 4000)).toBe("0.0 KB of 4.0 KB");
  });

  it("builds initials from the real name or handle only", () => {
    expect(identityInitials(parseYouMemorySummary(ready)!)).toBe("EO");
    expect(
      identityInitials(
        parseYouMemorySummary({ ...ready, identity: { status: "ready", username: "solo" } })!,
      ),
    ).toBe("S");
    expect(
      identityInitials(parseYouMemorySummary({ ...ready, identity: { status: "ready" } })!),
    ).toBe("?");
  });
});
