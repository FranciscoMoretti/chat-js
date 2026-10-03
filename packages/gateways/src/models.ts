import { z } from "zod";

// Known tags for IDE hints (accepts any string for forward compatibility)
type KnownTag =
  | "reasoning"
  | "tool-use"
  | "vision"
  | "file-input"
  | "image-generation"
  | "implicit-caching";

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Gateway tags are extensible provider strings; the KnownTag annotation supplies completion without rejecting new provider tags.
const tagSchema = z.string() as z.ZodType<KnownTag>;

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const supportedAiGatewayModelTypes = [
  "language",
  "embedding",
  "image",
  "video",
] as const;
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type AiGatewayModelType = (typeof supportedAiGatewayModelTypes)[number];
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

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

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
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
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

type ParsedAiGatewayModel = z.infer<typeof aiGatewayModelSchema>;

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export type AiGatewayModel = Omit<ParsedAiGatewayModel, "type"> & {
  type: AiGatewayModelType;
};
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const isAiGatewayModelType = (
  type: string
): type is AiGatewayModelType =>
  supportedAiGatewayModelTypes.some((supportedType) => supportedType === type);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const aiGatewayModelDiscriminatorSchema = z.object({
  type: z.string(),
});
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
// Parse the response envelope before validating individual supported models.
export const aiGatewayModelsEnvelopeSchema = z.object({
  data: z.array(z.unknown()),
  object: z.literal("list"),
});
/* oxlint-enable import/group-exports */
