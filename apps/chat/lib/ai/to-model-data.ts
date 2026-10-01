import type { AiGatewayModel } from "@chat-js/gateways/models";

import type { ModelData } from "./model-data";

export const toModelData = (model: AiGatewayModel): ModelData => {
  const tags = model.tags ?? [];
  // A missing positive tag does not establish that a language model rejects tools.
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
