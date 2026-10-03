/* oxlint-disable eslint/no-magic-numbers -- Fixture values, viewport widths and canvas sizes are literal test data. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/exports-last -- Each helper is exported next to the code it depends on. */
/* oxlint-disable import/group-exports -- Each helper is exported where it is declared, next to its documentation. */
/* oxlint-disable import/no-named-export -- Stories import the harness helpers by name. */
/* oxlint-disable jsdoc/require-param -- The comment explains why; the TypeScript signature describes the parameters. */
/* oxlint-disable jsdoc/require-returns -- The comment explains why; the TypeScript signature describes the result. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/consistent-type-definitions -- Story state shapes are type aliases like the rest of the harness. */
/* oxlint-disable typescript/explicit-function-return-type -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Parameters are DOM elements and library props, which are mutable host objects. */
/* oxlint-disable typescript/promise-function-async -- Test and settle callbacks return the capture promise directly. */

import type { ReactNode } from "react";
import { expect } from "vitest";

import type { ChatState } from "./visual";

type Source = { content: string; title: string; url: string };
type Search = {
  query: { maxResults: number; query: string };
  results: Source[];
};

/** The tool-part fields a web-search story varies; each tool adds its own input. */
export type WebSearchPart =
  | { state: "input-available"; toolCallId: string }
  | {
      output: { error?: string; searches: Search[] };
      state: "output-available";
      toolCallId: string;
    }
  | { errorText: string; state: "output-error"; toolCallId: string };

// Source cards load favicons from an external service the replay cannot reach, so
// both search stories serve this inline globe instead.
export const faviconDataUri = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='#9ca3af' stroke-width='1.25'><circle cx='8' cy='8' r='6.25'/><path d='M1.75 8h12.5'/><ellipse cx='8' cy='8' rx='3' ry='6.25'/></svg>"
)}`;

const showsSources = (section: HTMLElement) =>
  expect.poll(() => section.querySelector("img, [aria-label]")).not.toBeNull();

/**
 * The two web-search tools (firecrawl, tavily) share one renderer, so they share
 * the story: searching, the sources found, a partial failure alongside the
 * sources that did come back, and a failed search. Each tool supplies its own
 * typed `renderWith` (its renderer + input) and its own query and sources, so
 * the two snapshots are visually distinguishable.
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable eslint/no-magic-numbers */
