import type { AiGatewayModel } from "@chat-js/gateways/models";

import type { ModelData } from "./model-data";

/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, no-undefined, typescript/prefer-readonly-parameter-types --
 * import/no-named-export (#527): Preserve the named toModelData API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): toModelData remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-ternary (#518): toModelData derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): toModelData uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): toModelData accepts model: AiGatewayModel; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, no-undefined, typescript/prefer-readonly-parameter-types */
