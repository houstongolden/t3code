// Supported MCP stdio client for the installed You CLI, no credential/config access.
// @effect-diagnostics nodeBuiltinImport:off globalTimers:off
import * as NodeTimers from "node:timers";
import * as NodeChildProcess from "node:child_process";

const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function readCliPrivateBrief(cwd: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = NodeChildProcess.spawn("you", ["mcp"], {
      cwd,
      stdio: ["pipe", "pipe", "ignore"],
    });
    let buffer = "",
      bytes = 0,
      finished = false;
    const pending = new Map<
      number,
      { resolve: (value: unknown) => void; reject: (reason: Error) => void }
    >();
    const timer = NodeTimers.setTimeout(() => finish(new Error("CLI MCP timed out")), 15_000);
    function finish(error?: Error, value?: unknown) {
      if (finished) return;
      finished = true;
      NodeTimers.clearTimeout(timer);
      child.kill("SIGTERM");
      const kill = NodeTimers.setTimeout(() => child.kill("SIGKILL"), 1000);
      kill.unref();
      for (const p of pending.values()) p.reject(new Error("CLI MCP closed"));
      pending.clear();
      if (error) reject(error);
      else resolve(value);
    }
    const send = (message: unknown) => child.stdin.write(JSON.stringify(message) + "\n");
    const call = (id: number, method: string, params: unknown): Promise<unknown> =>
      new Promise((ok, fail) => {
        pending.set(id, { resolve: ok, reject: fail });
        send({ jsonrpc: "2.0", id, method, params });
      });
    child.on("error", (e: NodeJS.ErrnoException) =>
      finish(new Error(e.code === "ENOENT" ? "cli-unavailable" : "CLI MCP unavailable")),
    );
    child.on("exit", () => {
      if (!finished) finish(new Error("CLI MCP exited"));
    });
    child.stdin.on("error", () => finish(new Error("CLI MCP unavailable")));
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 4_000_000) {
        finish(new Error("CLI MCP response exceeds limit"));
        return;
      }
      buffer += chunk;
      for (let end; (end = buffer.indexOf("\n")) !== -1;) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        let r: Record<string, unknown>;
        try {
          r = record(JSON.parse(line));
        } catch {
          continue;
        }
        if (typeof r.id !== "number") continue;
        const p = pending.get(r.id);
        if (!p) continue;
        pending.delete(r.id);
        if (r.error) p.reject(new Error("CLI MCP request failed"));
        else p.resolve(r.result);
      }
    });
    void (async () => {
      try {
        await call(1, "initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "You-memory", version: "0.2" },
        });
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        const tools = record(await call(2, "tools/list", {}));
        if (
          !Array.isArray(tools?.tools) ||
          !tools.tools.some((t: unknown) => record(t).name === "get_agent_brief")
        )
          throw new Error("CLI lacks get_agent_brief");
        const result = record(
          await call(3, "tools/call", {
            name: "get_agent_brief",
            arguments: { format: "json", includeMemories: true },
          }),
        );
        if (result.isError) throw new Error("CLI MCP tool failed");
        const content = Array.isArray(result.content) ? result.content : [];
        const text = record(content.find((c: unknown) => record(c).type === "text")).text;
        if (typeof text !== "string") throw new Error("Unsupported MCP content");
        finish(undefined, JSON.parse(text));
      } catch (e) {
        finish(e instanceof Error ? e : new Error("CLI MCP unavailable"));
      }
    })();
  });
}
