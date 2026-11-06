import { getDispatchBrief } from "./index.ts";
import type { SourceOptions } from "./sources.ts";

export type PromptHarness = "Cursor" | "Pi" | "Grok" | "OpenCode" | "OpenCode2";

/** Prompt-only providers: explicit reference-data envelope, original request remains verbatim.
 * Native slash commands MUST stay at the start; do not wrap or inject into them.
 */
export function withYouBrief(
  text: string,
  cwd: string | null | undefined,
  harness: PromptHarness,
  opts: SourceOptions = {},
): string {
  if (text.trimStart().startsWith("/")) return text;
  const brief = getDispatchBrief({ ...opts, cwd, harness, maxBytes: 4_000 });
  return brief ? `${brief.text}\n\n--- End You reference data ---\n\n${text}` : text;
}
