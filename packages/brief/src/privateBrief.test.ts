// @effect-diagnostics nodeBuiltinImport:off globalDate:off
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeOS from "node:os";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { loadPrivateBrief, normalizePrivateBrief, refreshPrivateBrief } from "./privateBrief.ts";
import { readCliPrivateBrief } from "./privateMcp.ts";
const roots: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  for (const p of roots.splice(0)) NodeFS.rmSync(p, { recursive: true, force: true });
});
const setup = () => {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "you-private-example-"));
  roots.push(dir);
  return { dir, opts: { env: { YOU_PRIVATE_BRIEF_PATH: NodePath.join(dir, "private.json") } } };
};
const EPOCH = Date.parse("2026-11-06T20:00:00Z");
const raw = () => ({
  generatedAt: new Date(EPOCH).toISOString(),
  user: {
    authenticated: true,
    summary: "Example personal summary",
    bundleDir: "DO_NOT_COPY",
    agent_directives: "DO_NOT_COPY",
  },
  project: { scopeId: "example-app", summary: "Example project reference" },
  environment: { cwd: "/work/example-app", mcpVersion: "example" },
  portfolioGraph: { private: "DO_NOT_COPY" },
  nextMoves: ["DO_NOT_COPY"],
  memories: ["DO_NOT_COPY"],
});
it("allowlists observed structured CLI summary, separates exact project binding and discards unknown private bodies", () => {
  const snapshot = normalizePrivateBrief(raw(), "/work/example-app");
  expect(snapshot.personalSummary).toBe("Example personal summary");
  expect(snapshot.project?.scopeId).toBe("example-app");
  expect(JSON.stringify(snapshot)).not.toContain("DO_NOT_COPY");
  expect(normalizePrivateBrief(raw(), "/work/example-app-extra").project).toBeNull();
  expect(() =>
    normalizePrivateBrief(
      { ...raw(), user: { authenticated: false, summary: "example" } },
      "/work/example-app",
    ),
  ).toThrow("auth-required");
  const actualObservedShape = {
    ...raw(),
    project: null,
    skills: { installed: [], recommended: [] },
  };
  expect(normalizePrivateBrief(actualObservedShape, "/work/example-app").project).toBeNull();
});
it("refreshes only through an explicit transport; enforces private cache modes, project scope and freshness", async () => {
  vi.setSystemTime(EPOCH);
  const { dir, opts } = setup();
  expect(loadPrivateBrief("/work/example-app", opts).status).toBe("missing");
  expect(await refreshPrivateBrief("/work/example-app", opts, async () => raw())).toBe("fresh");
  expect(NodeFS.statSync(NodePath.join(dir, "private.json")).mode & 0o777).toBe(0o600);
  expect(loadPrivateBrief("/work/example-app", opts).projectSummary).toBe(
    "Example project reference",
  );
  const other = loadPrivateBrief("/work/other-client", opts);
  expect(other.personalSummary).toBe("Example personal summary");
  expect(other.projectSummary).toBe("");
  const stale = loadPrivateBrief("/work/example-app", opts, EPOCH + 31 * 60_000);
  expect(stale.status).toBe("stale");
  expect(stale.personalSummary).toBe("");
});
it("redacts values and fails closed after auth loss without retaining dispatchable stale private text", async () => {
  vi.setSystemTime(EPOCH);
  const { opts } = setup();
  await refreshPrivateBrief("/work/example-app", opts, async () => ({
    ...raw(),
    user: { authenticated: true, summary: "Example api_key=syntheticSecretValue" },
  }));
  expect(loadPrivateBrief("/work/example-app", opts).personalSummary).not.toContain(
    "syntheticSecretValue",
  );
  expect(
    await refreshPrivateBrief("/work/example-app", opts, async () => ({
      ...raw(),
      user: { authenticated: false },
    })),
  ).toBe("auth-required");
  expect(loadPrivateBrief("/work/example-app", opts).personalSummary).toBe("");
});
it("runs the supported stdio initialize/list/call contract using only synthetic subprocess output, preserving split UTF-8", async () => {
  const { dir } = setup();
  const tool = NodePath.join(dir, "you");
  NodeFS.writeFileSync(
    tool,
    `#!/usr/bin/env node
const readline=require('node:readline');
if(process.argv[2]!=='mcp')process.exit(3);
process.stdout.write('null\\n42\\n{}\\n');
readline.createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);if(!m.id)return;
 let result={};if(m.method==='tools/list')result={tools:[{name:'get_agent_brief'}]};
 if(m.method==='tools/call'){
  if(m.params.arguments.format!=='json'||m.params.arguments.includeMemories!==true)process.exit(4);
  result={content:[{type:'text',text:JSON.stringify({generatedAt:new Date().toISOString(),user:{authenticated:true,summary:'Example 東京🚀'},project:null,environment:{cwd:process.cwd()}})}]};
 }
 const b=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n');for(let i=0;i<b.length;i+=2)process.stdout.write(b.subarray(i,i+2));
});`,
    { mode: 0o700 },
  );
  vi.stubEnv("PATH", dir + NodePath.delimiter + process.env.PATH);
  const value = await readCliPrivateBrief(dir);
  expect(normalizePrivateBrief(value, dir).personalSummary).toBe("Example 東京🚀");
});
it("refuses cache output inside a git checkout", async () => {
  const { dir } = setup();
  NodeFS.mkdirSync(NodePath.join(dir, ".git"));
  const opts = { env: { YOU_PRIVATE_BRIEF_PATH: NodePath.join(dir, "private.json") } };
  expect(await refreshPrivateBrief(dir, opts, async () => raw())).toBe("error");
  expect(NodeFS.existsSync(NodePath.join(dir, "private.json"))).toBe(false);
});

it("exposes auth failure metadata and excludes invalid future-dated cache references", async () => {
  vi.setSystemTime(EPOCH);
  const { opts } = setup();
  await refreshPrivateBrief("/work/example-app", opts, async () => ({
    ...raw(),
    user: { authenticated: false },
  }));
  expect(loadPrivateBrief("/work/example-app", opts).status).toBe("auth-required");
  await refreshPrivateBrief("/work/example-app", opts, async () => ({
    ...raw(),
    generatedAt: new Date(EPOCH + 10 * 60_000).toISOString(),
  }));
  expect(loadPrivateBrief("/work/example-app", opts).status).toBe("invalid");
  expect(loadPrivateBrief("/work/example-app", opts).personalSummary).toBe("");
});
