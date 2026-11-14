import { z } from "zod";

const modelId = z.string().trim().min(1).max(200);

export const agentReasoningLevels = [
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

/** Serializable choices; native executable definitions remain project source. */
export const agentConfigurationSchema = z.strictObject({
  model: modelId.optional(),
  allowedModels: z
    .array(z.string().trim().max(200))
    .transform((models) => [...new Set(models.filter(Boolean))])
    .pipe(z.array(modelId).max(30))
    .default([]),
  reasoning: z.enum(agentReasoningLevels).default("provider-default"),
  defaultTools: z.boolean().default(false),
  approval: z
    .enum(["consequential", "always", "never"])
    .default("consequential"),
  compaction: z
    .strictObject({
      threshold: z.number().gt(0).lte(1).optional(),
      model: modelId.optional(),
    })
    .optional(),
  limits: z
    .strictObject({
      sessionTimeoutMs: z
        .union([z.number().int().positive(), z.literal(false)])
        .optional(),
    })
    .optional(),
});

export type AgentConfiguration = z.infer<typeof agentConfigurationSchema>;
export const defaultAgentConfiguration = agentConfigurationSchema.parse({});
