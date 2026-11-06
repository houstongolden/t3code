import { writeBriefPreview } from "./preview.ts";
import { refreshCliProfile } from "./cliProfile.ts";
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off
// Usage: node src/cli.ts [print [cwd] [--codex|--claude]] | fetch <username>
import { buildBrief, CLAUDE_BRIEF_MAX_BYTES, CODEX_BRIEF_MAX_BYTES } from "./build.ts";
import { fetchPublicProfile, loadSources } from "./sources.ts";

const [cmd = "print", ...rest] = process.argv.slice(2);
if (cmd === "preview-ui") {
  const file = rest[0];
  if (!file) throw new Error("Usage: preview-ui OUTPUT.html [cwd]");
  writeBriefPreview(file, rest[1] ?? process.cwd());
  console.log("Created private local brief preview. Not a dispatch receipt.");
} else if (cmd === "refresh-cli") {
  refreshCliProfile();
  console.log("Refreshed CLI identity cache (no secrets read; private memories not imported).");
} else if (cmd === "fetch") {
  const user = rest[0] ?? "houstongolden";
  console.log(`cached public profile: ${await fetchPublicProfile(user)}`);
} else {
  const cwd = rest.find((a) => !a.startsWith("--")) ?? process.cwd();
  const max = rest.includes("--claude") ? CLAUDE_BRIEF_MAX_BYTES : CODEX_BRIEF_MAX_BYTES;
  const s = loadSources();
  const r = buildBrief(
    { profile: s.profile, cwd, harness: "cli", skills: s.skills, source: s.source },
    max,
  );
  console.log(r.text);
  console.error(
    `\n[source=${s.source} bytes=${r.bytes}/${max} project=${r.activeProject ?? "-"} included=${r.included.join(",")} truncated=${r.truncated.join(",") || "-"} dropped=${r.dropped.join(",") || "-"}]`,
  );
}
