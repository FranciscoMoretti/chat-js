"use client";

import { LoaderCircle, MessageSquare, X } from "lucide-react";
import React, { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";

const highlightedExcerpt = (
  excerpt: string
): (React.JSX.Element | string)[] => {
  let previousEnd = 0;
  const parts = [...excerpt.matchAll(/⟦[^⟧]*⟧/gu)].flatMap(
    (match: readonly string[] & Readonly<{ index: number }>) => {
      const start = match.index;
      const before = excerpt.slice(previousEnd, start);
      previousEnd = start + match[0].length;
      const mark = (
        <mark
          className="text-foreground bg-transparent font-medium"
          key={start}
        >
          {match[0].slice(1, -1)}
        </mark>
      );
      if (before.length > 0) {
        return [before, mark];
      }
      return [mark];
    }
  );
  if (previousEnd < excerpt.length) {
    parts.push(excerpt.slice(previousEnd));
  }
  return parts;
};

export const EveSearchResultsView = ({
  query,
  onQueryChange,
  onClose,
  searching,
  pending,
  error,
  items,
  isSearch,
  onSelect,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
  disableLoadMore,
}: {
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly onClose: () => void;
  readonly searching: boolean;
  readonly pending: boolean;
  readonly error: boolean;
  readonly items: readonly {
    readonly id: string;
    readonly conversationId: string;
    readonly title: string;
    readonly excerpt: string;
  }[];
  readonly isSearch: boolean;
  readonly onSelect: (id: string) => void;
  readonly onRetry: () => void;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly onLoadMore: () => void;
  readonly disableLoadMore: boolean;
}): React.JSX.Element => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Command
      shouldFilter={false}
      className="**:data-[slot=command-input-wrapper]:h-12"
    >
      <div className="flex items-center pr-2">
        <CommandInput
          ref={inputRef}
          aria-label="Search conversations"
          className="min-w-0"
          placeholder="Search titles and messages…"
          value={query}
          onValueChange={onQueryChange}
          maxLength={255}
        />
        <div className="text-muted-foreground flex shrink-0 items-center gap-1">
          {searching && (
            <LoaderCircle
              aria-hidden="true"
              className="pointer-events-none mx-1 size-4 animate-spin"
            />
          )}
          {query.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onQueryChange("");
                  inputRef.current?.focus();
                }}
              >
                Clear
              </Button>
              <span aria-hidden="true" className="bg-border mx-1 h-5 w-px" />
            </>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close search"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>
      <output className="sr-only" aria-live="polite">
        {searching ? "Searching…" : ""}
      </output>
      <CommandList
        className="h-[300px] max-h-[50dvh]"
        aria-busy={searching || pending}
      >
        {pending && (
          <output aria-label="Loading chats" className="block p-1">
            <div aria-hidden="true">
              <div className="flex h-8 items-center px-2">
                <Skeleton className="bg-foreground/10 h-3 w-20" />
              </div>
              {["w-40", "w-56", "w-32", "w-48", "w-36", "w-44"].map(
                (width): React.JSX.Element => (
                  <div
                    className="flex h-11 items-center gap-3 px-2"
                    key={width}
                  >
                    <Skeleton className="bg-foreground/10 size-4 shrink-0" />
                    <Skeleton
                      className={`bg-foreground/10 h-4 max-w-[75%] ${width}`}
                    />
                  </div>
                )
              )}
            </div>
          </output>
        )}
        {error && (
          <div className="p-4 text-sm" role="alert">
            Could not search chats.{" "}
            <Button variant="ghost" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
        {!pending && !error && !searching && items.length === 0 && (
          <p className="text-muted-foreground p-4 text-sm">
            {isSearch
              ? "No chats found. Try different words."
              : "Your recent chats will appear here."}
          </p>
        )}
        {items.length > 0 && (
          <CommandGroup heading={isSearch ? "Best matches" : "Recent chats"}>
            {items.map((item): React.JSX.Element => (
              <CommandItem
                className="cursor-pointer items-start gap-3 px-2 py-3"
                key={item.id}
                value={item.id}
                onSelect={() => {
                  onSelect(item.conversationId);
                }}
              >
                <MessageSquare className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">{item.title}</span>
                  {item.excerpt && (
                    <span className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                      {highlightedExcerpt(item.excerpt)}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {hasMore && (
          <Button
            variant="ghost"
            disabled={disableLoadMore}
            onClick={onLoadMore}
          >
            {loadingMore ? "Loading…" : "Load more chats"}
          </Button>
        )}
      </CommandList>
    </Command>
  );
};
