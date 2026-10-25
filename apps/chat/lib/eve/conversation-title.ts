import { eveMessageTitle } from "./message-input";
import type { ReadonlyEveMessageInput } from "./readonly-message-types";

const EVE_TITLE_MAX_LENGTH = 40;
const TITLE_START_INDEX = 0;
const WORD_BOUNDARY_LOOKAHEAD = 1;

const whitespace = /\s+/gu;
const trailingPunctuation = /[,:;.?!]+$/u;

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

export { EVE_TITLE_MAX_LENGTH, eveConversationTitleFallback, compactTitle };
