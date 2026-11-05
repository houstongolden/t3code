/**
 * You brand tokens (locked v5, see SPEC.md). Single source for theme wiring.
 * Accent vermilion, warm grays G0 (darkest) to G9 (lightest), Inter + Geist Mono, hairlines (G4), no nested boxes. G1 app bg, G2 panels, G9 text.
 */
const YOU_ACCENT = "#E5482F";
const YOU_GRAYS = {
  G0: "#0E0E0D",
  G1: "#131312",
  G2: "#181816",
  G3: "#1F1F1C",
  G4: "#2A2A26",
  G5: "#3E3E38",
  G6: "#6E6E66",
  G7: "#9A9A90",
  G8: "#C8C8BE",
  G9: "#EDEDE6",
} as const;
const YOU_FONTS = {
  sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
  mono: '"Geist Mono", ui-monospace, monospace',
} as const;
const YOU_HAIRLINE = `1px solid ${YOU_GRAYS.G4}`;

/** Expose the tokens as --you-* CSS variables so styles can adopt them incrementally. */
export function applyYouBrandCssVariables(root: {
  style: { setProperty(name: string, value: string): void };
}): void {
  root.style.setProperty("--you-accent", YOU_ACCENT);
  for (const [key, value] of Object.entries(YOU_GRAYS))
    root.style.setProperty(`--you-${key.toLowerCase()}`, value);
  root.style.setProperty("--you-font-sans", YOU_FONTS.sans);
  root.style.setProperty("--you-font-mono", YOU_FONTS.mono);
  root.style.setProperty("--you-hairline", YOU_HAIRLINE);
}
