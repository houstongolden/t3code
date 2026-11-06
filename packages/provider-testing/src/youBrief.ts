// Synthetic identity only. Scoped env overrides restored even if an adapter test fails.
// @effect-diagnostics nodeBuiltinImport:off globalJsonInEffect:off
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as Effect from "effect/Effect";

export const withExampleYouBrief = Effect.acquireRelease(
  Effect.sync(() => {
    const previous = { on: process.env.YOU_BRIEF, profile: process.env.YOU_BRIEF_PROFILE };
    const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "you-adapter-example-"));
    const path = NodePath.join(dir, "you.json");
    NodeFS.writeFileSync(
      path,
      JSON.stringify({ username: "example", identity: { name: "Example Adapter Owner" } }),
      { mode: 0o600 },
    );
    process.env.YOU_BRIEF = "on";
    process.env.YOU_BRIEF_PROFILE = path;
    return { previous, dir };
  }),
  ({ previous, dir }) =>
    Effect.sync(() => {
      if (previous.on === undefined) delete process.env.YOU_BRIEF;
      else process.env.YOU_BRIEF = previous.on;
      if (previous.profile === undefined) delete process.env.YOU_BRIEF_PROFILE;
      else process.env.YOU_BRIEF_PROFILE = previous.profile;
      NodeFS.rmSync(dir, { recursive: true, force: true });
    }),
).pipe(Effect.asVoid);
