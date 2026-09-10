import { z } from "zod";

const BaseStreamUpdateSchema = z.object({
  title: z.string(),
  toolCallId: z.string(),
});

const TaskUpdateSchema = BaseStreamUpdateSchema.extend({
  status: z.enum(["running", "completed"]),
});

const WebSearchSchema = TaskUpdateSchema.extend({
  type: z.literal("web"),
  queries: z.array(z.string()),
  results: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        content: z.string(),
        source: z.enum(["web", "academic", "x"]),
        // tweetId: z.string().optional(),
      })
    )
    .optional(),
});

export type WebSearchUpdate = z.infer<typeof WebSearchSchema>;

export type SearchResultItem = NonNullable<WebSearchUpdate["results"]>[number];

const StartedSchema = BaseStreamUpdateSchema.extend({
  type: z.literal("started"),
  timestamp: z.number(),
});

const CompletedSchema = BaseStreamUpdateSchema.extend({
  type: z.literal("completed"),
  timestamp: z.number(),
});

const ThoughtsSchema = TaskUpdateSchema.extend({
  type: z.literal("thoughts"),
  message: z.string(),
});

const WritingSchema = TaskUpdateSchema.extend({
  type: z.literal("writing"),
  message: z.string().optional(),
});

export const ResearchUpdateSchema = z.discriminatedUnion("type", [
  WebSearchSchema,
  StartedSchema,
  CompletedSchema,
  ThoughtsSchema,
  WritingSchema,
]);

export type ResearchUpdate = z.infer<typeof ResearchUpdateSchema>;
