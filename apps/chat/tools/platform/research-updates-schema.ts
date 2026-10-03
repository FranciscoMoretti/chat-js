import { z } from "zod";

const BaseStreamUpdateSchema = z.object({
  title: z.string(),
  toolCallId: z.string(),
});

const TaskUpdateSchema = BaseStreamUpdateSchema.extend({
  status: z.enum(["running", "completed"]),
});

/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): WebSearchSchema keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const WebSearchSchema = TaskUpdateSchema.extend({
  queries: z.array(z.string()),
  results: z
    .array(
      z.object({
        content: z.string(),
        source: z.enum(["web", "academic", "x"]),
        title: z.string(),
        // Optional `tweetId` field, currently disabled.
        url: z.string(),
      })
    )
    .optional(),
  type: z.literal("web"),
});
/* oxlint-enable unicorn/max-nested-calls */

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): WebSearchUpdate is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): WebSearchUpdate stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type WebSearchUpdate = z.infer<typeof WebSearchSchema>;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): SearchResultItem is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): SearchResultItem stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type SearchResultItem = NonNullable<WebSearchUpdate["results"]>[number];
/* oxlint-enable import/exports-last, import/group-exports */

const StartedSchema = BaseStreamUpdateSchema.extend({
  timestamp: z.number(),
  type: z.literal("started"),
});

const CompletedSchema = BaseStreamUpdateSchema.extend({
  timestamp: z.number(),
  type: z.literal("completed"),
});

const ThoughtsSchema = TaskUpdateSchema.extend({
  message: z.string(),
  type: z.literal("thoughts"),
});

const WritingSchema = TaskUpdateSchema.extend({
  message: z.string().optional(),
  type: z.literal("writing"),
});

export const ResearchUpdateSchema = z.discriminatedUnion("type", [
  WebSearchSchema,
  StartedSchema,
  CompletedSchema,
  ThoughtsSchema,
  WritingSchema,
]);

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): ResearchUpdate stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type ResearchUpdate = z.infer<typeof ResearchUpdateSchema>;
/* oxlint-enable import/group-exports */
