import { defineDynamic } from "eve/models";
import { defineState } from "eve/context";
import { wrapLanguageModel } from "ai";
import {
  getConfiguredWebChatModel,
  isWebChatModelAllowed,
} from "@/lib/ai/web-chat-models";
import { isAccountSession } from "./session-identity";
import { installedToolAvailabilityMiddleware } from "./tool-availability";

const selectedModel = defineState<{ modelId?: string }>(
  "chatjs.turn-model",
  () => ({})
);

/** Web application model selection and optional billing; native callers use EVE directly. */
export const applicationModel = (model: string, allowWebSelection = true) =>
  defineDynamic(async (context) => {
    if (!isAccountSession(context.session)) {
      if (
        context.session.auth.initiator?.authenticator?.startsWith("chatjs-") !==
        true
      ) {
        return model;
      }
      const { findSessionProfile } = await import("./session-profile");
      return await (findSessionProfile(context.session)?.resolveModel?.(
        context,
        model
      ) ?? model);
    }
    const requested = allowWebSelection
      ? context.session.auth.current?.attributes.modelId
      : undefined;
    if (typeof requested === "string") {
      if (!isWebChatModelAllowed(requested)) {
        throw new Error("This model is not enabled for web chat.");
      }
      selectedModel.update(() => ({ modelId: requested }));
    }
    const { billing } = await import("@/integrations/billing");
    const { loadDefaultEveWebModelId, resolveEveModel } =
      await import("./model-selection");
    const retainedModel = allowWebSelection
      ? selectedModel.get().modelId
      : undefined;
    let modelId = model;
    if (allowWebSelection) {
      modelId =
        retainedModel !== undefined && isWebChatModelAllowed(retainedModel)
          ? retainedModel
          : await loadDefaultEveWebModelId(getConfiguredWebChatModel(model));
    }
    let resolved;
    if (billing.debit === undefined) {
      resolved = await resolveEveModel(modelId);
    } else {
      const { resolveAccountedEveModel } = await import("./model-accounting");
      resolved = await resolveAccountedEveModel(modelId, context);
    }
    return {
      ...resolved,
      model: wrapLanguageModel({
        middleware: installedToolAvailabilityMiddleware(context.session),
        model: resolved.model,
      }),
    };
  });
