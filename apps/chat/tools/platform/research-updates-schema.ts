import { z } from "zod";

const BaseStreamUpdateSchema = z.object({
  title: z.string(),
  toolCallId: z.string(),
});

const TaskUpdateSchema = BaseStreamUpdateSchema.extend({
  status: z.enum(["running", "completed"]),
});

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
  StartedSchema,
  CompletedSchema,
  ThoughtsSchema,
  WritingSchema,
]);

type ResearchUpdate = z.infer<typeof ResearchUpdateSchema>;
export { ResearchUpdateSchema };
export type { ResearchUpdate };
