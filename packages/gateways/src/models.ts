import { z } from "zod";

// Known tags for IDE hints (accepts any string for forward compatibility)
type KnownTag =
  | "reasoning"
  | "tool-use"
  | "vision"
  | "file-input"
  | "image-generation"
  | "implicit-caching";

const tagSchema = z.string() as z.ZodType<KnownTag>;

export const supportedAiGatewayModelTypes = [
  "language",
  "embedding",
  "image",
  "video",
] as const;

export type AiGatewayModelType = (typeof supportedAiGatewayModelTypes)[number];

const aiGatewayModelTypeSchema = z.union([
  z.literal("language"),
  z.literal("embedding"),
  z.literal("image"),
]);

const aiGatewayModelTypeInputSchema = z.union([
  aiGatewayModelTypeSchema,
  z.string(),
]);

const pricingTierSchema = z.object({
  cost: z.string(),
  max: z.number().optional(),
  min: z.number().default(0),
});

// Single model schema
export const aiGatewayModelSchema = z.object({
  context_window: z.number(),
  created: z.number(),
  description: z.string(),
  id: z.string(),
  max_tokens: z.number(),
  name: z.string(),
  object: z.literal("model"),
  owned_by: z.string(),
  pricing: z.object({
    input: z.string().optional(),
    output: z.string().optional(),
    input_cache_read: z.string().optional(),
    input_cache_write: z.string().optional(),
    web_search: z.string().optional(),
    image: z.string().optional(),
    input_tiers: z.array(pricingTierSchema).optional(),
    output_tiers: z.array(pricingTierSchema).optional(),
    input_cache_read_tiers: z.array(pricingTierSchema).optional(),
  }),
  tags: z.array(tagSchema).optional(),
  type: aiGatewayModelTypeInputSchema,
});

type ParsedAiGatewayModel = z.infer<typeof aiGatewayModelSchema>;

export type AiGatewayModel = Omit<ParsedAiGatewayModel, "type"> & {
  type: AiGatewayModelType;
};

export function isAiGatewayModelType(type: string): type is AiGatewayModelType {
  return supportedAiGatewayModelTypes.includes(type as AiGatewayModelType);
}

export const aiGatewayModelDiscriminatorSchema = z.object({
  type: z.string(),
});

// Parse the response envelope before validating individual supported models.
export const aiGatewayModelsEnvelopeSchema = z.object({
  data: z.array(z.unknown()),
  object: z.literal("list"),
});
