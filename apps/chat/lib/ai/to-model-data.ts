import type { AiGatewayModel } from "@chat-js/gateways/models";

import type { ModelData } from "./model-data";

export const toModelData = (model: AiGatewayModel): ModelData => {
  const tags = model.tags ?? [];

  return {
    id: model.id,
    object: model.object,
    owned_by: model.owned_by,
    name: model.name,
    description: model.description,
    type: model.type,
    tags: model.tags,
    context_window: model.context_window,
    max_tokens: model.max_tokens,
    pricing: model.pricing,
    reasoning: tags.includes("reasoning"),
    toolCall: tags.includes("tool-use"),
    input: {
      image: tags.includes("vision") || model.type === "image",
      text: model.type === "language",
      pdf: tags.includes("file-input"),
      video: false,
      audio: false,
    },
    output: {
      image: tags.includes("image-generation") || model.type === "image",
      text: model.type === "language",
      audio: false,
      video: model.type === "video",
    },
  };
};
