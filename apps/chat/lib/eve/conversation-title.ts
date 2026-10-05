import { generateText } from "ai";

import { getLanguageModel } from "@/lib/ai/providers";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { chatTelemetry } from "@/lib/ai/telemetry";
/* oxlint-enable sort-imports */
import { config } from "@/lib/config";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  isEveRootTitlePending,
  replaceEveRootFallbackTitle,
  settleEveRootFallbackTitle,
} from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */
import { createModuleLogger } from "@/lib/logger";

import { eveMessageTitle } from "./message-input";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyEveMessageInput } from "./readonly-message-types";
/* oxlint-enable sort-imports */

const EVE_TITLE_MAX_LENGTH = 40;
const TITLE_START_INDEX = 0;
const WORD_BOUNDARY_LOOKAHEAD = 1;
const TITLE_GENERATION_TIMEOUT_MS = 15_000;

type EveTitleResult =
  | { source: "generated"; title: string }
  | { source: "fallback"; title: string };

const whitespace = /\s+/gu;
const trailingPunctuation = /[,:;.?!]+$/u;
const surroundingQuotes = /^[\s"'“”‘’]+|[\s"'“”‘’]+$/gu;

const log = createModuleLogger("eve.conversation-title");

const compactTitle = (value: string): string => {
  const normalized = value.replace(whitespace, " ").trim();
  if (normalized.length <= EVE_TITLE_MAX_LENGTH) {
    return normalized.replace(trailingPunctuation, "").trim();
  }
  const shortened = normalized.slice(
    TITLE_START_INDEX,
    EVE_TITLE_MAX_LENGTH + WORD_BOUNDARY_LOOKAHEAD
  );
  const wordBoundary = shortened.lastIndexOf(" ");
  return (
    wordBoundary > TITLE_START_INDEX
      ? shortened.slice(TITLE_START_INDEX, wordBoundary)
      : shortened
  )
    .slice(TITLE_START_INDEX, EVE_TITLE_MAX_LENGTH)
    .replace(trailingPunctuation, "")
    .trim();
};

/**
 * A short visible title is available even when the title provider is unavailable.
 * @param {ReadonlyEveMessageInput} message First user message whose text or attachments provide the fallback title.
 * @returns {string} A compact visible title, or the default title when the message has no usable label.
 */
const eveConversationTitleFallback = (
  message: ReadonlyEveMessageInput
): string => compactTitle(eveMessageTitle(message)) || "New conversation";

const normalizeGeneratedTitle = (title: string): string =>
  compactTitle(title.replace(surroundingQuotes, ""));

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve generateEveConversationTitleResult's awaited sequencing and rejected-Promise behavior. */
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
    return title
      ? { source: "generated", title }
      : { source: "fallback", title: fallback };
  } catch {
    return { source: "fallback", title: fallback };
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve persistGeneratedEveConversationTitle's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements -- max-statements (#512): persistGeneratedEveConversationTitle keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EVE_TITLE_MAX_LENGTH, eveConversationTitleFallback, generateEveConversationTitleResult, persistGeneratedEveConversationTitle); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
export {
  EVE_TITLE_MAX_LENGTH,
  eveConversationTitleFallback,
  generateEveConversationTitleResult,
  persistGeneratedEveConversationTitle,
};
/* oxlint-enable import/no-named-export */
