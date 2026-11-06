// @effect-diagnostics nodeBuiltinImport:off globalConsole:off
import * as NodeFS from "node:fs";
import { reviewProposal, type ReviewInput } from "./review.ts";
import { inspectSweep, runSweep } from "./sweep.ts";

const [command, manifestOrState, output, ...flags] = process.argv.slice(2);
if (command === "review" && manifestOrState && output) {
  try {
    const decision = JSON.parse(NodeFS.readFileSync(output, "utf8")) as ReviewInput;
    console.log(JSON.stringify(reviewProposal(manifestOrState, decision, "local-owner")));
  } catch {
    console.error(
      "Review not applied. Check explicit decision, scope, revision and correction target.",
    );
    process.exitCode = 1;
  }
} else if (command === "import" && manifestOrState && output) {
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
    "Usage: node packages/memory/src/cli.ts import MANIFEST.json STATE_DIR\n       node packages/memory/src/cli.ts inspect STATE_DIR [--show-content]\n       node packages/memory/src/cli.ts review STATE_DIR EXPLICIT_DECISION.json\nState must be outside git. Only explicit normalized session exports; no automatic promotion.",
  );
  process.exitCode = 1;
}
