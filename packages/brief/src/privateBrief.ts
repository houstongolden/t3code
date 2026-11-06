// @effect-diagnostics globalDate:off
// Wall-clock metadata at the synchronous Node persistence boundary.
// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeCrypto from "node:crypto";
import { redactText } from "./redact.ts";
import { truncateUtf8 } from "./budget.ts";
import type { SourceOptions } from "./sources.ts";

export interface PrivateSnapshot {
  readonly version: 1;
  readonly source: "you-cli-mcp";
  readonly reportedAuthenticated: true;
  readonly generatedAt: string;
  readonly refreshedAt: string;
  readonly personalSummary: string;
  readonly project: {
    readonly cwd: string;
    readonly scopeId: string;
    readonly summary: string;
  } | null;
}
export type PrivateStatus =
  | "missing"
  | "fresh"
  | "stale"
  | "invalid"
  | "cli-unavailable"
  | "auth-required"
  | "error";
export interface PrivateBriefState {
  readonly status: PrivateStatus;
  readonly reportedAuthenticated: boolean;
  readonly source: "none" | "you-cli-mcp-cache";
  readonly ageSeconds: number | null;
  readonly personalSummary: string;
  readonly projectSummary: string;
  readonly projectScope: string | null;
}
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const clean = (v: unknown, bytes: number) =>
  typeof v === "string"
    ? truncateUtf8(redactText(v.replace(/[\u0000-\u001f\u007f]/g, " ")), bytes)
    : "";
export const privateBriefPath = (opts: SourceOptions = {}) =>
  (opts.env ?? process.env).YOU_PRIVATE_BRIEF_PATH ??
  NodePath.join(opts.home ?? NodeOS.homedir(), ".you", "cache", "private-brief.json");

/** Observed CLI fields: generatedAt, user.{summary,authenticated}, environment.cwd; unknown brain bodies are dropped. */
export function normalizePrivateBrief(
  value: unknown,
  cwd: string,
  now = new Date(),
): PrivateSnapshot {
  const v = record(value),
    user = record(v.user),
    environment = record(v.environment),
    p = record(v.project);
  if (user.authenticated !== true) throw new Error("auth-required");
  if (
    typeof v.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(v.generatedAt)) ||
    !clean(user.summary, 2000)
  )
    throw new Error("Unsupported private brief schema");
  const projectAllowed =
    typeof environment.cwd === "string" &&
    NodePath.resolve(environment.cwd) === NodePath.resolve(cwd) &&
    typeof p.scopeId === "string" &&
    redactText(p.scopeId) === p.scopeId &&
    /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(p.scopeId) &&
    clean(p.summary, 1800);
  return {
    version: 1,
    source: "you-cli-mcp",
    reportedAuthenticated: true,
    generatedAt: v.generatedAt,
    refreshedAt: now.toISOString(),
    personalSummary: clean(user.summary, 2000),
    project: projectAllowed
      ? {
          cwd: NodePath.resolve(cwd),
          scopeId: p.scopeId as string,
          summary: clean(p.summary, 1800),
        }
      : null,
  };
}
export function loadPrivateBrief(
  cwd: string | null | undefined,
  opts: SourceOptions = {},
  now = Date.now(),
): PrivateBriefState {
  const empty: PrivateBriefState = {
    status: "missing",
    reportedAuthenticated: false,
    source: "none",
    ageSeconds: null,
    personalSummary: "",
    projectSummary: "",
    projectScope: null,
  };
  const env = opts.env ?? process.env;
  if (env.VITEST && !env.YOU_PRIVATE_BRIEF_PATH) return empty;
  const path = privateBriefPath(opts);
  if (!NodeFS.existsSync(path)) {
    try {
      const status = JSON.parse(NodeFS.readFileSync(path + ".status", "utf8"));
      if (["cli-unavailable", "auth-required", "error"].includes(status.status))
        return { ...empty, status: status.status };
    } catch {
      /* Metadata unavailable. */
    }
    return empty;
  }
  try {
    const stat = NodeFS.lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20_000)
      return { ...empty, status: "invalid" };
    const value = JSON.parse(NodeFS.readFileSync(path, "utf8")) as PrivateSnapshot;
    if ((value as unknown as Record<string, unknown>).invalidated) {
      try {
        const status = JSON.parse(NodeFS.readFileSync(path + ".status", "utf8"));
        if (["cli-unavailable", "auth-required", "error"].includes(status.status))
          return { ...empty, status: status.status };
      } catch {
        /* No private body fallback. */
      }
      return { ...empty, status: "invalid" };
    }
    if (
      value.version !== 1 ||
      value.source !== "you-cli-mcp" ||
      value.reportedAuthenticated !== true ||
      typeof value.personalSummary !== "string" ||
      typeof value.generatedAt !== "string" ||
      typeof value.refreshedAt !== "string"
    )
      return { ...empty, status: "invalid" };
    const generatedAge = now - Date.parse(value.generatedAt),
      refreshedAge = now - Date.parse(value.refreshedAt);
    if (
      !Number.isFinite(generatedAge) ||
      !Number.isFinite(refreshedAge) ||
      generatedAge < -300_000 ||
      refreshedAge < -300_000
    )
      return { ...empty, status: "invalid" };
    const age = Math.max(generatedAge, refreshedAge);
    if (!Number.isFinite(age) || age < -300_000) return { ...empty, status: "invalid" };
    if (age > 30 * 60_000)
      return {
        ...empty,
        status: "stale",
        source: "you-cli-mcp-cache",
        reportedAuthenticated: true,
        ageSeconds: Math.floor(age / 1000),
      };
    const p = value.project;
    const sameProject =
      p && cwd && typeof p.cwd === "string" && NodePath.resolve(cwd) === NodePath.resolve(p.cwd);
    return {
      status: "fresh",
      source: "you-cli-mcp-cache",
      reportedAuthenticated: true,
      ageSeconds: Math.max(0, Math.floor(age / 1000)),
      personalSummary: clean(value.personalSummary, 2000),
      projectSummary: sameProject ? clean(p.summary, 1800) : "",
      projectScope: sameProject && typeof p.scopeId === "string" ? clean(p.scopeId, 128) : null,
    };
  } catch {
    return { ...empty, status: "invalid" };
  }
}

function writePrivateFile(path: string, value: unknown): void {
  let parent = NodePath.dirname(NodePath.resolve(path));
  while (!NodeFS.existsSync(parent)) parent = NodePath.dirname(parent);
  parent = NodeFS.realpathSync(parent);
  for (let p = parent; ; p = NodePath.dirname(p)) {
    if (NodeFS.existsSync(NodePath.join(p, ".git")))
      throw new Error("Private brief caches must stay outside git");
    if (p === NodePath.dirname(p)) break;
  }
  NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true, mode: 0o700 });
  const temp = path + "." + NodeCrypto.randomUUID() + ".tmp";
  NodeFS.writeFileSync(temp, JSON.stringify(value), { mode: 0o600, flag: "wx" });
  NodeFS.renameSync(temp, path);
}
export async function refreshPrivateBrief(
  cwd: string,
  opts: SourceOptions = {},
  transport?: (cwd: string) => Promise<unknown>,
): Promise<PrivateStatus> {
  const path = privateBriefPath(opts);
  try {
    const run = transport ?? (await import("./privateMcp.ts")).readCliPrivateBrief;
    const snapshot = normalizePrivateBrief(await run(cwd), cwd);
    writePrivateFile(path, snapshot);
    writePrivateFile(path + ".status", { status: "fresh", attemptedAt: new Date().toISOString() });
    return "fresh";
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status: PrivateStatus =
      message === "cli-unavailable"
        ? "cli-unavailable"
        : message === "auth-required"
          ? "auth-required"
          : "error";
    // Invalidated auth must not leave a previously fresh private cache dispatchable.
    if (NodeFS.existsSync(path)) {
      try {
        writePrivateFile(path, { version: 1, invalidated: true });
      } catch {
        /* Never overwrite a repository path. */
      }
    }
    try {
      writePrivateFile(path + ".status", { status, attemptedAt: new Date().toISOString() });
    } catch {
      /* Surface status without logging private errors. */
    }
    return status;
  }
}
