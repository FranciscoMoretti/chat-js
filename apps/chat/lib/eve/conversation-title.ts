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

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): EVE_TITLE_MAX_LENGTH is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): EVE_TITLE_MAX_LENGTH stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const EVE_TITLE_MAX_LENGTH = 40;
/* oxlint-enable import/exports-last, import/group-exports */

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

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types --
 * import/exports-last (#522): eveConversationTitleFallback is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): eveConversationTitleFallback stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): eveConversationTitleFallback's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveConversationTitleFallback's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/prefer-readonly-parameter-types (#565): eveConversationTitleFallback accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** A short visible title is available even when the title provider is unavailable. */
export const eveConversationTitleFallback = (
  message: EveMessageInput
): string => compactTitle(eveMessageTitle(message)) || "New conversation";
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */

const normalizeGeneratedTitle = (title: string): string =>
  compactTitle(title.replace(surroundingQuotes, ""));

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): generateEveConversationTitleResult stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): generateEveConversationTitleResult's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): generateEveConversationTitleResult's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): generateEveConversationTitleResult uses 15_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep generateEveConversationTitleResult's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep generateEveConversationTitleResult's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): generateEveConversationTitleResult accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): persistGeneratedEveConversationTitle stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): persistGeneratedEveConversationTitle's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): persistGeneratedEveConversationTitle's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): persistGeneratedEveConversationTitle keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep persistGeneratedEveConversationTitle's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep persistGeneratedEveConversationTitle's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): persistGeneratedEveConversationTitle accepts { conversationId, message, ownerId, }: { conversationId: string; message: EveMessageI; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
  // oxlint-disable-next-line typescript/consistent-return -- #580: No title is returned when generation is inapplicable; successful generation returns the optional title result.
  return generated;
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
