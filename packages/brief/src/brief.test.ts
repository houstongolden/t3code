// @effect-diagnostics nodeBuiltinImport:off globalConsole:off
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  buildBrief,
  byteLength,
  CODEX_BRIEF_MAX_BYTES,
  detectActiveProject,
  getDispatchBrief,
  listSkills,
  packSections,
  resolveProfile,
  truncateUtf8,
  type YouProfile,
} from "./index.ts";

const profile: YouProfile = {
  username: "tester",
  identity: { name: "Test Founder", location: "Venice, CA", tagline: "Runs many agents." },
  agent_directives: {
    communication_style: "direct",
    negative_prompts: ["never use emoji", "no corporate speak"],
    current_goal: "ship You",
    default_stack: "TypeScript",
  },
  now: { focus: ["focus one", "focus two"] },
  projects: [
    { name: "You.md", description: "identity layer", status: "active", paths: ["youmd"] },
    { name: "BAMF.ai", description: "post generator", status: "beta" },
  ],
  goals: [
    { title: "grow to 1000 users", level: "project", project: "You.md" },
    { title: "bamf beta", level: "project", project: "BAMF.ai" },
    { title: "surf more", level: "personal" },
  ],
};

describe("truncateUtf8", () => {
  it("never splits code points and respects the cap", () => {
    const s = "é".repeat(100) + "🛸".repeat(50);
    for (const cap of [1, 5, 17, 101, 299]) {
      const out = truncateUtf8(s, cap);
      expect(byteLength(out)).toBeLessThanOrEqual(cap);
      expect(out.includes("\uFFFD")).toBe(false);
    }
  });
});

describe("packSections", () => {
  it("keeps priority order and drops lowest priority first", () => {
    const big = Array.from({ length: 50 }, (_, i) => `line ${i} ${"x".repeat(40)}`);
    const r = packSections(
      "H",
      [
        { id: "low", priority: 9, heading: "Low", lines: big },
        { id: "high", priority: 0, heading: "High", lines: ["keep me"] },
      ],
      300,
    );
    expect(r.included).toEqual(["high"]);
    expect(r.truncated).toEqual(["low"]);
    expect(byteLength(r.text)).toBeLessThanOrEqual(300);
    expect(r.text.indexOf("High")).toBeLessThan(r.text.indexOf("Low"));
  });
});

describe("detectActiveProject", () => {
  it("matches explicit paths, then names", () => {
    expect(detectActiveProject(profile, "/work/youmd/app")?.name).toBe("You.md");
    expect(detectActiveProject(profile, "/work/bamfai")?.name).toBe("BAMF.ai");
    expect(detectActiveProject(profile, "/work/unrelated")).toBeUndefined();
  });
});

describe("buildBrief", () => {
  it("includes identity, directives, active project and only that project's goals", () => {
    const r = buildBrief({ profile, cwd: "/work/youmd" });
    expect(r.activeProject).toBe("You.md");
    expect(r.text).toContain("Test Founder");
    expect(r.text).toContain("never use emoji");
    expect(r.text).toContain("grow to 1000 users");
    expect(r.text).not.toContain("bamf beta");
    expect(r.text).toContain("surf more");
  });

  it("stays under the Codex 4,000 byte cap with a huge profile", () => {
    const huge: YouProfile = {
      ...profile,
      now: { focus: Array.from({ length: 400 }, (_, i) => `focus ${i} ${"🛸".repeat(30)}`) },
      projects: Array.from({ length: 200 }, (_, i) => ({
        name: `P${i}`,
        description: "d".repeat(500),
      })),
    };
    const r = buildBrief({ profile: huge, cwd: "/x" }, CODEX_BRIEF_MAX_BYTES);
    expect(r.bytes).toBeLessThanOrEqual(CODEX_BRIEF_MAX_BYTES);
    expect(r.included).toContain("identity");
    expect(r.included).toContain("directives");
    expect([...r.truncated, ...r.dropped].length).toBeGreaterThan(0);
  });

  it("labels fixture data as example", () => {
    expect(buildBrief({ profile, source: "fixture" }).text).toContain("EXAMPLE DATA");
  });
});

describe("sources", () => {
  const home = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "you-brief-"));

  it("falls back to the example fixture", () => {
    expect(resolveProfile({ home, env: {} }).source).toBe("fixture");
  });

  it("prefers ~/.you/you.json and reads skill frontmatter only", () => {
    NodeFS.mkdirSync(NodePath.join(home, ".you"), { recursive: true });
    NodeFS.writeFileSync(NodePath.join(home, ".you", "you.json"), JSON.stringify(profile));
    NodeFS.mkdirSync(NodePath.join(home, ".agent-shared", "skills", "ship"), { recursive: true });
    NodeFS.writeFileSync(
      NodePath.join(home, ".agent-shared", "skills", "ship", "SKILL.md"),
      "---\nname: ship-it\ndescription: Ship You.md releases\n---\nSECRET BODY",
    );
    expect(resolveProfile({ home, env: {} }).source).toBe("local-you");
    expect(listSkills({ home })).toEqual([
      { name: "ship-it", description: "Ship You.md releases" },
    ]);
    const r = getDispatchBrief({
      home,
      env: {},
      cwd: "/w/youmd",
      harness: "Codex",
      maxBytes: 4000,
    });
    expect(r?.text).toContain("ship-it");
    expect(r?.text).not.toContain("SECRET BODY");
  });

  it("can be disabled", () => {
    expect(
      getDispatchBrief({ home, env: { YOU_BRIEF: "off" }, harness: "Codex", maxBytes: 4000 }),
    ).toBeUndefined();
  });
});
