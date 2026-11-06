// @effect-diagnostics nodeBuiltinImport:off
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { normalizeProfile } from "./validate.ts";

export type CliExportRunner = (outputDirectory: string) => void;

/**
 * Opt-in refresh using documented `you export --json -o DIR`. The installed CLI owns its auth;
 * we never open config/key files, pass credentials, or capture private stdout/stderr.
 * Identity-only export, NOT a claim to include the private MCP memory brain.
 */
export function refreshCliProfile(
  home = NodeOS.homedir(),
  run: CliExportRunner = (dir) => {
    NodeChildProcess.execFileSync("you", ["export", "--json", "-o", dir], {
      timeout: 15_000,
      stdio: "ignore",
    });
  },
): string {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "you-profile-export-"));
  try {
    try {
      run(dir);
    } catch {
      throw new Error(
        "You CLI export unavailable. Install the You CLI and run `you login`, then retry refresh-cli.",
      );
    }
    const input = NodePath.join(dir, "you.json");
    if (NodeFS.statSync(input).size > 2_000_000)
      throw new Error("CLI identity export exceeds size limit");
    const profile = normalizeProfile(JSON.parse(NodeFS.readFileSync(input, "utf8")));
    if (!profile) throw new Error("CLI export did not contain a supported identity profile");
    const cache = NodePath.join(home, ".you", "cache");
    NodeFS.mkdirSync(cache, { recursive: true, mode: 0o700 });
    const target = NodePath.join(cache, "cli-you.json");
    const staged = NodePath.join(cache, `cli-you-${process.pid}.tmp`);
    NodeFS.writeFileSync(staged, JSON.stringify(profile), { mode: 0o600, flag: "wx" });
    NodeFS.renameSync(staged, target);
    return target;
  } finally {
    NodeFS.rmSync(dir, { recursive: true, force: true });
  }
}
