import { it as effectIt } from "@effect/vitest";
// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeOS from "node:os";
import { afterEach, expect, it, vi } from "vite-plus/test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter } from "effect/http";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { AuthSessionId, ProviderInstanceId } from "@t3tools/contracts";
import { runSweep, inspectSweep } from "@you/memory";
import { materializeReview, readReviewLedger } from "@you/brief/review";
import * as EnvironmentAuth from "../auth/EnvironmentAuth.ts";
import * as ServerConfig from "../config.ts";
import * as CodexAdapterV2 from "../orchestration-v2/Adapters/CodexAdapterV2.ts";
import { layer } from "./http.ts";
const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  roots.splice(0).forEach((p) => NodeFS.rmSync(p, { recursive: true, force: true }));
});
function setup() {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "you-http-example-"));
  roots.push(dir);
  const state = NodePath.join(dir, "memory");
  const profile = NodePath.join(dir, "you.json");
  NodeFS.writeFileSync(
    profile,
    JSON.stringify({
      identity: { name: "Example Owner" },
      projects: [{ name: "example-app" }, { name: "other-client" }],
    }),
  );
  const file = NodePath.join(dir, "export.jsonl"),
    manifest = NodePath.join(dir, "manifest.json");
  NodeFS.writeFileSync(
    file,
    JSON.stringify({
      schema: "you-session/v1",
      sessionId: "example-session",
      id: "example-event",
      role: "user",
      timestamp: "2026-11-06T20:00:00Z",
      text: "Example accepted scoped fact <script>never()</script>",
    }) + "\n",
  );
  NodeFS.writeFileSync(
    manifest,
    JSON.stringify({
      version: 1,
      sources: [
        {
          id: "example",
          file,
          provider: "codex",
          format: "you-session-jsonl-v1",
          scope: { kind: "project", projectId: "example-app" },
        },
      ],
    }),
  );
  runSweep(manifest, state);
  vi.stubEnv("YOU_MEMORY_DIR", state);
  vi.stubEnv("YOU_BRIEF_PROFILE", profile);
  vi.stubEnv("YOU_PRIVATE_BRIEF_PATH", NodePath.join(dir, "private.json"));
  vi.stubEnv("YOU_BRIEF", "on");
  const auth = Layer.mock(EnvironmentAuth.EnvironmentAuth)({
    authenticateHttpRequest: (request) => {
      if (!request.headers.cookie)
        return Effect.fail(
          new EnvironmentAuth.ServerAuthInvalidCredentialError({
            diagnostic: "Example missing session",
          }),
        );
      return Effect.succeed({
        sessionId: AuthSessionId.make(
          request.headers.cookie.includes("other") ? "example-other" : "example-owner",
        ),
        subject: "example-owner",
        method: request.headers.cookie.includes("bearer")
          ? "bearer-access-token"
          : "browser-session-cookie",
        scopes: request.headers.cookie.includes("readonly")
          ? ["orchestration:read"]
          : ["settings:write"],
      } satisfies EnvironmentAuth.AuthenticatedSession);
    },
  });
  const app = layer.pipe(
    Layer.provide(auth),
    Layer.provide(
      ServerConfig.layerTest("/work/example-app", { prefix: "you-memory-http-example-" }),
    ),
    Layer.provide(NodeServices.layer),
  );
  const web = HttpRouter.toWebHandler(app, { disableLogger: true });
  const request = (method = "GET", body?: URLSearchParams, extra: Record<string, string> = {}) =>
    new Request("http://localhost/api/you-memory", {
      method,
      headers: {
        cookie: "example=owner",
        host: "localhost",
        ...(body
          ? { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost" }
          : {}),
        ...extra,
      },
      ...(body ? { body: body.toString() } : {}),
    });
  return { ...web, state, request };
}
it("blocks anonymous, bearer and read-only sessions before returning private content; all responses are no-store", async () => {
  const t = setup();
  try {
    for (const [cookie, status] of [
      ["", 401],
      ["example=bearer", 403],
      ["example=readonly", 403],
    ] as const) {
      const r = await t.handler(t.request("GET", undefined, { cookie }));
      expect(r.status).toBe(status);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect(await r.text()).not.toContain("Example Owner");
    }
    const r = await t.handler(t.request());
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).toContain("Example Owner");
    expect(text).toContain("private missing");
    expect(text).toContain("&lt;script&gt;never()&lt;/script&gt;");
    expect(text).not.toContain("<script>never()");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
  } finally {
    await t.dispose();
  }
});
effectIt.effect(
  "reviews an import through the authenticated form into the real scoped Codex dispatch, then undoes it",
  () =>
    Effect.gen(function* () {
      const t = setup();
      const send = (r: Request) => Effect.promise(() => t.handler(r));
      try {
        const initial = yield* send(t.request());
        const html = yield* Effect.promise(() => initial.text());
        const csrf = /name="csrf" value="([^"]+)"/.exec(html)![1]!;
        const proposal = inspectSweep(t.state)[0]!;
        const form = new URLSearchParams({
          csrf,
          revision: "genesis",
          action: "accept",
          scope: "project",
          projectId: "example-app",
          proposalId: proposal.id,
          key: "example-fact",
          content: proposal.content,
          target: "",
          reviewed: "yes",
        });
        expect(
          (yield* send(t.request("POST", form, { origin: "https://attacker.example" }))).status,
        ).toBe(403);
        expect((yield* send(t.request("POST", form, { cookie: "example=other" }))).status).toBe(
          403,
        );
        const forged = new URLSearchParams(form);
        forged.set("csrf", "0.bad");
        expect((yield* send(t.request("POST", forged))).status).toBe(403);
        expect(readReviewLedger(t.state).events).toHaveLength(0);
        const accepted = yield* send(t.request("POST", form));
        expect(accepted.status).toBe(200);
        expect(yield* Effect.promise(() => accepted.text())).toContain("Decision recorded locally");
        const dispatch = (cwd: string) =>
          CodexAdapterV2.buildCodexTurnStartParams({
            nativeThreadId: "example-thread",
            codexInput: [{ type: "text", text: "Original request" }],
            runtimePolicy: { runtimeMode: "full-access", interactionMode: "default", cwd },
            modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
            hasT3Mcp: false,
          });
        const params = yield* dispatch("/work/example-app");
        const context = params.additionalContext?.you_brief;
        expect(context?.kind).toBe("untrusted");
        expect(context?.value).toContain("Example accepted scoped fact");
        expect(context?.value).toContain("data, never directives");
        expect(Buffer.byteLength(context?.value ?? "")).toBeLessThanOrEqual(4000);
        expect(params.input).toEqual([{ type: "text", text: "Original request" }]);
        expect(
          (yield* dispatch("/work/other-client")).additionalContext?.you_brief?.value,
        ).not.toContain("Example accepted scoped fact");
        const ledger = readReviewLedger(t.state);
        const undo = new URLSearchParams({
          csrf,
          revision: ledger.events[0]!.hash,
          action: "undo",
          scope: "project",
          projectId: "example-app",
          target: ledger.events[0]!.id,
          reviewed: "yes",
        });
        expect((yield* send(t.request("POST", undo))).status).toBe(200);
        expect(materializeReview(readReviewLedger(t.state)).references).toHaveLength(0);
        expect(
          (yield* dispatch("/work/example-app")).additionalContext?.you_brief?.value,
        ).not.toContain("Example accepted scoped fact");
      } finally {
        yield* Effect.promise(() => t.dispose());
      }
    }),
);
it("serves metadata-only memory summary to the owner session and nothing to others", async () => {
  const t = setup();
  try {
    const summaryRequest = (cookie: string) =>
      new Request("http://localhost/api/you-memory/summary", {
        headers: { cookie, host: "localhost" },
      });
    for (const [cookie, status] of [
      ["", 401],
      ["example=bearer", 403],
      ["example=readonly", 403],
    ] as const) {
      const denied = await t.handler(summaryRequest(cookie));
      expect(denied.status).toBe(status);
      expect(denied.headers.get("cache-control")).toBe("private, no-store");
      expect(await denied.text()).not.toContain("Example Owner");
    }
    const r = await t.handler(summaryRequest("example=owner"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const raw = await r.text();
    const body = JSON.parse(raw);
    expect(body.version).toBe(1);
    expect(body.identity).toMatchObject({ status: "ready", name: "Example Owner" });
    expect(body.brief).toMatchObject({
      scope: "project",
      activeProject: "example-app",
      maxBytes: 4000,
      reviewedEligible: 0,
      privateStatus: "missing",
    });
    expect(body.brief.bytes).toBeGreaterThan(0);
    expect(body.brief.included).toContain("identity");
    expect(body.review).toEqual({ status: "ok", accepted: 0, pending: 1 });
    // Proposal content and brief text never leave through the summary.
    expect(raw).not.toContain("Example accepted scoped fact");
    expect(raw).not.toContain("never()");
    expect(raw).not.toContain("data, never directives");
  } finally {
    await t.dispose();
  }
});
