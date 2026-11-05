// @effect-diagnostics nodeBuiltinImport:off globalConsole:off
import * as NodePath from "node:path";

import { byteLength, packSections, truncateUtf8, type Section } from "./budget.ts";
import type { BriefInput, BriefResult, SkillRef, YouProfile, YouProject } from "./types.ts";

/** Codex counts additionalContext values as bytes/4 and silently truncates over 1,000 tokens. */
export const CODEX_BRIEF_MAX_BYTES = 4_000;
/** Claude takes an appended system prompt; keep it compact so it never crowds the task. */
export const CLAUDE_BRIEF_MAX_BYTES = 8_000;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Match the dispatch cwd to a profile project by explicit paths, then by name against path segments. */
export function detectActiveProject(
  profile: YouProfile,
  cwd?: string | null,
): YouProject | undefined {
  if (!cwd) return undefined;
  const segments = cwd
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(norm);
  const projects = profile.projects ?? [];
  const byPath = projects.find((p) => (p.paths ?? []).some((frag) => cwd.includes(frag)));
  if (byPath) return byPath;
  const leaf = norm(NodePath.basename(cwd));
  const exact = projects.find((p) => norm(p.name) === leaf);
  if (exact) return exact;
  return projects.find((p) => {
    const n = norm(p.name);
    return (
      n.length >= 3 &&
      segments.some(
        (seg) => seg === n || seg.startsWith(n) || (n.startsWith(seg) && seg.length >= 4),
      )
    );
  });
}

/** Rank skills by keyword overlap with the active project and harness; ties keep source order. */
export function rankSkills(
  skills: ReadonlyArray<SkillRef>,
  hints: ReadonlyArray<string>,
  limit = 8,
): SkillRef[] {
  const words = new Set(
    hints.flatMap((h) => h.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length >= 3),
  );
  const score = (s: SkillRef) =>
    `${s.name} ${s.description}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => words.has(w)).length;
  return skills
    .map((s, i) => ({ s, i, score: score(s) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.s);
}

const one = (s: string | undefined, max = 280) =>
  s ? truncateUtf8(s.replace(/\s+/g, " ").trim(), max) : "";

export function buildSections(input: BriefInput): {
  sections: Section[];
  active: YouProject | undefined;
} {
  const p = input.profile;
  const d = p.agent_directives ?? {};
  const active = detectActiveProject(p, input.cwd);
  const name = p.identity?.name ?? p.username ?? "the user";

  const identity = [
    `${name}${p.username ? ` (@${p.username})` : ""}${p.identity?.location ? `, ${p.identity.location}` : ""}.`,
    one(p.identity?.tagline ?? p.identity?.bio?.short ?? p.identity?.bio?.medium, 360),
  ].filter(Boolean);

  const directives = [
    d.communication_style ? `Style: ${one(d.communication_style, 240)}` : "",
    ...(d.negative_prompts ?? []).slice(0, 8).map((n) => `- ${one(n, 140)}`),
    d.decision_framework ? `Decisions: ${one(d.decision_framework, 200)}` : "",
    d.default_stack ? `Default stack: ${one(d.default_stack, 120)}` : "",
  ].filter(Boolean);

  const goalLines: string[] = [];
  if (d.current_goal) goalLines.push(`- ${one(d.current_goal, 240)}`);
  const goals = p.goals ?? [];
  const rank = (lvl: string) => (lvl === "project" ? 0 : lvl === "personal" ? 1 : 2);
  for (const g of [...goals].sort((a, b) => rank(a.level) - rank(b.level))) {
    if (g.level === "project" && active && g.project && norm(g.project) !== norm(active.name))
      continue;
    goalLines.push(`- [${g.level}${g.project ? `:${g.project}` : ""}] ${one(g.title, 180)}`);
  }

  const project = active
    ? [
        `${active.name}${active.status ? ` (${one(active.status, 80)})` : ""}: ${one(active.description, 300)}`,
        active.northStar ? `North Star: ${one(active.northStar, 200)}` : "",
        active.url ? `URL: ${active.url}` : "",
      ].filter(Boolean)
    : input.cwd
      ? [
          `No profile project matches ${NodePath.basename(input.cwd)}. Ask before assuming which venture this is.`,
        ]
      : [];

  const focus = (p.now?.focus ?? []).map((f) => `- ${one(f, 160)}`);
  const others = (p.projects ?? [])
    .filter((x) => x !== active)
    .map((x) => `- ${x.name}${x.status ? ` (${one(x.status, 60)})` : ""}`);

  const skills = rankSkills(input.skills ?? [], [
    active?.name ?? "",
    active?.description ?? "",
    input.harness ?? "",
  ]).map((s) => `- ${s.name}: ${one(s.description, 120)}`);

  return {
    active,
    sections: [
      { id: "identity", priority: 0, heading: "Who you work for", lines: identity },
      {
        id: "directives",
        priority: 1,
        heading: "How they want you to work",
        lines: directives,
        minLines: 1,
      },
      { id: "project", priority: 2, heading: "Active project", lines: project },
      { id: "goals", priority: 3, heading: "Current goals", lines: goalLines },
      { id: "skills", priority: 4, heading: "Relevant skills", lines: skills },
      { id: "now", priority: 5, heading: "Now", lines: focus },
      { id: "projects", priority: 6, heading: "Other projects", lines: others },
    ],
  };
}

/** Build a byte-capped brief. Output never exceeds maxBytes. */
export function buildBrief(
  input: BriefInput,
  maxBytes: number = CODEX_BRIEF_MAX_BYTES,
): BriefResult {
  const { sections, active } = buildSections(input);
  const example = input.source === "fixture" ? " EXAMPLE DATA, not the real user." : "";
  const header = `# You brief (you.md)${example}\nContext about the human you are working for. Follow it unless the task says otherwise; do not repeat it back.`;
  const packed = packSections(header, sections, maxBytes);
  const text = truncateUtf8(packed.text, maxBytes);
  return {
    text,
    bytes: byteLength(text),
    included: packed.included,
    truncated: packed.truncated,
    dropped: packed.dropped,
    ...(active ? { activeProject: active.name } : {}),
  };
}
