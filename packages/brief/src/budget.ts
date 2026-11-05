const encoder = new TextEncoder();

export const byteLength = (text: string): number => encoder.encode(text).length;

/** Cut to at most maxBytes of UTF-8 without splitting a code point; appends an ellipsis marker when cut. */
export function truncateUtf8(text: string, maxBytes: number, marker = "…"): string {
  if (byteLength(text) <= maxBytes) return text;
  const markerBytes = byteLength(marker);
  if (maxBytes <= markerBytes) return "";
  let out = "";
  let used = 0;
  for (const ch of text) {
    const b = byteLength(ch);
    if (used + b > maxBytes - markerBytes) break;
    out += ch;
    used += b;
  }
  return out.trimEnd() + marker;
}

export interface Section {
  readonly id: string;
  /** Lower runs first and survives longest. */
  readonly priority: number;
  readonly heading: string;
  readonly lines: ReadonlyArray<string>;
  /** Keep at least this many lines when truncating; otherwise drop the section. */
  readonly minLines?: number;
}

export interface PackResult {
  readonly text: string;
  readonly included: string[];
  readonly truncated: string[];
  readonly dropped: string[];
}

const render = (heading: string, lines: ReadonlyArray<string>) =>
  `## ${heading}\n${lines.join("\n")}`;

/**
 * Greedy priority packing under a hard byte cap. Sections go in priority order; a section that does not fit
 * keeps as many leading lines as fit (each line itself UTF-8 truncated), later smaller sections may still fit.
 */
export function packSections(
  header: string,
  sections: ReadonlyArray<Section>,
  maxBytes: number,
): PackResult {
  const ordered = [...sections]
    .filter((s) => s.lines.length > 0)
    .sort((a, b) => a.priority - b.priority);
  const included: string[] = [];
  const truncated: string[] = [];
  const dropped: string[] = [];
  let text = truncateUtf8(header, maxBytes);
  for (const section of ordered) {
    const sep = "\n\n";
    const full = render(section.heading, section.lines);
    if (byteLength(text + sep + full) <= maxBytes) {
      text += sep + full;
      included.push(section.id);
      continue;
    }
    const kept: string[] = [];
    for (const line of section.lines) {
      const candidate = render(section.heading, [...kept, line]);
      const room = maxBytes - byteLength(text + sep + render(section.heading, kept)) - 1;
      if (byteLength(text + sep + candidate) <= maxBytes) {
        kept.push(line);
      } else {
        if (room > 24) kept.push(truncateUtf8(line, room));
        break;
      }
    }
    if (kept.length >= Math.max(1, section.minLines ?? 1)) {
      text += sep + render(section.heading, kept);
      truncated.push(section.id);
    } else {
      dropped.push(section.id);
    }
  }
  return { text, included, truncated, dropped };
}
