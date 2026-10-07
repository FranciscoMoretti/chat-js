import type { AiGatewayModel } from "@chat-js/gateways/models";

import type { ModelData } from "./model-data";

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ReadonlyAiGatewayModel, toModelData); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
type ReadonlyAiGatewayPricing = Readonly<
  Omit<
    AiGatewayModel["pricing"],
    "input_cache_read_tiers" | "input_tiers" | "output_tiers"
  >
> & {
  readonly input_cache_read_tiers?: readonly Readonly<
    NonNullable<AiGatewayModel["pricing"]["input_cache_read_tiers"]>[number]
  >[];
  readonly input_tiers?: readonly Readonly<
    NonNullable<AiGatewayModel["pricing"]["input_tiers"]>[number]
  >[];
  readonly output_tiers?: readonly Readonly<
    NonNullable<AiGatewayModel["pricing"]["output_tiers"]>[number]
  >[];
};

export type ReadonlyAiGatewayModel = Readonly<
  Omit<AiGatewayModel, "pricing" | "tags"> & {
    readonly pricing: ReadonlyAiGatewayPricing;
    readonly tags?: readonly string[];
  }
>;

export const toModelData = (
  model: Readonly<ReadonlyAiGatewayModel>
): ModelData => {
  const tags = model.tags ?? [];
  // A missing positive tag does not establish that a language model rejects tools.
  // oxlint-disable-next-line no-undefined, no-ternary -- Missing tool-use metadata means unknown support; ModelData distinguishes this from false for nonlanguage models.; no-ternary: Keep toolCall as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const toolCall = tags.includes("tool-use") ? true : undefined;

  return {
    context_window: model.context_window,
    description: model.description,
    id: model.id,
    input: {
      audio: false,
      image: tags.includes("vision") || model.type === "image",
      pdf: tags.includes("file-input"),
      text: model.type === "language",
      video: false,
    },
    max_tokens: model.max_tokens,
    name: model.name,
    object: model.object,
    output: {
      audio: false,
      image: tags.includes("image-generation") || model.type === "image",
      text: model.type === "language",
      video: model.type === "video",
    },
    owned_by: model.owned_by,
    pricing: model.pricing,
    reasoning: tags.includes("reasoning"),
    tags: model.tags,
    // oxlint-disable-next-line no-ternary -- Keep toolCall as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    toolCall: model.type === "language" ? toolCall : false,
    type: model.type,
  };
};
/* oxlint-enable import/no-named-export */
