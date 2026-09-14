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

export const EVE_TITLE_MAX_LENGTH = 40;

const whitespace = /\s+/gu;
const trailingPunctuation = /[,:;.?!]+$/u;
const surroundingQuotes = /^[\s"'“”‘’]+|[\s"'“”‘’]+$/gu;

const log = createModuleLogger("eve.conversation-title");

const compactTitle = (value: string) => {
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

/** A short visible title is available even when the title provider is unavailable. */
export const eveConversationTitleFallback = (message: EveMessageInput) =>
  compactTitle(eveMessageTitle(message)) || "New conversation";

const normalizeGeneratedTitle = (title: string) =>
  compactTitle(title.replace(surroundingQuotes, ""));

/** Auxiliary title generation must never prevent a conversation from starting. */
export const generateEveConversationTitleResult = async (
  message: EveMessageInput
) => {
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
      ? { source: "generated" as const, title }
      : { source: "fallback" as const, title: fallback };
  } catch {
    return { source: "fallback" as const, title: fallback };
  }
};

/** The conditional update preserves manual titles and every branch's shared root title. */
export const persistGeneratedEveConversationTitle = async ({
  conversationId,
  message,
  ownerId,
}: {
  conversationId: string;
  message: EveMessageInput;
  ownerId: string;
}) => {
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
  return generated;
};
