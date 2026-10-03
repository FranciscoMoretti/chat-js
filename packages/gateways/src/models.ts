import { z } from "zod";

// Known tags for IDE hints (accepts any string for forward compatibility)
type KnownTag =
  | "reasoning"
  | "tool-use"
  | "vision"
  | "file-input"
  | "image-generation"
  | "implicit-caching";

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Deferred contract debt (#622): the schema accepts any string but KnownTag is closed; review open-tag typing separately without changing runtime parsing in this lint cleanup.
const tagSchema = z.string() as z.ZodType<KnownTag>;

const supportedAiGatewayModelTypes = [
  "language",
  "embedding",
  "image",
  "video",
] as const;

type AiGatewayModelType = (typeof supportedAiGatewayModelTypes)[number];

const aiGatewayModelTypeSchema = z.union([
  z.literal("language"),
  z.literal("embedding"),
  z.literal("image"),
]);

const aiGatewayModelTypeInputSchema = z.union([
  aiGatewayModelTypeSchema,
  z.string(),
]);

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const pricingTierSchema = z.object({
  cost: z.string(),
  max: z.number().optional(),
  min: z.number().default(0),
});
/* oxlint-enable eslint/no-magic-numbers */

// Single model schema
const aiGatewayModelSchema = z.object({
  context_window: z.number(),
  created: z.number(),
  description: z.string(),
  id: z.string(),
  max_tokens: z.number(),
  name: z.string(),
  object: z.literal("model"),
  owned_by: z.string(),
  pricing: z.object({
    image: z.string().optional(),
    input: z.string().optional(),
    input_cache_read: z.string().optional(),
    input_cache_read_tiers: z.array(pricingTierSchema).optional(),
    input_cache_write: z.string().optional(),
    input_tiers: z.array(pricingTierSchema).optional(),
    output: z.string().optional(),
    output_tiers: z.array(pricingTierSchema).optional(),
    web_search: z.string().optional(),
  }),
  tags: z.array(tagSchema).optional(),
  type: aiGatewayModelTypeInputSchema,
});

type ParsedAiGatewayModel = z.infer<typeof aiGatewayModelSchema>;

type AiGatewayModel = Omit<ParsedAiGatewayModel, "type"> & {
  type: AiGatewayModelType;
};

const isAiGatewayModelType = (type: string): type is AiGatewayModelType =>
  supportedAiGatewayModelTypes.some((supportedType) => supportedType === type);

const aiGatewayModelDiscriminatorSchema = z.object({
  type: z.string(),
});

// Parse the response envelope before validating individual supported models.
const aiGatewayModelsEnvelopeSchema = z.object({
  data: z.array(z.unknown()),
  object: z.literal("list"),
});

export {
  supportedAiGatewayModelTypes,
  aiGatewayModelSchema,
  isAiGatewayModelType,
  aiGatewayModelDiscriminatorSchema,
  aiGatewayModelsEnvelopeSchema,
};

export type { AiGatewayModelType, AiGatewayModel };
