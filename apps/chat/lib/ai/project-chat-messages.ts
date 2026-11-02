import { installedToolNames } from "@/integrations/tools/catalog";
import { hasEveToolReceipt, toolOutputSchema } from "@/lib/eve/tool-result";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";
import { isChatToolPart } from "./chat-message";
import type {
  ChatMessage,
  ChatMessageData,
  ChatMessagePart,
  ChatToolPart,
} from "./chat-message";

const messages = new WeakMap<ChatMessage, ChatMessage>();

/** Convert the application receipt without changing Eve's original transport part. */
export const toolDisplayPart = (
  part: Extract<ReadonlyEveMessagePart, { type: "dynamic-tool" }>
) => {
  if (
    part.state !== "output-available" ||
    part.outputType === "text" ||
    !hasEveToolReceipt(part.output)
  ) {
    return part;
  }
  const receipt = toolOutputSchema.safeParse(part.output);
  if (!receipt.success) {
    return null;
  }
  return receipt.data.status === "error"
    ? {
        ...part,
        state: "output-error" as const,
        output: undefined,
        errorText: receipt.data.error,
        updates: receipt.data.updates,
      }
    : { ...part, output: receipt.data.output, updates: receipt.data.updates };
};

/** App-owned tool contracts are trusted here, exactly once, after receipt conversion.
 * This is static enrichment, not validation of historical tool-specific payloads.
 * Installed renderers continue validating their input/output schemas.
 */
export const projectChatMessagePart = (
  part: ChatMessagePart
): ChatMessagePart => {
  if (isChatToolPart(part)) {
    return part;
  }
  if (part.type !== "dynamic-tool" || !installedToolNames.has(part.toolName)) {
    return part;
  }
  if (part.state === "output-available" && part.outputType === "text") {
    return part;
  }
  const display = toolDisplayPart(part);
  if (display === null) {
    return part;
  }
  // Eve erases the name/payload relationship. Runtime membership and receipt
  // conversion above restore our authored contract; this is the sole trust boundary.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Explicit application-owned trust boundary, matching the shared pre-Eve message contract.
  return {
    ...display,
    type: `tool-${part.toolName}`,
    native: part,
  } as ChatToolPart;
};

/** Project immutable native messages once, preserving references across stream updates. */
export const projectChatMessage = (message: ChatMessage): ChatMessage => {
  const cached = messages.get(message);
  if (cached) {
    return cached;
  }
  const parts = message.parts.map(projectChatMessagePart);
  const projected = parts.some(isChatToolPart)
    ? { ...message, parts }
    : message;
  messages.set(message, projected);
  messages.set(projected, projected);
  return projected;
};

const snapshots = new WeakMap<ChatMessageData, ChatMessageData>();

export const projectChatMessages = (data: ChatMessageData): ChatMessageData => {
  const cached = snapshots.get(data);
  if (cached) {
    return cached;
  }
  const projected = {
    ...data,
    messages: data.messages.map(projectChatMessage),
  };
  snapshots.set(data, projected);
  snapshots.set(projected, projected);
  return projected;
};
