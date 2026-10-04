import { generateText } from "ai";

import { getLanguageModel } from "@/lib/ai/providers";
import { chatTelemetry } from "@/lib/ai/telemetry";
import { config } from "@/lib/config";
import {
  isEveRootTitlePending,
  replaceEveRootFallbackTitle,
  settleEveRootFallbackTitle,
} from "@/lib/db/eve-queries";
import { createModuleLogger } from "@/lib/logger";

import { eveMessageTitle } from "./message-input";
import type { EveMessageInput } from "./message-input";

const EVE_TITLE_MAX_LENGTH = 40;

type EveTitleResult =
  | { source: "generated"; title: string }
  | { source: "fallback"; title: string };

const whitespace = /\s+/gu;
const trailingPunctuation = /[,:;.?!]+$/u;
const surroundingQuotes = /^[\s"'“”‘’]+|[\s"'“”‘’]+$/gu;

const log = createModuleLogger("eve.conversation-title");

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): compactTitle uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const compactTitle = (value: string): string => {
  const normalized = value.replace(whitespace, " ").trim();
  if (normalized.length <= EVE_TITLE_MAX_LENGTH) {
    return normalized.replace(trailingPunctuation, "").trim();
  }
  const shortened = normalized.slice(0, EVE_TITLE_MAX_LENGTH + 1);
  const wordBoundary = shortened.lastIndexOf(" ");
  return (wordBoundary > 0 ? shortened.slice(0, wordBoundary) : shortened)
    .slice(0, EVE_TITLE_MAX_LENGTH)
    .replace(trailingPunctuation, "")
    .trim();
};
/* oxlint-enable no-magic-numbers */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
typescript/prefer-readonly-parameter-types (#565): eveConversationTitleFallback accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * A short visible title is available even when the title provider is unavailable.
 * @param message First user message whose text or attachments provide the fallback title.
 * @returns A compact visible title, or the default title when the message has no usable label.
 */
const eveConversationTitleFallback = (message: EveMessageInput): string =>
  compactTitle(eveMessageTitle(message)) || "New conversation";
/* oxlint-enable typescript/prefer-readonly-parameter-types */

const normalizeGeneratedTitle = (title: string): string =>
  compactTitle(title.replace(surroundingQuotes, ""));

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- no-magic-numbers (#517): generateEveConversationTitleResult uses 15_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): generateEveConversationTitleResult accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Auxiliary title generation must never prevent a conversation from starting.
 * @param message First user message supplied to the auxiliary title model.
 * @returns A normalized generated title, or its message-derived fallback if generation fails or is empty.
 */
const generateEveConversationTitleResult = async (
  message: EveMessageInput
): Promise<EveTitleResult> => {
  const fallback = eveConversationTitleFallback(message);
  try {
    const { text } = await generateText({
      abortSignal: AbortSignal.timeout(15_000),
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
    return title
      ? { source: "generated", title }
      : { source: "fallback", title: fallback };
  } catch {
    return { source: "fallback", title: fallback };
  }
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types -- max-statements (#512): persistGeneratedEveConversationTitle keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): persistGeneratedEveConversationTitle accepts { conversationId, message, ownerId, }: { conversationId: string; message: EveMessageI; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * The conditional update preserves manual titles and every branch's shared root title.
 * @param options Root conversation and its owner's original message used to check title eligibility.
 * @param options.conversationId Conversation whose shared root title is still pending.
 * @param options.message First user message that defines the fallback title and generation prompt.
 * @param options.ownerId Owner used to scope the eligibility check and conditional update.
 * @returns The generation result when eligible; no result when the title is already settled or eligibility cannot be checked.
 */
const persistGeneratedEveConversationTitle = async ({
  conversationId,
  message,
  ownerId,
}: {
  conversationId: string;
  message: EveMessageInput;
  ownerId: string;
}): Promise<EveTitleResult | undefined> => {
  const fallbackTitle = eveConversationTitleFallback(message);
  try {
    if (
      !(await isEveRootTitlePending(ownerId, conversationId, fallbackTitle))
    ) {
      return;
    }
  } catch (error) {
    log.warn(
      {
        conversationId,
        errorName: error instanceof Error ? error.name : typeof error,
      },
      "Eve title eligibility check failed"
    );
    return;
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
  // oxlint-disable-next-line typescript/consistent-return -- #580: No title is returned when generation is inapplicable; successful generation returns the optional title result.
  return generated;
};
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types */
export {
  EVE_TITLE_MAX_LENGTH,
  eveConversationTitleFallback,
  generateEveConversationTitleResult,
  persistGeneratedEveConversationTitle,
};
