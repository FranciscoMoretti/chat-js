import { claimEveFollowup, finishEveFollowup } from "./followup-queries";
import { Output, generateText } from "ai";
import type { FollowupContext } from "./followup-context";
import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { eveFollowupSuggestions } from "./suggestion-output";
import { accountEveModel } from "@/lib/eve/model-accounting";
import type { ModelCallScope } from "@/lib/eve/model-ledger";
import { resolveEveModel } from "@/lib/eve/model-selection";

const FOLLOWUP_TIMEOUT_MS = 15_000;
const log = createModuleLogger("eve.followup-suggestions");

/** Optional generation is claimed once; failures never fail the completed answer. */
export const generateEveFollowupSuggestions = async (
  context: FollowupContext,
  scope: ModelCallScope & { readonly turnId: string; readonly eventId: string }
): Promise<void> => {
  if (
    !(config.ai.tools.followupSuggestions.enabled && context.assistant.trim())
  ) {
    return undefined;
  }
  const modelId = config.ai.tools.followupSuggestions.default;
  try {
    const chatId = await claimEveFollowup(
      scope.ownerId,
      scope.sessionId,
      scope.turnId,
      scope.eventId
    );
    if (chatId === null) {
      return;
    }
    const resolved = accountEveModel(await resolveEveModel(modelId), scope);
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
    // Attempt receipt capture before parsing: malformed JSON can still cost money.
    await finishEveFollowup(scope.ownerId, chatId, scope.eventId, [
      ...new Set(eveFollowupSuggestions.parse(result.output).suggestions),
    ]);
  } catch (error) {
    log.error(
      {
        eventId: scope.eventId,
        errorType: error instanceof Error ? error.name : "unknown",
        sessionId: scope.sessionId,
        turnId: scope.turnId,
      },
      "Follow-up generation or storage failed"
    );
  }
};
