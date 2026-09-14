"use client";

import { z } from "zod";

import { Sources } from "@/components/sources";

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
