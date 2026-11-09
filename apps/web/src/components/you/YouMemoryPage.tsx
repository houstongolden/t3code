import { useState } from "react";

import { cn } from "~/lib/utils";
import { AppRouteModal, AppRouteModalClose } from "../AppRouteModal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { identityInitials } from "./youMemorySummary";
import {
  keptWithKey,
  scopePhrase,
  type YouMemoryKnown,
  type YouMemoryPending,
  type YouMemoryReview,
  type YouMemoryScope,
} from "./youMemoryReview";
import { useYouMemoryReview } from "./useYouMemoryReview";

function Initials({ name }: { readonly name: string }) {
  return (
    <span
      aria-hidden="true"
      className="you-dot-tile grid size-12 shrink-0 place-items-center rounded-lg border border-border font-label text-base text-primary"
    >
      {name}
    </span>
  );
}

function Note({
  item,
  review,
  busy,
  onDecide,
}: {
  readonly item: YouMemoryPending;
  readonly review: YouMemoryReview;
  readonly busy: boolean;
  readonly onDecide: (
    action: "accept" | "reject" | "correct",
    item: YouMemoryPending,
    draft: { content: string; key: string },
    target: string,
  ) => Promise<string | null>;
}) {
  const [content, setContent] = useState(item.content);
  const [key, setKey] = useState(item.suggestedKey);
  const [reviewed, setReviewed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const kept = keptWithKey(review, item.scope, key);
  const save = async (action: "accept" | "reject" | "correct") => {
    const next = await onDecide(
      action,
      item,
      { content, key: key.trim() },
      action === "correct" ? (kept?.id ?? "") : "",
    );
    setMessage(next);
    if (next === null) setReviewed(false);
  };
  return (
    <form
      className="flex flex-col gap-3 border-border border-b py-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save(kept ? "correct" : "accept");
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-label text-2xs text-muted-foreground lowercase">
          {item.from} · {scopePhrase(item.scope)}
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">What to keep</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          maxLength={4000}
          className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
      </label>
      <label className="flex max-w-xs flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input value={key} onChange={(event) => setKey(event.target.value)} maxLength={128} />
      </label>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-1"
          checked={reviewed}
          onChange={(event) => setReviewed(event.target.checked)}
        />
        I read this. It is a note for later tasks, not an instruction.
      </label>
      {message ? <p className="text-sm text-primary">{message}</p> : null}
      {kept ? (
        <p className="text-sm text-muted-foreground">
          {kept.key} is already kept for {scopePhrase(item.scope)}. Replace it, or choose another
          name.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || !reviewed || content.trim().length === 0}>
          {kept ? "Replace kept note" : "Keep"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy || !reviewed}
          onClick={() => void save("reject")}
        >
          Skip
        </Button>
      </div>
    </form>
  );
}

function Known({ item }: { readonly item: YouMemoryKnown }) {
  return (
    <article className="border-border border-b py-4">
      <p className="font-label text-2xs text-muted-foreground lowercase">
        {item.key} · {scopePhrase(item.scope)}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.content}</p>
    </article>
  );
}

function Body() {
  const { state, decide } = useYouMemoryReview();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Reading your memory…</p>;
  }
  if (state.status === "locked") {
    return (
      <p className="max-w-lg text-sm text-muted-foreground">
        Your memory stays with the owner session on this machine. Sign in there to review it.
      </p>
    );
  }
  if (state.status === "unavailable") {
    return (
      <p className="max-w-lg text-sm text-muted-foreground">
        Memory could not be read. Chat still works, and nothing was changed.
      </p>
    );
  }
  const { review } = state;
  const name = review.identity?.name ?? review.identity?.username ?? "You";
  const handle = review.identity?.username;
  const place =
    review.place === null
      ? null
      : review.place.scope === "project" && review.place.project
        ? review.place.project
        : "Every chat";
  const act = async (
    action: "accept" | "reject" | "correct" | "undo",
    id: string,
    scope: YouMemoryScope,
    fields?: { proposalId: string; key: string; content: string; target: string },
  ) => {
    setBusyId(id);
    setNotice(null);
    const result = await decide(
      action === "undo"
        ? { action, eventId: id, scope }
        : {
            action,
            proposalId: fields?.proposalId ?? "",
            key: fields?.key ?? "",
            content: fields?.content ?? "",
            scope,
            target: fields?.target ?? "",
          },
    );
    setBusyId(null);
    if (!result.ok) {
      setNotice(result.message);
      return result.message;
    }
    return null;
  };
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-5 pt-8 pb-16">
      <div className="flex items-start gap-4">
        <Initials
          name={identityInitials({
            identity: review.identity,
            identitySource: null,
            brief: null,
            review: null,
          })}
        />
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-medium tracking-tight">{name}</h1>
          {handle ? (
            <p className="font-label text-sm text-foreground">
              <span className="text-muted-foreground">you.md/</span>
              {handle}
            </p>
          ) : null}
          {review.identity?.tagline ? (
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{review.identity.tagline}</p>
          ) : null}
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        {place ? `${place}. ` : ""}
        {review.ready.length === 0
          ? "Nothing kept is eligible for the next task in this chat."
          : `${review.ready.length} ${review.ready.length === 1 ? "note is" : "notes are"} eligible for the next task in this chat.`}
      </p>
      {notice ? <p className="mt-3 text-sm text-primary">{notice}</p> : null}

      <section className="mt-10" aria-labelledby="you-to-review">
        <h2 id="you-to-review" className="font-display text-xl font-medium tracking-tight">
          To review
        </h2>
        {review.pending.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing is waiting. Imported notes show up here for you to keep or skip.
          </p>
        ) : (
          review.pending.map((item) => (
            <Note
              key={item.id}
              item={item}
              review={review}
              busy={busyId === item.id}
              onDecide={async (action, pending, draft, target) => {
                const message = await act(action, pending.id, pending.scope, {
                  proposalId: pending.id,
                  key: draft.key,
                  content: draft.content,
                  target,
                });
                return message;
              }}
            />
          ))
        )}
      </section>

      <section className="mt-10" aria-labelledby="you-ready">
        <h2 id="you-ready" className="font-display text-xl font-medium tracking-tight">
          Eligible for the next task
        </h2>
        {review.ready.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Keep a note above and it can travel with the next task in this chat.
          </p>
        ) : (
          <div className="mt-2">
            {review.ready.map((item) => (
              <Known key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {review.elsewhere.length > 0 ? (
        <section className="mt-10" aria-labelledby="you-elsewhere">
          <h2 id="you-elsewhere" className="font-display text-xl font-medium tracking-tight">
            Kept for another project
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            These stay out of this chat. They apply only where they were kept.
          </p>
          <div className="mt-2">
            {review.elsewhere.map((item) => (
              <Known key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {review.undo ? (
        <div className="mt-8">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busyId === review.undo.eventId}
            onClick={() => {
              const undo = review.undo;
              if (!undo) return;
              void act("undo", undo.eventId, undo.scope);
            }}
          >
            Undo {review.undo.summary}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function YouMemoryPage() {
  return (
    <AppRouteModal label="You">
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col")}>
        <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b ps-5 pe-2">
          <p className="font-label text-2xs text-muted-foreground lowercase">you · memory</p>
          <AppRouteModalClose />
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <Body />
        </ScrollArea>
      </div>
    </AppRouteModal>
  );
}
