// @effect-diagnostics nodeBuiltinImport:off
import * as NodeCrypto from "node:crypto";
import { AuthSettingsWriteScope } from "@t3tools/contracts";
import { getDispatchBrief } from "@you/brief";
import { loadPrivateBrief, refreshPrivateBrief } from "@you/brief/private";
import {
  materializeReview,
  readReviewLedger,
  reviewDirectory,
  reviewRevision,
} from "@you/brief/review";
import { inspectSweep } from "@you/memory";
import { reviewProposal, type ReviewInput } from "@you/memory/review";
import * as ByteSize from "effect/ByteSize";
import * as DateTime from "effect/DateTime";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as EnvironmentAuth from "../auth/EnvironmentAuth.ts";
import * as ServerConfig from "../config.ts";
import { buildMemorySummary, SUMMARY_PATH } from "./summary.ts";

const PATH = "/api/you-memory";
const headers = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'self'; base-uri 'none'",
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(DateTime.toDateUtc(DateTime.makeUnsafe(value)));
const field = (name: string, value: string) =>
  `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`;
const response = (text: string, status = 200) =>
  HttpServerResponse.text(text, { status, headers, contentType: "text/html; charset=utf-8" });
const style = `:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;padding:24px;background:#0E0E0D;color:#EDEDE6;font:14px Inter,system-ui,sans-serif;line-height:1.5}h1{font-size:24px;font-weight:500;margin:0}h2{font-size:16px;font-weight:500;margin:24px 0 10px}.mono,pre,small{font-family:'Geist Mono',monospace}small{color:#A5A59D;font-size:11px}section,article{border-top:1px solid #33332F;padding:18px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}label{display:block;margin:8px 0}textarea,input[type=text]{font:inherit;color:inherit;background:transparent;border:0;border-bottom:1px solid #55554E;padding:8px;width:100%;outline:none}label:focus-within{color:#E5482F}textarea{min-height:80px;resize:vertical}button{font:inherit;cursor:pointer;border:0;border-bottom:1px solid #E5482F;color:#EDEDE6;background:transparent;padding:8px 2px;margin-right:20px}button:focus-visible{outline:2px solid #E5482F}p{margin:8px 0}.status{color:#E5482F}.row{display:flex;gap:16px;align-items:center;flex-wrap:wrap}`;

/** Session-bound CSRF, no credential embedded; GET never invokes the CLI or changes review state. */
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const router = yield* HttpRouter.HttpRouter;
    const auth = yield* EnvironmentAuth.EnvironmentAuth;
    const config = yield* ServerConfig.ServerConfig;
    const secret = NodeCrypto.randomBytes(32);
    const sign = (sessionId: string, expires: string) =>
      NodeCrypto.createHmac("sha256", secret)
        .update(JSON.stringify([sessionId, expires]))
        .digest("hex");
    // Owner browser session only: bearer tokens and read-only scopes never see memory state.
    const authorize = (request: HttpServerRequest.HttpServerRequest) =>
      auth.authenticateHttpRequest(request).pipe(
        Effect.map((session) =>
          session.method === "browser-session-cookie" &&
          session.scopes.includes(AuthSettingsWriteScope)
            ? ({ ok: true, session } as const)
            : ({ ok: false, status: 403 } as const),
        ),
        Effect.orElseSucceed(() => ({ ok: false, status: 401 }) as const),
      );
    const summary = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const access = yield* authorize(request);
      const json = (body: unknown, status = 200) =>
        HttpServerResponse.text(JSON.stringify(body), {
          status,
          headers,
          contentType: "application/json; charset=utf-8",
        });
      if (!access.ok)
        return json(
          { error: access.status === 401 ? "unauthenticated" : "forbidden" },
          access.status,
        );
      return yield* Effect.try(() => json(buildMemorySummary(config.cwd))).pipe(
        Effect.orElseSucceed(() => json({ error: "unavailable" }, 503)),
      );
    }).pipe(Effect.withTracerEnabled(false));
    const handle = Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const access = yield* authorize(request);
      if (!access.ok)
        return access.status === 401
          ? response("Browser authentication required.", 401)
          : response("Owner browser session with settings:write required.", 403);
      const session = access.session;
      const now = yield* Clock.currentTimeMillis;
      const directory = reviewDirectory();
      let message = "";
      if (request.method === "POST") {
        const origin = request.headers.origin;
        const allowed = new Set<string>();
        const host = request.headers.host;
        if (host) {
          allowed.add(`http://${host}`);
          allowed.add(`https://${host}`);
        }
        if (config.devUrl) allowed.add(config.devUrl.origin);
        if (!origin || !allowed.has(origin) || request.headers["sec-fetch-site"] === "cross-site")
          return response("Cross-origin review rejected.", 403);
        if (!request.headers["content-type"]?.startsWith("application/x-www-form-urlencoded"))
          return response("Form required.", 415);
        const body = yield* request.text.pipe(
          Effect.provideService(HttpServerRequest.MaxBodySize, ByteSize.bytes(32_000)),
          Effect.orElseSucceed(() => null),
        );
        if (body === null || Buffer.byteLength(body) > 32_000)
          return response("Form too large.", 413);
        const form = new URLSearchParams(body);
        const [expiry, signature, ...extra] = (form.get("csrf") ?? "").split(".");
        const expected = sign(session.sessionId, expiry ?? "");
        if (
          extra.length ||
          !expiry ||
          !signature ||
          Number(expiry) < now ||
          Number(expiry) > now + 15 * 60_000 ||
          !/^\d+$/.test(expiry) ||
          !/^[a-f0-9]{64}$/.test(signature) ||
          !NodeCrypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
        )
          return response("Invalid or expired review confirmation; reload.", 403);
        if (form.get("action") === "refresh-private") {
          const status = yield* Effect.promise(() => refreshPrivateBrief(config.cwd));
          message = `Private CLI refresh: ${status}. No credential was read or transferred by the server.`;
        } else {
          const action = form.get("action");
          if (
            action !== "accept" &&
            action !== "reject" &&
            action !== "correct" &&
            action !== "undo"
          )
            return response("Invalid decision.", 400);
          const scope =
            form.get("scope") === "personal"
              ? { kind: "personal" as const }
              : { kind: "project" as const, projectId: form.get("projectId") ?? "" };
          const input: ReviewInput = {
            action,
            scope,
            expectedRevision: form.get("revision") ?? "",
            proposalId: form.get("proposalId") ?? "",
            key: form.get("key") ?? "",
            content: form.get("content") ?? "",
            target: form.get("target") ?? "",
            reviewed: form.get("reviewed") === "yes",
          };
          const actor =
            "browser-" +
            NodeCrypto.createHash("sha256").update(session.subject).digest("hex").slice(0, 24);
          const ok = yield* Effect.try(() => reviewProposal(directory, input, actor)).pipe(
            Effect.as(true),
            Effect.orElseSucceed(() => false),
          );
          if (!ok)
            return response(
              "Review not confirmed. Reload to inspect the current revision; check scope, key conflict, correction target and explicit confirmation.",
              409,
            );
          message = "Decision recorded locally. Reference data only; undo is available below.";
        }
      }
      return yield* Effect.try(() => {
        const ledger = readReviewLedger(directory);
        const state = materializeReview(ledger);
        const revision = reviewRevision(ledger);
        const csrf = `${now + 10 * 60_000}.${sign(session.sessionId, String(now + 10 * 60_000))}`;
        const common = field("csrf", csrf) + field("revision", revision);
        const scopeFields = (scope: ReviewInput["scope"]) =>
          field("scope", scope.kind) +
          field("projectId", scope.kind === "project" ? scope.projectId : "");
        const privateState = loadPrivateBrief(config.cwd);
        const brief = getDispatchBrief({ cwd: config.cwd, harness: "Codex", maxBytes: 4000 });
        const proposals = inspectSweep(directory);
        const rows = proposals
          .slice(0, 100)
          .map((p) => {
            const decision = state.decisions.get(p.id);
            const acceptedReference = state.references.find((r) => r.proposalId === p.id);
            return `<article><small>${escape(p.scope.kind === "personal" ? "PERSONAL" : `PROJECT · ${p.scope.projectId}`)} · ${escape(decision?.status ?? "proposed · not accepted")}</small><pre>${escape(p.content)}</pre><small>${p.evidence.map((e) => escape(`${e.provider}/${e.sourceId} · ${e.sessionId}/${e.eventId} · line ${e.line} · ${formatTime(e.timestamp)} · sha256:${e.redactedBodyHash}`)).join("<br>")}</small>${decision?.status === "rejected" ? "" : `<form method="post" action="${PATH}">${common}${scopeFields(p.scope)}${field("proposalId", p.id)}<label>Memory key <input type="text" name="key" value="${escape(acceptedReference?.key ?? `memory-${p.id.slice(0, 20)}`)}" required maxlength="128"></label><label>Reviewed reference <textarea name="content" maxlength="4000">${escape(acceptedReference?.content ?? p.content)}</textarea></label><label>Correction target ID (only to replace an accepted key)<input type="text" name="target" value="${escape(acceptedReference?.id ?? "")}"></label><label><input type="checkbox" name="reviewed" value="yes" required> I reviewed the content and unchanged destination scope. This is reference data, not an instruction.</label>${acceptedReference ? "" : `<button name="action" value="accept">Accept reference</button><button name="action" value="reject">Reject</button>`}<button name="action" value="correct">Correct existing key</button></form>`}</article>`;
          })
          .join("");
        const stack = ledger.events.reduce<(typeof ledger.events)[number][]>((s, e) => {
          if (e.action === "undo") s.pop();
          else s.push(e);
          return s;
        }, []);
        const last = stack.at(-1);
        const undo = last
          ? `<form method="post" action="${PATH}">${common}${scopeFields(last.scope)}${field("target", last.id)}${field("action", "undo")}<label><input type="checkbox" name="reviewed" value="yes" required> Undo latest active decision ${escape(last.id)} (${escape(last.action)})</label><button>Undo locally</button></form>`
          : "No active decisions.";
        return response(
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>You · Memory</title><style>${style}</style><body><h1>Memory you own.</h1><p>Review what agents carry forward. Imported sessions are untrusted quotes, never directives.</p><p class="status">${escape(message)}</p><section><h2>Brief & sources</h2><p class="mono">${escape(brief?.provenance.source ?? "no identity source")} · private ${privateState.status} · ${brief?.bytes ?? 0}/4000 UTF-8 bytes</p><small>Private auth: ${privateState.reportedAuthenticated ? "reported by cached CLI response, not a live auth check" : "not authenticated on this runtime"}. Cache source: ${privateState.source}; age: ${privateState.ageSeconds ?? "unknown"}s. Project: ${escape(brief?.activeProject ?? "none matched")}. ${brief?.reviewedMemoryCount ?? 0} scoped reviewed references eligible; budget may truncate/drop. This preview is not a receipt of a live provider call.</small><pre>${escape(brief?.text ?? "No brief available. Configure a local identity or public profile cache.")}</pre><form method="post" action="${PATH}">${common}${field("action", "refresh-private")}<button>Refresh from installed You CLI</button></form></section><section><h2>Accepted references · ${state.references.length}</h2>${state.references.map((r) => `<p><small>${escape(r.key)} · ${escape(r.scope.kind === "personal" ? "personal" : r.scope.projectId)} · ${escape(r.id)}</small><br>${escape(r.content)}</p>`).join("") || "Nothing accepted."}</section><section><h2>Proposals · ${proposals.length}</h2><small>First 100 shown. Imports require an explicit you-session/v1 manifest; no app storage is scanned. Correction requires the accepted reference's exact key and target ID above, in the same scope.</small>${rows || "No imported proposals."}</section><section><h2>Reversible audit · ${ledger.events.length} events</h2>${undo}<pre>${ledger.events
            .slice(-20)
            .map((e) =>
              escape(
                `${formatTime(e.at)} · ${e.actor} · ${e.action} · ${e.proposalId} · ${e.hash}`,
              ),
            )
            .join("\n")}</pre></section></body></html>`,
        );
      }).pipe(
        Effect.orElseSucceed(() =>
          response(
            "Memory state unavailable or invalid. No data was changed; inspect local source/ledger configuration.",
            503,
          ),
        ),
      );
    }).pipe(Effect.withTracerEnabled(false));
    yield* router.add("GET", SUMMARY_PATH, summary);
    yield* router.add("GET", PATH, handle);
    yield* router.add("POST", PATH, handle);
  }),
);
