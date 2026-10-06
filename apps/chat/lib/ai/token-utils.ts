import type { ModelMessage, SystemModelMessage, ToolModelMessage } from "ai";
import { getEncoding } from "js-tiktoken";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { RecursiveCharacterTextSplitter } from "./text-splitter";
/* oxlint-enable sort-imports */

const MinChunkSize = 140;
const NON_TEXT_PART_TOKEN_ESTIMATE = 765;
const MESSAGE_WRAPPER_TOKEN_OVERHEAD = 5;
const ESTIMATED_CHARACTERS_PER_TOKEN = 3;
const encoder = getEncoding("o200k_base");

/* oxlint-disable typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
typescript/prefer-readonly-parameter-types (#565): calculateMessagesTokens accepts messages: ModelMessage[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
// Calculate total tokens from messages
const calculateMessagesTokens = (messages: ModelMessage[]): number => {
  let totalTokens = 0;

  for (const message of messages) {
    // Count tokens for role
    totalTokens += encoder.encode(message.role).length;

    // Count tokens for content - handle both string and array formats
    if (typeof message.content === "string") {
      totalTokens += encoder.encode(message.content).length;
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        // Add overhead for other part types (image, file, etc.)
        // Using GPT-4V approximation: ~765 tokens for typical image
        totalTokens +=
          // oxlint-disable-next-line no-ternary -- Keep += operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          part.type === "text"
            ? encoder.encode(part.text).length
            : NON_TEXT_PART_TOKEN_ESTIMATE;
      }
    }

    // Add overhead for message structure (role, content wrapper, etc.)
    totalTokens += MESSAGE_WRAPPER_TOKEN_OVERHEAD;
  }

  return totalTokens;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): trimPrompt keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): trimPrompt uses 3, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
// Trim the prompt to the maximum context size.
const trimPrompt = (prompt: string, contextSize: number): string => {
  if (!prompt) {
    return "";
  }

  const { length } = encoder.encode(prompt);
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // On average, each token uses 3 characters; multiply by 3 to estimate the character count.
  const chunkSize =
    prompt.length - overflowTokens * ESTIMATED_CHARACTERS_PER_TOKEN;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkOverlap: 0,
    chunkSize,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? "";

  // As a final check, the trimmed prompt may match the original length; hard cut it in that case.
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // Recursively trim until the prompt is within the context size.
  return trimPrompt(trimmedPrompt, contextSize);
};
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * no-magic-numbers (#517): extractSystemMessage uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): extractSystemMessage accepts messages: ModelMessage[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): extractSystemMessage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const extractSystemMessage = (
  messages: ModelMessage[],
  preserveSystemMessage: boolean
): {
  systemMessage: SystemModelMessage | null;
  otherMessages: ModelMessage[];
} => {
  const systemMessage =
    // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading role from messages[0]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep systemMessage as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    preserveSystemMessage && messages[0]?.role === "system"
      ? messages[0]
      : null;
  // oxlint-disable-next-line no-ternary -- Keep otherMessages as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const otherMessages = systemMessage ? messages.slice(1) : messages;
  return { otherMessages, systemMessage };
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): handleExceededSystemMessage accepts systemMessage: SystemModelMessage | null; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const handleExceededSystemMessage = (
  systemMessage: SystemModelMessage | null,
  maxTokens: number
): ModelMessage[] => {
  if (!systemMessage) {
    return [];
  }

  if (typeof systemMessage.content === "string") {
    const truncatedContent = trimPrompt(systemMessage.content, maxTokens);
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing systemMessage own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    return [{ ...systemMessage, content: truncatedContent }];
  }

  return [systemMessage];
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): removeOldestMessagesUntilFit uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): removeOldestMessagesUntilFit accepts messages: ModelMessage[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const removeOldestMessagesUntilFit = (
  messages: ModelMessage[],
  availableTokens: number
): ModelMessage[] => {
  const truncatedMessages = [...messages];
  let currentTokens = calculateMessagesTokens(truncatedMessages);

  while (currentTokens > availableTokens && truncatedMessages.length > 0) {
    truncatedMessages.shift();
    currentTokens = calculateMessagesTokens(truncatedMessages);
  }

  return truncatedMessages;
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): truncateStringContent uses 4, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): truncateStringContent accepts lastMessage: Exclude<ModelMessage, ToolModelMessage>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const truncateStringContent = (
  lastMessage: Exclude<ModelMessage, ToolModelMessage>,
  availableTokens: number,
  currentTokens: number
): ModelMessage => {
  const tokensToRemove = currentTokens - availableTokens;
  const charsToRemove = tokensToRemove * 4;
  if (typeof lastMessage.content !== "string") {
    return lastMessage;
  }
  const truncatedContent = lastMessage.content.slice(0, -charsToRemove);
  const trimmedContent = trimPrompt(truncatedContent, availableTokens);

  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing lastMessage own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return { ...lastMessage, content: trimmedContent };
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * no-magic-numbers (#517): truncateToolResultPart uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): truncateToolResultPart accepts part: ToolModelMessage["content"][number]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): truncateToolResultPart intentionally keeps the existing falsy-value behavior of part.output; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): truncateToolResultPart preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const truncateToolResultPart = (
  part: ToolModelMessage["content"][number],
  tokensToRemove: number
): {
  truncatedPart: ToolModelMessage["content"][number] | null;
  tokensRemoved: number;
} => {
  if (
    part.type !== "tool-result" ||
    !part.output ||
    typeof part.output !== "object" ||
    !("value" in part.output) ||
    typeof part.output.value !== "string"
  ) {
    return { tokensRemoved: 0, truncatedPart: part };
  }

  const partTokens = encoder.encode(part.output.value).length;
  if (partTokens > 0) {
    const targetTokens = Math.max(0, partTokens - tokensToRemove);
    return {
      tokensRemoved: partTokens - targetTokens,
      truncatedPart: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing part own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...part,
        output: {
          type: "text",
          value: trimPrompt(part.output.value, targetTokens),
        },
      },
    };
  }

  return { tokensRemoved: partTokens, truncatedPart: null };
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): truncateToolArrayContent keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): truncateToolArrayContent uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): truncateToolArrayContent accepts lastMessage: ToolModelMessage; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const truncateToolArrayContent = (
  lastMessage: ToolModelMessage,
  availableTokens: number
): ModelMessage => {
  const content = [...lastMessage.content];
  const currentMessageTokens = calculateMessagesTokens([lastMessage]);
  let tokensToRemove = currentMessageTokens - availableTokens;

  for (
    let index = content.length - 1;
    index >= 0 && tokensToRemove > 0;
    index -= 1
  ) {
    const part = content[index];
    const { truncatedPart, tokensRemoved } = truncateToolResultPart(
      part,
      tokensToRemove
    );

    if (truncatedPart === null) {
      content.splice(index, 1);
    } else {
      content[index] = truncatedPart;
    }
    tokensToRemove -= tokensRemoved;
  }

  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing lastMessage own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return { ...lastMessage, content };
};
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): truncateLastMessageIfNeeded uses 0, -1, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): truncateLastMessageIfNeeded accepts truncatedMessages: ModelMessage[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const truncateLastMessageIfNeeded = (
  truncatedMessages: ModelMessage[],
  availableTokens: number,
  currentTokens: number
): void => {
  if (currentTokens <= availableTokens || truncatedMessages.length === 0) {
    return;
  }

  const lastMessage = truncatedMessages.at(-1);
  if (!lastMessage) {
    return;
  }

  if (typeof lastMessage.content === "string" && lastMessage.role !== "tool") {
    truncatedMessages[truncatedMessages.length - 1] = truncateStringContent(
      lastMessage,
      availableTokens,
      currentTokens
    );
  } else if (
    Array.isArray(lastMessage.content) &&
    lastMessage.role === "tool"
  ) {
    truncatedMessages[truncatedMessages.length - 1] = truncateToolArrayContent(
      lastMessage,
      availableTokens
    );
  }
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types -- max-statements (#512): truncateMessages keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): truncateMessages uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): truncateMessages accepts messages: ModelMessage[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
// Truncate messages array to fit within token limit
const truncateMessages = (
  messages: ModelMessage[],
  maxTokens: number,
  preserveSystemMessage = true
): ModelMessage[] => {
  if (messages.length === 0) {
    return messages;
  }

  const { systemMessage, otherMessages } = extractSystemMessage(
    messages,
    preserveSystemMessage
  );

  // oxlint-disable-next-line no-ternary -- Keep systemTokens as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const systemTokens = systemMessage
    ? calculateMessagesTokens([systemMessage])
    : 0;
  const availableTokens = maxTokens - systemTokens;

  if (availableTokens <= 0) {
    return handleExceededSystemMessage(systemMessage, maxTokens);
  }

  const truncatedMessages = removeOldestMessagesUntilFit(
    otherMessages,
    availableTokens
  );
  const currentTokens = calculateMessagesTokens(truncatedMessages);

  truncateLastMessageIfNeeded(
    truncatedMessages,
    availableTokens,
    currentTokens
  );

  if (systemMessage) {
    return [systemMessage, ...truncatedMessages];
  }
  return truncatedMessages;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (calculateMessagesTokens, truncateMessages); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */
export { calculateMessagesTokens, truncateMessages };
/* oxlint-enable import/no-named-export */
