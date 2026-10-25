import { generateText } from "ai";

import { getLanguageModel } from "@/lib/ai/providers";
import { chatTelemetry } from "@/lib/ai/telemetry";
import { config } from "@/lib/config";
import {
  isEveRootTitlePending,
  replaceEveRootFallbackTitle,
  settleEveRootFallbackTitle,
} from "./title-queries";
import { createModuleLogger } from "@/lib/logger";

import {
  compactTitle,
  eveConversationTitleFallback,
} from "@/lib/eve/conversation-title";
import type { ReadonlyEveMessageInput } from "@/lib/eve/readonly-message-types";

const TITLE_GENERATION_TIMEOUT_MS = 15_000;
const surroundingQuotes = /^[\s"'“”‘’]+|[\s"'“”‘’]+$/gu;
const log = createModuleLogger("eve.ai-titles");
type EveTitleResult =
  | { source: "generated"; title: string }
  | { source: "fallback"; title: string };

const normalizeGeneratedTitle = (title: string): string =>
  compactTitle(title.replace(surroundingQuotes, ""));

/**
 * Auxiliary title generation must never prevent a conversation from starting.
 * @param {ReadonlyEveMessageInput} message First user message supplied to the auxiliary title model.
 * @returns {Promise<EveTitleResult>} A normalized generated title, or its message-derived fallback if generation fails or is empty.
 */
const generateEveConversationTitleResult = async (
  message: ReadonlyEveMessageInput
): Promise<EveTitleResult> => {
  const fallback = eveConversationTitleFallback(message);
  try {
    const { text } = await generateText({
      abortSignal: AbortSignal.timeout(TITLE_GENERATION_TIMEOUT_MS),
      instructions: `Generate a concise title for a chat conversation based on the user's first message.

Rules (strictly follow all):
- Maximum 40 characters — hard limit, never exceed this
- 3-6 words is ideal
- No quotes, colons, or punctuation at the end
- No filler words like "How to" or "Question about"
- Use title case
- Return ONLY the title, nothing else`,
      maxRetries: 0,
      model: await getLanguageModel(config.ai.workflows.title),
      prompt: JSON.stringify(message),
      telemetry: { integrations: chatTelemetry, isEnabled: true },
    });
    const title = normalizeGeneratedTitle(text);

    if (title) {
      return { source: "generated", title };
    }
    return { source: "fallback", title: fallback };
  } catch {
    return { source: "fallback", title: fallback };
  }
};
const persistGeneratedEveConversationTitle = async ({
  conversationId,
  message,
  ownerId,
}: Readonly<{
  conversationId: string;
  message: ReadonlyEveMessageInput;
  ownerId: string;
}>): Promise<EveTitleResult | undefined> => {
  const fallbackTitle = eveConversationTitleFallback(message);
  try {
    if (
      !(await isEveRootTitlePending(ownerId, conversationId, fallbackTitle))
    ) {
      return undefined;
    }
  } catch (error) {
    log.warn(
      {
        conversationId,
        errorName: error instanceof Error ? error.name : typeof error,
      },
      "Eve title eligibility check failed"
    );
    return undefined;
  }
  const generated = await generateEveConversationTitleResult(message);
  try {
    await (generated.source === "generated"
      ? replaceEveRootFallbackTitle(
          ownerId,
          conversationId,
          fallbackTitle,
          generated.title
        )
      : settleEveRootFallbackTitle(ownerId, conversationId, fallbackTitle));
  } catch (error) {
    log.warn(
      {
        conversationId,
        errorName: error instanceof Error ? error.name : typeof error,
      },
      "Eve title persistence failed"
    );
  }
  return generated;
};
export {
  generateEveConversationTitleResult,
  persistGeneratedEveConversationTitle,
};
