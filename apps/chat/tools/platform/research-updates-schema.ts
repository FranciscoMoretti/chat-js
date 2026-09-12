import { z } from "zod";

const BaseStreamUpdateSchema = z.object({
  title: z.string(),
  toolCallId: z.string(),
});

const TaskUpdateSchema = BaseStreamUpdateSchema.extend({
  status: z.enum(["running", "completed"]),
});

const WebSearchSchema = TaskUpdateSchema.extend({
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
  type: z.literal("web"),
});

export type WebSearchUpdate = z.infer<typeof WebSearchSchema>;

export type SearchResultItem = NonNullable<WebSearchUpdate["results"]>[number];

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

export type ResearchUpdate = z.infer<typeof ResearchUpdateSchema>;
