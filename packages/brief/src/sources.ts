// Sync, dependency-free reads so a dispatch never waits on Effect services.
// @effect-diagnostics nodeBuiltinImport:off globalFetch:off
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import type { BriefSources, SkillRef, YouProfile } from "./types.ts";

export const FIXTURE_PATH = NodePath.join(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "fixtures",
  "example-you.json",
);

export interface SourceOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly home?: string;
}

const readJson = (path: string): YouProfile | undefined => {
  try {
    return JSON.parse(NodeFS.readFileSync(path, "utf8")) as YouProfile;
  } catch {
    return undefined;
  }
};

/**
 * Resolution order: YOU_BRIEF_PROFILE file, ~/.you/you.json (you CLI / sync output),
 * ~/.you/cache/public-you.json (public profile fetched by `you-brief fetch`), bundled example fixture.
 */
export function resolveProfile(opts: SourceOptions = {}): Omit<BriefSources, "skills"> {
  const env = opts.env ?? process.env;
  const home = opts.home ?? NodeOS.homedir();
  const candidates: Array<[BriefSources["source"], string | undefined]> = [
    ["env-file", env.YOU_BRIEF_PROFILE],
    ["local-you", NodePath.join(home, ".you", "you.json")],
    ["public-cache", NodePath.join(home, ".you", "cache", "public-you.json")],
  ];
  for (const [source, path] of candidates) {
    if (!path || !NodeFS.existsSync(path)) continue;
    const profile = readJson(path);
    if (profile) return { profile, source, sourcePath: path };
  }
  return { profile: readJson(FIXTURE_PATH) ?? {}, source: "fixture", sourcePath: FIXTURE_PATH };
}

const frontmatter = (
  text: string,
): { name?: string | undefined; description?: string | undefined } => {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return {};
  const get = (k: string) =>
    new RegExp(`^${k}:\\s*(.+)$`, "m")
      .exec(m[1]!)?.[1]
      ?.replace(/^["']|["']$/g, "")
      .trim();
  return { name: get("name"), description: get("description") };
};

/** Skill names and descriptions only (never bodies) from ~/.agent-shared/skills and ~/.you/skills. */
export function listSkills(opts: SourceOptions = {}): SkillRef[] {
  const home = opts.home ?? NodeOS.homedir();
  const out: SkillRef[] = [];
  const seen = new Set<string>();
  for (const root of [
    NodePath.join(home, ".agent-shared", "skills"),
    NodePath.join(home, ".you", "skills"),
  ]) {
    let entries: string[] = [];
    try {
      entries = NodeFS.readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries.sort()) {
      const file = NodePath.join(root, entry, "SKILL.md");
      try {
        if (!NodeFS.statSync(file).isFile()) continue;
        const fm = frontmatter(NodeFS.readFileSync(file, "utf8").slice(0, 4096));
        const name = fm.name ?? entry;
        if (seen.has(name)) continue;
        seen.add(name);
        out.push({ name, description: fm.description ?? "" });
      } catch {
        continue;
      }
    }
  }
  return out;
}

export function loadSources(opts: SourceOptions = {}): BriefSources {
  return { ...resolveProfile(opts), skills: listSkills(opts) };
}

/** Fetch the public you.json and cache it for dispatch-time use. Public data only; no auth. */
export async function fetchPublicProfile(
  username: string,
  opts: SourceOptions = {},
): Promise<string> {
  const res = await fetch(`https://you.md/${encodeURIComponent(username)}/you.json`);
  if (!res.ok) throw new Error(`you.md returned ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  delete json._profile; // avatar / ASCII portrait payload, not useful to agents
  const path = NodePath.join(opts.home ?? NodeOS.homedir(), ".you", "cache", "public-you.json");
  NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true });
  NodeFS.writeFileSync(path, JSON.stringify(json, null, 2));
  return path;
}
