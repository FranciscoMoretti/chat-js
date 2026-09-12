import type { ModelMessage } from "ai";
import { getEncoding } from "js-tiktoken";

import { RecursiveCharacterTextSplitter } from "./text-splitter";

const MinChunkSize = 140;
const encoder = getEncoding("o200k_base");

// Calculate total tokens from messages
export const calculateMessagesTokens = (messages: ModelMessage[]): number => {
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
          part.type === "text" ? encoder.encode(part.text).length : 765;
      }
    }

    // Add overhead for message structure (role, content wrapper, etc.)
    totalTokens += 5;
  }

  return totalTokens;
};

// trim prompt to maximum context size
const trimPrompt = (prompt: string, contextSize: number) => {
  if (!prompt) {
    return "";
  }

  const { length } = encoder.encode(prompt);
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // on average it's 3 characters per token, so multiply by 3 to get a rough estimate of the number of characters
  const chunkSize = prompt.length - overflowTokens * 3;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkOverlap: 0,
    chunkSize,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? "";

  // last catch, there's a chance that the trimmed prompt is same length as the original prompt, due to how tokens are split & innerworkings of the splitter, handle this case by just doing a hard cut
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // recursively trim until the prompt is within the context size
  return trimPrompt(trimmedPrompt, contextSize);
};

const extractSystemMessage = (
  messages: ModelMessage[],
  preserveSystemMessage: boolean
): {
  systemMessage: ModelMessage | null;
  otherMessages: ModelMessage[];
} => {
  const systemMessage =
    preserveSystemMessage && messages[0]?.role === "system"
      ? messages[0]
      : null;
  const otherMessages = systemMessage ? messages.slice(1) : messages;
  return { otherMessages, systemMessage };
};

const handleExceededSystemMessage = (
  systemMessage: ModelMessage | null,
  maxTokens: number
): ModelMessage[] => {
  if (!systemMessage) {
    return [];
  }

  if (typeof systemMessage.content === "string") {
    const truncatedContent = trimPrompt(systemMessage.content, maxTokens);
    return [Object.assign({}, systemMessage, { content: truncatedContent })];
  }

  return [systemMessage];
};

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

const truncateStringContent = (
  lastMessage: ModelMessage,
  availableTokens: number,
  currentTokens: number
): ModelMessage => {
  const tokensToRemove = currentTokens - availableTokens;
  const charsToRemove = tokensToRemove * 4;
  const truncatedContent = (lastMessage.content as string).slice(
    0,
    -charsToRemove
  );
  const trimmedContent = trimPrompt(truncatedContent, availableTokens);

  return Object.assign({}, lastMessage, { content: trimmedContent });
};

const truncateToolResultPart = (
  part: {
    type: string;
    output?: {
      value?: string;
    };
  },
  tokensToRemove: number
): {
  truncatedPart: unknown;
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

const truncateToolArrayContent = (
  lastMessage: ModelMessage,
  availableTokens: number
): ModelMessage => {
  const content = [...(lastMessage.content as unknown[])];
  const currentMessageTokens = calculateMessagesTokens([lastMessage]);
  let tokensToRemove = currentMessageTokens - availableTokens;

  for (let i = content.length - 1; i >= 0 && tokensToRemove > 0; i -= 1) {
    const part = content[i];
    const { truncatedPart, tokensRemoved } = truncateToolResultPart(
      part as {
        type: string;
        output?: {
          value?: string;
        };
      },
      tokensToRemove
    );

    if (truncatedPart === null) {
      content.splice(i, 1);
    } else {
      content[i] = truncatedPart;
    }
    tokensToRemove -= tokensRemoved;
  }

  return Object.assign({}, lastMessage, { content });
};

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

// Truncate messages array to fit within token limit
export const truncateMessages = (
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

  return systemMessage
    ? [systemMessage, ...truncatedMessages]
    : truncatedMessages;
};
