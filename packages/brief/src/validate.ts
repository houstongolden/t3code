import { redactText } from "./redact.ts";
import type { YouProfile, YouProject, YouGoal } from "./types.ts";

const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown): string =>
  typeof v === "string" ? redactText(v.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 2048)) : "";
const strings = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .slice(0, 100)
        .filter((x) => typeof x === "string")
        .map(text)
    : [];

/** Explicit identity allowlist: never ingest custom_files, memory/session bodies, credentials or unknown fields. */
export function normalizeProfile(value: unknown): YouProfile | undefined {
  const v = record(value);
  const id = record(v.identity);
  const d = record(v.agent_directives);
  const bio = record(id.bio);
  if (!text(v.username) && !text(id.name)) return undefined;
  const projects: YouProject[] = Array.isArray(v.projects)
    ? v.projects.slice(0, 100).flatMap((x) => {
        const p = record(x);
        if (!text(p.name)) return [];
        return [
          {
            name: text(p.name),
            memoryScope: text(p.memoryScope),
            description: text(p.description),
            status: text(p.status),
            northStar: text(p.northStar),
            url: text(p.url),
            paths: strings(p.paths),
          },
        ];
      })
    : [];
  const goals: YouGoal[] = Array.isArray(v.goals)
    ? v.goals.slice(0, 100).flatMap((x) => {
        const g = record(x);
        if (!text(g.title) || !["personal", "project", "global"].includes(String(g.level)))
          return [];
        // Project goals MUST name their project; otherwise they leak across workspaces.
        if (g.level === "project" && !text(g.project)) return [];
        return [
          {
            title: text(g.title),
            level: g.level as YouGoal["level"],
            project: text(g.project),
            status: text(g.status),
          },
        ];
      })
    : [];
  return {
    username: text(v.username),
    identity: {
      name: text(id.name),
      location: text(id.location),
      tagline: text(id.tagline),
      bio: { short: text(bio.short), medium: text(bio.medium) },
    },
    agent_directives: {
      communication_style: text(d.communication_style),
      current_goal: text(d.current_goal),
      decision_framework: text(d.decision_framework),
      default_stack: text(d.default_stack),
      negative_prompts: strings(d.negative_prompts),
    },
    now: { focus: strings(record(v.now).focus), updated_at: text(record(v.now).updated_at) },
    projects,
    goals,
  };
}
