"use client";

import { LoaderCircle, MessageSquare, X } from "lucide-react";
import React, { useRef } from "react";

import { Button } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
/* oxlint-enable sort-imports */
import { Skeleton } from "@/components/ui/skeleton";
/* oxlint-disable no-magic-numbers -- highlightedExcerpt: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1);  */

const highlightedExcerpt = (excerpt: string): (React.JSX.Element | string)[] =>
  excerpt.split(/(?<match>⟦[^⟧]*⟧)/u).map((part, index) => {
    if (part.startsWith("⟦") && part.endsWith("⟧")) {
      return (
        <mark
          className="text-foreground bg-transparent font-medium"
          // oxlint-disable-next-line react/no-array-index-key -- #551: Repeated matched text needs its offset in this excerpt; marks have no component state.
          key={`${index}:${part}`}
        >
          {part.slice(1, -1)}
        </mark>
      );
    }
    return part;
  });
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveSearchResultsView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- EveSearchResultsView renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- EveSearchResultsView: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including item). */

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
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  searching: boolean;
  pending: boolean;
  error: boolean;
  items: readonly {
    id: string;
    conversationId: string;
    title: string;
    excerpt: string;
  }[];
  isSearch: boolean;
  onSelect: (id: string) => void;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  disableLoadMore: boolean;
}): React.JSX.Element => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Command
      shouldFilter={false}
      // oxlint-disable-next-line react/forbid-component-props -- Command accepts className in its styling contract; preserve this caller's layout and appearance.
      className="**:data-[slot=command-input-wrapper]:h-12"
    >
      <div className="flex items-center pr-2">
        <CommandInput
          ref={inputRef}
          aria-label="Search conversations"
          containerClassName="min-w-0 flex-1"
          // oxlint-disable-next-line react/forbid-component-props -- CommandInput accepts className in its styling contract; preserve this caller's layout and appearance.
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
              // oxlint-disable-next-line react/forbid-component-props -- LoaderCircle accepts className in its styling contract; preserve this caller's layout and appearance.
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
                  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading focus from inputRef.current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          searching ? "Searching…" : ""
        }
      </output>
      <CommandList
        // oxlint-disable-next-line react/forbid-component-props -- CommandList accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-[300px] max-h-[50dvh]"
        aria-busy={searching || pending}
      >
        {pending && (
          <output aria-label="Loading chats" className="block p-1">
            <div aria-hidden="true">
              <div className="flex h-8 items-center px-2">
                <Skeleton
                  // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="bg-foreground/10 h-3 w-20"
                />
              </div>
              {["w-40", "w-56", "w-32", "w-48", "w-36", "w-44"].map(
                (width): React.JSX.Element => (
                  <div
                    className="flex h-11 items-center gap-3 px-2"
                    key={width}
                  >
                    <Skeleton
                      // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="bg-foreground/10 size-4 shrink-0"
                    />
                    <Skeleton
                      // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
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
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              isSearch
                ? "No chats found. Try different words."
                : "Your recent chats will appear here."
            }
          </p>
        )}
        {items.length > 0 && (
          <CommandGroup
            heading={
              // oxlint-disable-next-line no-ternary -- Keep heading JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              isSearch ? "Best matches" : "Recent chats"
            }
          >
            {items.map((item): React.JSX.Element => (
              <CommandItem
                // oxlint-disable-next-line react/forbid-component-props -- CommandItem accepts className in its styling contract; preserve this caller's layout and appearance.
                className="cursor-pointer items-start gap-3 px-2 py-3"
                key={item.id}
                value={item.id}
                onSelect={() => onSelect(item.conversationId)}
              >
                <MessageSquare
                  // oxlint-disable-next-line react/forbid-component-props -- MessageSquare accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                />
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
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              loadingMore ? "Loading…" : "Load more chats"
            }
          </Button>
        )}
      </CommandList>
    </Command>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
