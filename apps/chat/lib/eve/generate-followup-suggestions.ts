import { generateText, Output } from "ai";
import type { HookModelCall, TurnCompletedHookResult } from "eve/hooks";

import { config } from "../config";
import type { FollowupContext } from "./followup-context";
import { eveFollowupSuggestions } from "./followup-suggestions";
import { resolveEveModel } from "./model-selection";

/** Auxiliary generation belongs to the native turn and never fails its answer. */
export const generateEveFollowupSuggestions = async (
  context: FollowupContext
): Promise<TurnCompletedHookResult | undefined> => {
  if (
    !(config.ai.tools.followupSuggestions.enabled && context.assistant.trim())
  ) {
    return;
  }
  const modelId = config.ai.tools.followupSuggestions.default;
  const modelCalls: HookModelCall[] = [];
  let attempted = false;
  try {
    const resolved = await resolveEveModel(modelId);
    attempted = true;
    const result = await generateText({
      model: resolved.model,
      ...resolved.modelOptions,
      abortSignal: AbortSignal.timeout(15_000),
      maxOutputTokens: 512,
      // Hidden provider retries would lose per-attempt usage evidence.
      maxRetries: 0,
      messages: [
        { content: context.user, role: "user" },
        { content: context.assistant, role: "assistant" },
        {
          content:
            "What question should I ask next? Return 3 to 5 distinct suggested questions, each at most 80 characters. Use the conversation's language.",
          role: "user",
        },
      ],
      onStepFinish(step) {
        modelCalls.push({
          modelId,
          providerMetadata: step.providerMetadata,
          usage: step.usage,
        });
      },
      output: Output.object({ schema: eveFollowupSuggestions }),
    });
    // Usage is captured before reading output: malformed JSON can still cost money.
    return {
      modelCalls,
      responseMetadata: eveFollowupSuggestions.parse(result.output),
    };
  } catch {
    if (attempted && modelCalls.length === 0) {
      modelCalls.push({ failed: true, modelId });
    }
    return { modelCalls };
  }
};
