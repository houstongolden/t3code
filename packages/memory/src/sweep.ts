// Local, opt-in file imports only. No filesystem discovery, database access, network, or memory promotion.
// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeCrypto from "node:crypto";
import { redactText, truncateUtf8 } from "@you/brief";

export type MemoryScope =
  | { readonly kind: "personal" }
  | { readonly kind: "project"; readonly projectId: string };
export interface SweepSource {
  readonly id: string;
  readonly file: string;
  /** Normalized export files only, NOT provider-native session storage. */
  readonly format: "you-session-jsonl-v1";
  readonly provider: string;
  readonly scope: MemoryScope;
}
export interface SweepManifest {
  readonly version: 1;
  readonly sources: ReadonlyArray<SweepSource>;
}
export interface Evidence {
  readonly sourceId: string;
  readonly provider: string;
  readonly sessionId: string;
  readonly eventId: string;
  readonly line: number;
  readonly timestamp: string;
  readonly redactedBodyHash: string;
}
export interface ProposedMemory {
  readonly id: string;
  readonly content: string;
  readonly contentTruncated: boolean;
  readonly scope: MemoryScope;
  readonly status: "proposed";
  readonly trust: "untrusted-session";
  readonly kind: "quoted-user-observation";
  readonly promotion: "manual-only";
  readonly evidence: Evidence[];
}
interface Checkpoint {
  offset: number;
  lines: number;
  prefixHash: string;
  configHash: string;
}
export interface SweepState {
  version: 1;
  proposals: ProposedMemory[];
  checkpoints: Record<string, Checkpoint>;
}
export interface SweepReport {
  readonly imported: number;
  readonly duplicates: number;
  readonly skipped: number;
  readonly redacted: number;
  readonly resetSources: string[];
  readonly proposed: number;
}
const MAX_BYTES = 5_000_000;
const MAX_STATE = 20_000_000;
const hash = (s: string | Uint8Array): string =>
  NodeCrypto.createHash("sha256").update(s).digest("hex");
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const identifier = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(v) && redactText(v) === v;

/** The manifest is an allowlist and scope declaration; missing/ambiguous scope is rejected. */
export function parseManifest(value: unknown): SweepManifest {
  const m = object(value);
  if (m.version !== 1 || !Array.isArray(m.sources) || m.sources.length > 64)
    throw new Error("Unsupported sweep manifest");
  const seen = new Set<string>();
  const sources: SweepSource[] = m.sources.map((v) => {
    const s = object(v);
    const scope = object(s.scope);
    if (
      !identifier(s.id) ||
      seen.has(s.id) ||
      !identifier(s.provider) ||
      typeof s.file !== "string" ||
      s.format !== "you-session-jsonl-v1"
    )
      throw new Error("Invalid or duplicate sweep source");
    if (scope.kind !== "personal" && !(scope.kind === "project" && identifier(scope.projectId)))
      throw new Error("Each source requires an explicit personal or project scope");
    seen.add(s.id);
    return {
      id: s.id,
      file: s.file,
      provider: s.provider,
      format: "you-session-jsonl-v1",
      scope:
        scope.kind === "personal"
          ? { kind: "personal" }
          : { kind: "project", projectId: scope.projectId as string },
    };
  });
  return { version: 1, sources };
}

/** Output must not enter any git repository (including worktrees), even through a symlink. */
function ensureOutsideGit(path: string): void {
  let current = NodePath.resolve(path);
  while (!NodeFS.existsSync(current)) current = NodePath.dirname(current);
  current = NodeFS.realpathSync(current);
  while (true) {
    if (NodeFS.existsSync(NodePath.join(current, ".git")))
      throw new Error("Sweep state must stay outside git repositories");
    const parent = NodePath.dirname(current);
    if (current === parent) break;
    current = parent;
  }
}

function readInput(file: string): Buffer {
  // Only explicitly supplied exported JSONL files. Never native agent/session/config directories.
  if (
    NodePath.extname(file) !== ".jsonl" ||
    file
      .split(/[\\/]/)
      .some((s) =>
        [
          ".claude",
          ".codex",
          ".cursor",
          ".config",
          ".you",
          ".pi",
          ".grok",
          ".opencode",
          ".local",
          "Library",
          "Application Support",
        ].includes(s),
      )
  )
    throw new Error("Only exported .jsonl inputs outside app-private storage are supported");
  const stat = NodeFS.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES)
    throw new Error("Invalid or oversized sweep input");
  const real = NodeFS.realpathSync(file);
  if (real !== NodePath.resolve(file)) throw new Error("Symlinked sweep inputs are not supported");
  return NodeFS.readFileSync(file);
}

function newState(): SweepState {
  return { version: 1, proposals: [], checkpoints: {} };
}

/** Inspect state explicitly; reference data only. Callers must NOT turn these quotes into directives. */
export function inspectSweep(stateDirectory: string, scope?: MemoryScope): ProposedMemory[] {
  const state = readState(NodePath.join(stateDirectory, "state.json"));
  return state.proposals.filter((p) => !scope || JSON.stringify(p.scope) === JSON.stringify(scope));
}

function readState(file: string): SweepState {
  if (!NodeFS.existsSync(file)) return newState();
  const stat = NodeFS.lstatSync(file);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_STATE)
    throw new Error("Invalid sweep state file");
  const state = JSON.parse(NodeFS.readFileSync(file, "utf8")) as SweepState;
  if (
    state.version !== 1 ||
    !Array.isArray(state.proposals) ||
    typeof state.checkpoints !== "object" ||
    state.checkpoints === null
  )
    throw new Error("Unsupported sweep state");
  // Validate cached content and metadata too; a hand-edited cache cannot bypass redaction or scope checks.
  if (
    state.proposals.some(
      (p) =>
        typeof p.content !== "string" ||
        Buffer.byteLength(p.content) > 4000 ||
        redactText(p.content) !== p.content ||
        typeof p.id !== "string" ||
        !/^[a-f0-9]{64}$/.test(p.id) ||
        !p.scope ||
        !(
          p.scope.kind === "personal" ||
          (p.scope.kind === "project" && identifier(p.scope.projectId))
        ) ||
        !Array.isArray(p.evidence) ||
        p.evidence.some(
          (e) =>
            !identifier(e.sourceId) ||
            !identifier(e.provider) ||
            !identifier(e.sessionId) ||
            !identifier(e.eventId),
        ),
    )
  )
    throw new Error("Invalid proposal content, metadata or scope");
  // Do not trust a hand-modified state to assert promotion or trusted provenance.
  if (
    state.proposals.some(
      (p) =>
        p.status !== "proposed" ||
        p.trust !== "untrusted-session" ||
        p.promotion !== "manual-only" ||
        p.kind !== "quoted-user-observation",
    )
  )
    throw new Error("Invalid proposal trust state");
  return state;
}

/** Transactional append import: proposals + checkpoints share one atomic, mode-0600 state file. */
export function runSweep(manifestFile: string, stateDirectory: string): SweepReport {
  if (NodeFS.statSync(manifestFile).size > 100_000) throw new Error("Manifest exceeds size limit");
  const manifest = parseManifest(JSON.parse(NodeFS.readFileSync(manifestFile, "utf8")));
  ensureOutsideGit(stateDirectory);
  NodeFS.mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const lock = NodePath.join(stateDirectory, ".import.lock");
  const lockFd = NodeFS.openSync(lock, "wx", 0o600);
  const staged = NodePath.join(stateDirectory, `state-${process.pid}.tmp`);
  try {
    const stateFile = NodePath.join(stateDirectory, "state.json");
    const state = readState(stateFile);
    const report = {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      redacted: 0,
      resetSources: [] as string[],
      proposed: 0,
    };
    const proposals = new Map(state.proposals.map((p) => [p.id, p]));
    for (const source of manifest.sources) {
      const input = readInput(NodePath.resolve(NodePath.dirname(manifestFile), source.file));
      const configHash = hash(JSON.stringify(source));
      let checkpoint = Object.hasOwn(state.checkpoints, source.id)
        ? state.checkpoints[source.id]
        : undefined;
      if (
        checkpoint &&
        (checkpoint.configHash !== configHash ||
          !Number.isSafeInteger(checkpoint.offset) ||
          !Number.isSafeInteger(checkpoint.lines) ||
          checkpoint.lines < 0 ||
          checkpoint.offset > input.length ||
          checkpoint.offset < 0 ||
          hash(input.subarray(0, checkpoint.offset)) !== checkpoint.prefixHash)
      ) {
        report.resetSources.push(source.id);
        checkpoint = undefined;
      }
      let offset = checkpoint?.offset ?? 0;
      let line = checkpoint?.lines ?? 0;
      let processed = 0;
      while (offset < input.length) {
        const end = input.indexOf(10, offset);
        if (end === -1) break; // Wait for complete, newline-terminated records.
        if (end - offset > 64_000 || ++processed > 10_000)
          throw new Error(`Source ${source.id} exceeds record limit`);
        let raw: string;
        try {
          raw = new TextDecoder("utf-8", { fatal: true }).decode(input.subarray(offset, end));
        } catch {
          throw new Error(`Invalid UTF-8 in source ${source.id}`);
        }
        offset = end + 1;
        line++;
        if (!raw.trim()) continue;
        let event: Record<string, unknown>;
        try {
          event = object(JSON.parse(raw));
        } catch {
          throw new Error(`Invalid JSON in source ${source.id} at line ${line}`);
        }
        if (
          event.schema !== "you-session/v1" ||
          !identifier(event.id) ||
          !identifier(event.sessionId) ||
          !["user", "assistant", "tool", "system"].includes(String(event.role)) ||
          typeof event.text !== "string" ||
          typeof event.timestamp !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T/.test(event.timestamp) ||
          !Number.isFinite(Date.parse(event.timestamp))
        )
          throw new Error(`Invalid event in source ${source.id} at line ${line}`);
        if (event.role !== "user") {
          report.skipped++;
          continue;
        }
        const redacted = redactText(event.text)
          .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
          .trim();
        if (redacted !== event.text.trim()) report.redacted++;
        if (!redacted || /^\[REDACTED[^\]]*\]$/.test(redacted)) {
          report.skipped++;
          continue;
        }
        const content = truncateUtf8(redacted, 4000); // An inspectable quote, never an inferred fact or instruction.
        const bodyHash = hash(redacted);
        const id = hash(JSON.stringify([source.scope, redacted.replace(/\s+/g, " ")]));
        const evidence: Evidence = {
          sourceId: source.id,
          provider: source.provider,
          sessionId: event.sessionId,
          eventId: event.id,
          line,
          timestamp: event.timestamp,
          redactedBodyHash: bodyHash,
        };
        const existing = proposals.get(id);
        if (existing) {
          report.duplicates++;
          if (
            !existing.evidence.some(
              (e) =>
                e.sourceId === evidence.sourceId &&
                e.sessionId === evidence.sessionId &&
                e.eventId === evidence.eventId &&
                e.redactedBodyHash === bodyHash,
            )
          )
            existing.evidence.push(evidence);
        } else {
          proposals.set(id, {
            id,
            content,
            contentTruncated: content !== redacted,
            scope: source.scope,
            status: "proposed",
            trust: "untrusted-session",
            kind: "quoted-user-observation",
            promotion: "manual-only",
            evidence: [evidence],
          });
          report.imported++;
        }
      }
      state.checkpoints[source.id] = {
        offset,
        lines: line,
        prefixHash: hash(input.subarray(0, offset)),
        configHash,
      };
    }
    state.proposals = [...proposals.values()];
    report.proposed = state.proposals.length;
    const serialized = JSON.stringify(state, null, 2);
    if (Buffer.byteLength(serialized) > MAX_STATE)
      throw new Error("Sweep state exceeds size limit; split the import");
    const fd = NodeFS.openSync(staged, "wx", 0o600);
    try {
      NodeFS.writeFileSync(fd, serialized);
      NodeFS.fsyncSync(fd);
    } finally {
      NodeFS.closeSync(fd);
    }
    NodeFS.renameSync(staged, stateFile);
    return report;
  } finally {
    NodeFS.closeSync(lockFd);
    NodeFS.unlinkSync(lock);
    if (NodeFS.existsSync(staged)) NodeFS.unlinkSync(staged);
  }
}
