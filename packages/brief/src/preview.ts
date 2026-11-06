// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { getDispatchBrief } from "./index.ts";
import { buildBrief, CODEX_BRIEF_MAX_BYTES } from "./build.ts";
import { loadSources, type SourceOptions } from "./sources.ts";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Local, static, script-free preview. Actual source snapshot, NOT a last-dispatch receipt or live sync claim. */
export function renderBriefPreview(cwd: string, opts: SourceOptions = {}): string {
  const sources = loadSources(opts);
  const b =
    getDispatchBrief({ ...opts, cwd, harness: "Codex preview", maxBytes: CODEX_BRIEF_MAX_BYTES }) ??
    buildBrief(
      {
        profile: sources.profile,
        cwd,
        harness: "Codex preview",
        source: sources.source,
        skills: sources.skills,
      },
      CODEX_BRIEF_MAX_BYTES,
    );
  const env = opts.env ?? process.env;
  const disabled =
    env.YOU_BRIEF === "off" ||
    env.YOU_BRIEF === "0" ||
    (sources.source === "fixture" && env.YOU_BRIEF !== "example");
  const mark = NodeFS.readFileSync(
    NodeURL.fileURLToPath(new URL("../assets/alien.svg", import.meta.url)),
    "utf8",
  );
  const rows = [
    ["Source", sources.source],
    [
      "Dispatch state",
      disabled ? "Disabled / no configured identity" : "Available for next dispatch",
    ],
    ["Scope", b.activeProject ?? "Personal; no matching project"],
    ["Entry budget", `${b.bytes} / ${CODEX_BRIEF_MAX_BYTES} UTF-8 bytes (Codex)`],
    ["Trust", b.provenance.trust],
    ["Private CLI", b.privateStatus],
    ["Reviewed references eligible", String(b.reviewedMemoryCount)],
    ["Included", b.included.join(", ") || "none"],
    ["Truncated", b.truncated.join(", ") || "none"],
    ["Dropped", b.dropped.join(", ") || "none"],
  ]
    .map(
      ([key, value]) => `<div class="row"><dt>${escape(key!)}</dt><dd>${escape(value!)}</dd></div>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>You · Brief inspector</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#131312;color:#EDEDE6}body{margin:0 auto;max-width:1020px;padding:48px 24px}header{display:flex;align-items:center;gap:14px;border-bottom:1px solid #2A2A26;padding-bottom:26px}header svg{width:40px;height:40px}h1{font-size:26px;letter-spacing:-.04em;margin:0}h2{font-size:17px;font-weight:500;margin-top:36px}p,dt{color:#9A9A90;line-height:1.5}small{font-family:"Geist Mono",monospace;color:#E5482F}dl{margin:26px 0}.row{display:grid;grid-template-columns:170px 1fr;padding:12px 0;border-bottom:1px solid #2A2A26}dd{margin:0;overflow-wrap:anywhere}pre{font-family:"Geist Mono",ui-monospace,monospace;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;background:#181816;padding:22px}footer{color:#9A9A90;font-size:13px;margin-top:30px}@media(max-width:520px){.row{grid-template-columns:1fr;gap:5px}body{padding:24px 18px}}
</style></head><body><header>${mark}<div><small>YOU / MEMORY</small><h1>Brief inspector</h1></div></header><p>Local source snapshot. Preview only, not proof of a sent turn. No network requests, automatic collection or memory promotion.</p><dl>${rows}</dl><h2>${disabled ? "Example preview · not injected" : "Next-dispatch reference preview"}</h2><pre>${escape(b.text)}</pre><footer>Session imports remain separate, untrusted proposals. They do not become directives or enter this brief automatically.</footer></body></html>`;
}

/** Private preview output must never land under a repository. */
export function writeBriefPreview(file: string, cwd: string, opts: SourceOptions = {}): void {
  let parent = NodePath.dirname(NodePath.resolve(file));
  if (!NodeFS.existsSync(parent)) throw new Error("Create an output directory outside git first");
  parent = NodeFS.realpathSync(parent);
  for (let p = parent; ; p = NodePath.dirname(p)) {
    if (NodeFS.existsSync(NodePath.join(p, ".git")))
      throw new Error("Brief previews must stay outside git repositories");
    if (NodePath.dirname(p) === p) break;
  }
  NodeFS.writeFileSync(file, renderBriefPreview(cwd, opts), { mode: 0o600, flag: "wx" });
}
