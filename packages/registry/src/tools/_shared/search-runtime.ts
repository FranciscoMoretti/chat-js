import { z } from "zod";

export const DEFAULT_MAX_RESULTS = 5;
export const searchQueriesSchema = z
  .array(
    z.object({
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(10)
        .nullable()
        .describe("Maximum results for this query. Pass null to use 5."),
      query: z.string(),
    })
  )
  .min(1)
  .max(2)
  .describe("One or two search queries.");

const source = z.object({
  content: z.string(),
  title: z.string(),
  url: z.string(),
});
const query = z.object({ maxResults: z.number(), query: z.string() });
const baseUpdate = z.object({ title: z.string(), toolCallId: z.string() });
const update = z.discriminatedUnion("type", [
  baseUpdate.extend({ type: z.literal("started"), timestamp: z.number() }),
  baseUpdate.extend({ type: z.literal("completed"), timestamp: z.number() }),
  baseUpdate.extend({
    type: z.literal("web"),
    status: z.enum(["running", "completed"]),
    queries: z.array(z.string()),
    results: z.array(source.extend({ source: z.literal("web") })).optional(),
  }),
]);
export const searchOutputSchema = z.object({
  error: z.string().optional(),
  searches: z.array(z.object({ query, results: z.array(source) })),
  updates: z.array(update).default([]),
});
export type SearchOutput = z.infer<typeof searchOutputSchema>;
type SearchQuery = z.infer<typeof query>;
type Source = z.infer<typeof source>;

const URL_PATTERN = /^https?:\/\/(?<domain>[^/?#]+)(?:[/?#]|$)/iu;
const uniqueSources = (sources: readonly Source[]): Source[] => {
  const seen = new Set<string>();
  return sources.filter(({ url }) => {
    const domain = URL_PATTERN.exec(url)?.groups?.domain ?? url;
    if (seen.has(domain)) {
      return false;
    }
    seen.add(domain);
    return true;
  });
};

/** Native EVE snapshots; application assembly can additionally expose updates to its UI.
 * @yields {SearchOutput} Running progress followed by sources and completed progress.
 */
export const searchSnapshots = async function* searchSnapshots({
  queries,
  search,
  abortSignal,
  callId,
  title,
  completeTitle,
}: {
  readonly queries: readonly Readonly<SearchQuery>[];
  readonly search: (
    query: Readonly<SearchQuery>,
    index: number
  ) => Promise<readonly Source[]>;
  readonly abortSignal: Readonly<AbortSignal>;
  readonly callId: string;
  readonly title: string;
  readonly completeTitle: string;
}): AsyncGenerator<SearchOutput, void> {
  abortSignal.throwIfAborted();
  // Snapshot only declared fields before handing a query to the provider.
  const input = queries.map(({ query: text, maxResults }) => ({
    query: text,
    maxResults,
  }));
  const started = {
    type: "started",
    title,
    toolCallId: callId,
    timestamp: Date.now(),
  } as const;
  const web = {
    type: "web",
    title: `Executing ${input.length} searches`,
    toolCallId: callId,
    queries: input.map((item) => item.query),
  } as const;
  yield { searches: [], updates: [started, { ...web, status: "running" }] };
  abortSignal.throwIfAborted();
  const results = await Promise.allSettled(
    input.map(async (item, index) => {
      const sources = await search({ ...item }, index);
      abortSignal.throwIfAborted();
      return {
        query: item,
        results: uniqueSources(z.array(source).parse(sources)),
      };
    })
  );
  abortSignal.throwIfAborted();
  const searches = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  const failed = results.some((result) => result.status === "rejected");
  yield searchOutputSchema.parse({
    searches,
    ...(failed ? { error: "Some searches failed. Please try again." } : {}),
    updates: [
      started,
      {
        ...web,
        status: "completed",
        results: uniqueSources(searches.flatMap((item) => item.results)).map(
          (item) => ({ ...item, source: "web" })
        ),
      },
      {
        type: "completed",
        title: completeTitle,
        toolCallId: callId,
        timestamp: Date.now(),
      },
    ],
  });
};
