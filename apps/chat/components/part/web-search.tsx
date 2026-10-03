"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";
import { z } from "zod";

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
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-magic-numbers, oxc/no-rest-spread-properties, react-perf/jsx-no-new-array-as-prop, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- WebSearch: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including search); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including result.data.error). */

export const WebSearch = ({
  part,
}: {
  messageId: string;
  part: { state: string; output?: unknown };
}) => {
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
  const sources = result.data.searches.flatMap((search) =>
    search.results.map((source) => ({ ...source, source: "web" as const }))
  );
  const uniqueSources = [
    ...new Map(sources.map((source) => [source.url, source])).values(),
  ];
  return (
    <div className="space-y-3">
      {result.data.error && <p role="alert">{result.data.error}</p>}
      {uniqueSources.length > 0 && <Sources sources={uniqueSources} />}
    </div>
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-magic-numbers, oxc/no-rest-spread-properties, react-perf/jsx-no-new-array-as-prop, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
