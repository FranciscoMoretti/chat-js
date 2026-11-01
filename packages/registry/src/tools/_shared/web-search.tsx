import type { ReactNode } from "react";
import { expect } from "vitest";

import type { ChatState } from "./visual";

interface Source {
  content: string;
  title: string;
  url: string;
}
interface Search {
  query: { maxResults: number; query: string };
  results: Source[];
}

/** The tool-part fields a web-search story varies; each tool adds its own input. */
export type WebSearchPart =
  | { state: "input-available"; toolCallId: string }
  | {
      output: { error?: string; searches: Search[] };
      state: "output-available";
      toolCallId: string;
    }
  | { errorText: string; state: "output-error"; toolCallId: string };

const showsSources = async (section: HTMLElement): Promise<void> => {
  await expect
    .poll(() => section.querySelector("img, [aria-label]"))
    .not.toBeNull();
};

/**
 * The two web-search tools (firecrawl, tavily) share one renderer, so they share
 * the story: searching, the sources found, a search with no results, a partial
 * failure alongside the sources that did come back, and a failed search. Each
 * tool supplies its own typed `renderWith` (its renderer + input) and its own
 * query and sources, so the two snapshots are visually distinguishable.
 */
export const webSearchStates = (
  renderWith: (part: WebSearchPart) => ReactNode,
  toolCallId: string,
  search: Search
): ChatState[] => [
  {
    label: "Searching",
    ui: renderWith({
      state: "input-available",
      toolCallId: `${toolCallId}-searching`,
    }),
  },
  {
    label: "Sources found",
    settle: showsSources,
    ui: renderWith({
      output: { searches: [search] },
      state: "output-available",
      toolCallId: `${toolCallId}-sources`,
    }),
  },
  {
    label: "No results (renders nothing)",
    ui: renderWith({
      output: { searches: [] },
      state: "output-available",
      toolCallId: `${toolCallId}-empty`,
    }),
  },
  {
    label: "Partial failure",
    settle: showsSources,
    ui: renderWith({
      output: {
        error:
          "One search provider timed out. Showing the results that came back.",
        searches: [{ ...search, results: search.results.slice(0, 1) }],
      },
      state: "output-available",
      toolCallId: `${toolCallId}-partial`,
    }),
  },
  {
    label: "Search failed",
    ui: renderWith({
      errorText: "The search provider is unavailable.",
      state: "output-error",
      toolCallId: `${toolCallId}-failed`,
    }),
  },
];
