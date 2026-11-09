import { Link } from "@tanstack/react-router";
import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { YouAlienMark } from "./YouMark";
import {
  describeMemoryFacts,
  identityInitials,
  sourceLabel,
  YOU_MEMORY_REVIEW_HASH,
  type YouMemoryState,
  type YouMemorySummary,
} from "./youMemorySummary";

function ReviewLink({ label }: { readonly label: string }) {
  return (
    <Link
      to="/settings/about"
      hash={YOU_MEMORY_REVIEW_HASH}
      className="pointer-events-auto inline-flex shrink-0 items-center gap-0.5 rounded-sm font-label text-2xs text-primary lowercase underline-offset-4 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {label}
      <ArrowUpRightIcon aria-hidden="true" className="size-3" />
    </Link>
  );
}

/** Dotted initials tile, the live directory's treatment for a profile without a portrait. */
function IdentityTile({
  initials,
  pending,
}: {
  readonly initials: string;
  readonly pending?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "you-dot-tile grid size-9 shrink-0 place-items-center rounded-md border border-border font-label text-sm font-medium text-primary",
        pending && "text-transparent motion-safe:animate-pulse",
      )}
    >
      {initials}
    </span>
  );
}

function Shell({
  children,
  busy,
}: {
  readonly children: React.ReactNode;
  readonly busy?: boolean;
}) {
  return (
    <section
      aria-label="Your context in this chat"
      aria-busy={busy}
      data-you-identity-context=""
      className="mx-auto mt-6 flex min-h-[76px] w-full max-w-xl flex-col justify-center gap-2 rounded-xl border border-border bg-card/80 px-3.5 py-3 text-left shadow-xs/5 backdrop-blur-sm"
    >
      {children}
    </section>
  );
}

function ReadyContext({ summary }: { readonly summary: YouMemorySummary }) {
  const handle = summary.identity?.username ?? summary.identity?.name ?? null;
  const facts = describeMemoryFacts(summary);
  const sections = summary.brief?.included ?? [];
  if (!summary.brief || !summary.identity) {
    return (
      <Shell>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md border border-dashed border-border text-muted-foreground">
            <YouAlienMark className="size-4" />
          </span>
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            No you.md identity on this machine yet, so agents here start cold.
          </p>
          <ReviewLink label="set up" />
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <div className="flex items-center gap-3">
        <IdentityTile initials={identityInitials(summary)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-label text-sm text-foreground">
            <span className="text-muted-foreground">you.md/</span>
            {handle}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Every agent in this chat starts from your brief · {sourceLabel(summary.brief.source)}
          </p>
        </div>
        <ReviewLink label="review memory" />
      </div>
      {sections.length > 0 || facts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-border/70 border-t border-dashed pt-2 font-label text-2xs text-muted-foreground lowercase">
          {sections.length > 0 ? (
            <ul aria-label="Brief sections" className="flex flex-wrap items-center gap-x-1.5">
              {sections.map((section, index) => (
                <li key={section} className="flex items-center gap-x-1.5">
                  {index > 0 ? <span aria-hidden="true">·</span> : null}
                  {section}
                </li>
              ))}
            </ul>
          ) : null}
          {facts.length > 0 ? (
            <p className="ms-auto flex flex-wrap items-center gap-x-1.5">
              {facts.map((fact, index) => (
                <span key={fact} className="flex items-center gap-x-1.5">
                  {index > 0 ? <span aria-hidden="true">·</span> : null}
                  <span className={fact.endsWith("to review") ? "text-primary" : undefined}>
                    {fact}
                  </span>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
    </Shell>
  );
}

/**
 * The identity half of the draft hero: who agents in this chat already know, which
 * brief scope applies, and a way into review. Real state only; no counts are invented.
 */
export function YouIdentityContext({ state }: { readonly state: YouMemoryState }) {
  if (state.status === "loading") {
    return (
      <Shell busy>
        <div className="flex items-center gap-3">
          <IdentityTile initials="··" pending />
          <p className="font-label text-2xs text-muted-foreground lowercase">reading your brief…</p>
        </div>
      </Shell>
    );
  }
  if (state.status === "locked") {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          Your memory stays with the owner session on this machine. Sign in there to see what agents
          know.
        </p>
      </Shell>
    );
  }
  if (state.status === "unavailable") {
    return (
      <Shell>
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Memory state could not be read. Chat still works; nothing was changed.
          </p>
          <ReviewLink label="inspect" />
        </div>
      </Shell>
    );
  }
  return <ReadyContext summary={state.summary} />;
}
