import type { AiGatewayModel } from "@chat-js/gateways/models";

import type { ModelData } from "./model-data";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (toModelData); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- ModelData shares tags and pricing with the gateway record; accepting deep-readonly arrays would require copying those references or changing the public mutable output contract.
export const toModelData = (model: AiGatewayModel): ModelData => {
  const tags = model.tags ?? [];
  // A missing positive tag does not establish that a language model rejects tools.
  // oxlint-disable-next-line no-undefined -- Missing tool-use metadata means unknown support; ModelData distinguishes this from false for nonlanguage models.
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
    toolCall: model.type === "language" ? toolCall : false,
    type: model.type,
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
