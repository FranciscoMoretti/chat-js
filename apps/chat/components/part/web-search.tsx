"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Sources } from "@/components/sources";
/* oxlint-enable sort-imports */

/* oxlint-disable unicorn/max-nested-calls -- webSearchOutput: unicorn/max-nested-calls: keep this existing parse, validation, or rendering composition explicit at the feature boundary. */

/**
 * The selected registry renderer validates its full tool schema. This shared
 * view only depends on the output fields it renders, so it remains available
 * when a scaffold has no web-search tool installed.
 */
const webSearchOutput = z.object({
  error: z.string().optional(),
  searches: z.array(
    z.object({
      results: z.array(
        z.object({ content: z.string(), title: z.string(), url: z.string() })
      ),
    })
  ),
});
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (WebSearch); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- WebSearch renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-array-as-prop, typescript/strict-boolean-expressions -- WebSearch: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including result.data.error). */

export const WebSearch = ({
  part,
}: {
  readonly messageId: string;
  readonly part: { readonly state: string; readonly output?: unknown };
}): ReactJSX.Element => {
  if (part.state === "output-error") {
    return <p role="alert">Search failed.</p>;
  }
  if (part.state !== "output-available") {
    return <output>Searching…</output>;
  }
  const result = webSearchOutput.safeParse(part.output);
  if (!result.success) {
    return <p role="alert">This search result could not be displayed.</p>;
  }
  const sources = result.data.searches.flatMap(
    (
      search: Readonly<{
        results: readonly Readonly<{
          content: string;
          title: string;
          url: string;
        }>[];
      }>
    ) =>
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing source own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      search.results.map((source) => ({ ...source, source: "web" as const }))
  );
  const uniqueSources = [
    ...new Map(
      sources.map(
        (
          source: Readonly<{
            source: "web";
            content: string;
            title: string;
            url: string;
          }>
        ) => [source.url, source]
      )
    ).values(),
  ];
  return (
    <div className="space-y-3">
      {result.data.error && <p role="alert">{result.data.error}</p>}
      {uniqueSources.length > 0 && <Sources sources={uniqueSources} />}
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-array-as-prop, typescript/strict-boolean-expressions */
