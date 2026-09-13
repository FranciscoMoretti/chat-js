import { generateText, Output } from "ai";
import type { HookModelCall, TurnCompletedHookResult } from "eve/hooks";

import { config } from "../config";
import type { FollowupContext } from "./followup-context";
import { eveFollowupSuggestions } from "./followup-suggestions";
import { resolveEveModel } from "./model-selection";

/** Auxiliary generation belongs to the native turn and never fails its answer. */
export async function generateEveFollowupSuggestions(
  context: FollowupContext
): Promise<TurnCompletedHookResult | undefined> {
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
      // Hidden provider retries would lose per-attempt usage evidence.
      maxRetries: 0,
      maxOutputTokens: 512,
      abortSignal: AbortSignal.timeout(15_000),
      messages: [
        { role: "user", content: context.user },
        { role: "assistant", content: context.assistant },
        {
          role: "user",
          content:
            "What question should I ask next? Return 3 to 5 distinct suggested questions, each at most 80 characters. Use the conversation's language.",
        },
      ],
      output: Output.object({ schema: eveFollowupSuggestions }),
      onStepFinish(step) {
        modelCalls.push({
          modelId,
          usage: step.usage,
          providerMetadata: step.providerMetadata,
        });
      },
    });
    // Usage is captured before reading output: malformed JSON can still cost money.
    return {
      responseMetadata: eveFollowupSuggestions.parse(result.output),
      modelCalls,
    };
  } catch {
    if (attempted && modelCalls.length === 0) {
      modelCalls.push({ modelId, failed: true });
    }
    return { modelCalls };
  }
}
