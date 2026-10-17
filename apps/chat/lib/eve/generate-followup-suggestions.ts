import type { TurnCompletedHookResult } from "eve/hooks";
import { Output, generateText } from "ai";
import type { FollowupContext } from "./followup-context";
import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { eveFollowupSuggestions } from "./followup-suggestions";
import { accountEveModel } from "./model-accounting";
import type { ModelCallScope } from "./model-ledger";
import { resolveEveModel } from "./model-selection";

const FOLLOWUP_TIMEOUT_MS = 15_000;
const log = createModuleLogger("eve.followup-suggestions");

/** Auxiliary receipts are durable before output parsing; suggestion failure never fails the answer. */
export const generateEveFollowupSuggestions = async (
  context: FollowupContext,
  scope: ModelCallScope
): Promise<TurnCompletedHookResult | undefined> => {
  if (
    !(config.ai.tools.followupSuggestions.enabled && context.assistant.trim())
  ) {
    return undefined;
  }
  const modelId = config.ai.tools.followupSuggestions.default;
  try {
    const resolved = await accountEveModel(
      await resolveEveModel(modelId),
      scope
    );
    const result = await generateText({
      model: resolved.model,
      ...resolved.modelOptions,
      abortSignal: AbortSignal.timeout(FOLLOWUP_TIMEOUT_MS),
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
      output: Output.object({ schema: eveFollowupSuggestions }),
    });
    // Usage is captured before reading output: malformed JSON can still cost money.
    return {
      responseMetadata: eveFollowupSuggestions.parse(result.output),
    };
  } catch (error) {
    log.error(
      {
        errorType: error instanceof Error ? error.name : "unknown",
        sessionId: scope.sessionId,
        turnId: scope.turnId,
      },
      "Follow-up generation or receipt persistence failed"
    );
    return undefined;
  }
};
