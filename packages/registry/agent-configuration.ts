import { z } from "zod";

const modelId = z.string().trim().min(1).max(200);
const modelIds = z
  .array(z.string().trim().max(200))
  .transform((models) => [...new Set(models.filter(Boolean))])
  .pipe(z.array(modelId).max(30))
  .optional();

export const agentReasoningLevels = [
  "provider-default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

export const eveDefaultToolIds = [
  "tool/bash",
  "tool/read_file",
  "tool/write_file",
  "tool/edit_file",
  "tool/web_fetch",
  "tool/web_search",
  "tool/agent",
] as const;

/** Serializable choices; native executable definitions remain project source. */
export const agentConfigurationSchema = z.strictObject({
  model: modelId.optional(),
  modelIds,
  // Previously exported install presets may still contain additional model IDs.
  allowedModels: modelIds,
  reasoning: z.enum(agentReasoningLevels).default("provider-default"),
  defaultTools: z.boolean().default(true),
  disabledDefaultTools: z
    .array(z.enum(eveDefaultToolIds))
    .max(eveDefaultToolIds.length)
    .transform((ids) => [...new Set(ids)])
    .optional(),
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

export const enabledEveDefaultTools = (
  agent?: AgentConfiguration
): readonly string[] =>
  agent?.defaultTools === false
    ? []
    : eveDefaultToolIds.filter(
        (id) => agent?.disabledDefaultTools?.includes(id) !== true
      );
