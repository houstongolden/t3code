// @effect-diagnostics nodeBuiltinImport:off globalConsole:off
import { inspectSweep, runSweep } from "./sweep.ts";

const [command, manifestOrState, output, ...flags] = process.argv.slice(2);
if (command === "import" && manifestOrState && output) {
  console.log(JSON.stringify(runSweep(manifestOrState, output), null, 2));
} else if (command === "inspect" && manifestOrState) {
  const proposals = inspectSweep(manifestOrState);
  console.log(
    JSON.stringify(
      proposals.map((p) => ({
        id: p.id,
        scope: p.scope,
        status: p.status,
        trust: p.trust,
        evidenceCount: p.evidence.length,
        ...([output, ...flags].includes("--show-content")
          ? { content: p.content, evidence: p.evidence }
          : {}),
      })),
      null,
      2,
    ),
  );
} else {
  console.error(
    "Usage: node packages/memory/src/cli.ts import MANIFEST.json STATE_DIR\n       node packages/memory/src/cli.ts inspect STATE_DIR [--show-content]\nState must be outside git. Only explicit normalized session exports; no automatic promotion.",
  );
  process.exitCode = 1;
}
