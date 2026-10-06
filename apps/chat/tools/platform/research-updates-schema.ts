import { z } from "zod";

const BaseStreamUpdateSchema = z.object({
  title: z.string(),
  toolCallId: z.string(),
});

const TaskUpdateSchema = BaseStreamUpdateSchema.extend({
  status: z.enum(["running", "completed"]),
});

const SearchResultItemSchema = z.object({
  content: z.string(),
  source: z.enum(["web", "academic", "x"]),
  title: z.string(),
  // Optional `tweetId` field, currently disabled.
  url: z.string(),
});

const WebSearchSchema = TaskUpdateSchema.extend({
  queries: z.array(z.string()),
  results: z.array(SearchResultItemSchema).optional(),
  type: z.literal("web"),
});

type WebSearchUpdate = z.infer<typeof WebSearchSchema>;

type SearchResultItem = NonNullable<WebSearchUpdate["results"]>[number];

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

const ResearchUpdateSchema = z.discriminatedUnion("type", [
  WebSearchSchema,
  StartedSchema,
  CompletedSchema,
  ThoughtsSchema,
  WritingSchema,
]);

type ResearchUpdate = z.infer<typeof ResearchUpdateSchema>;
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ResearchUpdateSchema); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { ResearchUpdateSchema };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ResearchUpdate, SearchResultItem, WebSearchUpdate); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ResearchUpdate, SearchResultItem, WebSearchUpdate };
/* oxlint-enable import/no-named-export */
