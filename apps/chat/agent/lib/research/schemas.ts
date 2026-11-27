import { z } from "zod";

const MINIMUM_RESEARCH_TEXT_LENGTH = 1;

const researchArtifact = z.object({
  fileId: z.string().min(1),
  mediaType: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  url: z.string().min(1),
});

export type ResearchArtifact = z.infer<typeof researchArtifact>;

const researchOutput = z.union([
  z.object({ format: z.literal("progress") }),
  z.object({ answer: z.string(), format: z.literal("clarifying_questions") }),
  z.object({
    artifact: researchArtifact.optional(),
    format: z.literal("report"),
    path: z.string(),
    title: z.string(),
  }),
]);

const researchInput = z.object({
  request: z
    .string()
    .min(1)
    .describe(
      "The full research task, relevant conversation context, scope, and any input sandbox file paths."
    ),
});

const researchClarification = z.strictObject({
  need_clarification: z.boolean(),
  question: z.string(),
  verification: z.string(),
});

const researchBrief = z.strictObject({
  research_brief: z.string().min(MINIMUM_RESEARCH_TEXT_LENGTH),
  title: z.string().min(MINIMUM_RESEARCH_TEXT_LENGTH),
});

const researchDecision = z.strictObject({
  complete: z.boolean(),
  topics: z.array(z.string().min(MINIMUM_RESEARCH_TEXT_LENGTH)),
});

export {
  researchBrief,
  researchClarification,
  researchDecision,
  researchInput,
  researchOutput,
};

export interface ResearchUpdate {
  type: "started" | "writing" | "thoughts" | "completed";
  title: string;
  toolCallId: string;
  timestamp?: number;
  message?: string;
  status?: "running" | "completed";
}

// Optional presentation metadata; plain JSON that any EVE channel can consume.
export const researchResult = (
  output: z.input<typeof researchOutput>,
  updates: readonly ResearchUpdate[] = []
) => ({
  kind: "chatjs.tool-result" as const,
  version: 1 as const,
  status: "success" as const,
  output: researchOutput.parse(output),
  updates: updates.map((update) => ({ ...update })),
  usage: { costUsd: 0 },
});
