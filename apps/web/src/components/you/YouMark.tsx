import { cn } from "~/lib/utils";

const HEAD =
  "M24 4.5C35.2 4.5 41.5 12.6 41.5 21.8C41.5 32.4 33.4 42.6 24 43.5C14.6 42.6 6.5 32.4 6.5 21.8C6.5 12.6 12.8 4.5 24 4.5Z";

/** Locked alien head. Head follows currentColor, eyes cut to the page background. */
export function YouAlienMark({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("shrink-0", className)}>
      <path d={HEAD} fill="currentColor" />
      <ellipse
        cx="16.3"
        cy="23.6"
        rx="5.3"
        ry="2.7"
        transform="rotate(17 16.3 23.6)"
        fill="var(--background)"
      />
      <ellipse
        cx="31.7"
        cy="23.6"
        rx="5.3"
        ry="2.7"
        transform="rotate(-17 31.7 23.6)"
        fill="var(--background)"
      />
    </svg>
  );
}

/** Locked vermilion tile mark, used where the app names itself. */
export function YouTileMark({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect width="48" height="48" rx="12" fill="var(--color-you-vermilion)" />
      <g transform="translate(7.2 7.2) scale(.7)">
        <path d={HEAD} fill="var(--color-you-bone)" />
        <ellipse
          cx="16.3"
          cy="23.6"
          rx="5.3"
          ry="2.7"
          transform="rotate(17 16.3 23.6)"
          fill="var(--color-you-vermilion)"
        />
        <ellipse
          cx="31.7"
          cy="23.6"
          rx="5.3"
          ry="2.7"
          transform="rotate(-17 31.7 23.6)"
          fill="var(--color-you-vermilion)"
        />
      </g>
    </svg>
  );
}
