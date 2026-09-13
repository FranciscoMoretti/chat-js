/**
 * Filters out reasoning parts from messages before sending to LLM.
 * Prevents cross-model compatibility issues.
 * https://github.com/vercel/ai/discussions/5480
 *
 * Note: data-* parts are handled by convertToModelMessages({ convertDataPart: () => undefined })
 */
export const filterPartsForLLM = <T extends { parts: { type: string }[] }>(
  messages: T[]
): T[] =>
  messages.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => part.type !== "reasoning"),
  }));
