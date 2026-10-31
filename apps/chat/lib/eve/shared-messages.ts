import type {
  EveMessage,
  EveMessagePart,
  SessionStreamEvent,
} from "eve/client";
import type {
  ReadonlyEveMessage,
  ReadonlyEveMessageMetadata,
  ReadonlyEveMessagePart,
} from "@/lib/eve/readonly-message-types";
import { conversationOf } from "eve/client";
import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
import { hasEveToolReceipt, toolOutputSchema } from "./tool-result";
import { projectEveMessageDisplay } from "./message-display";
import type { EveMessageDisplayReceipt } from "./message-display";
import { responseModelReferences } from "./response-model";

interface SharedEveMessage {
  id: string;
  parts: EveMessagePart[];
  role: EveMessage["role"];
  metadata?:
    | { custom: ReturnType<typeof eveToolMetadata>; modelId?: undefined }
    | { modelId: string; custom?: undefined };
}

const sharedModelId = (
  message: Pick<EveMessage, "role"> & {
    readonly metadata?: Pick<ReadonlyEveMessageMetadata, "modelId" | "turnId">;
  },
  models: Readonly<Pick<ReadonlyMap<string, string>, "get">>
): string => {
  if (message.role !== "assistant") {
    return "";
  }
  const turnId = message.metadata?.turnId ?? "";
  if (turnId === "") {
    return message.metadata?.modelId ?? "";
  }
  return models.get(turnId) ?? "";
};

/**
 * Keep visible tool content, never the owner's approval or runtime identities.
 * @param {ReadonlyNativeSurface<EveDynamicToolPart>} part Native tool state whose display content may be shared.
 * @returns {EveMessagePart} A display part with approval IDs and receipt-only identities removed.
 */
const sharedTool = (
  part: Extract<ReadonlyEveMessagePart, { type: "tool" }>
): EveMessagePart => {
  const { interaction: _interaction, ...publicPart } = part;
  if (part.state !== "completed" || !hasEveToolReceipt(part.output)) {
    return publicPart;
  }
  const result = toolOutputSchema.safeParse(part.output);
  if (!result.success) {
    return {
      type: "text",
      text: "This tool result is unavailable in the shared conversation.",
    };
  }
  return {
    type: "tool",
    callId: part.callId,
    name: part.name,
    label: part.label,
    kind: part.kind,
    stepIndex: part.stepIndex,
    input: part.input,
    state: "completed",
    output: result.data,
  };
};

const sharedEvePart = (part: ReadonlyEveMessagePart): EveMessagePart[] => {
  if (part.type === "text" || part.type === "reasoning") {
    return [{ state: part.state, text: part.text, type: part.type }];
  }
  if (part.type === "file") {
    return [
      {
        filename: part.filename,
        mediaType: part.mediaType,
        size: part.size,
        type: "file",
        url: part.url,
      },
    ];
  }
  if (part.type === "tool") {
    const parts: EveMessagePart[] = [sharedTool(part)];
    if (part.interaction?.request.kind === "question") {
      parts.push({ type: "text", text: part.interaction.request.prompt });
      if (part.interaction.answer?.text !== undefined) {
        parts.push({
          type: "text",
          text: `Response: ${part.interaction.answer.text}`,
        });
      }
    }
    return parts;
  }
  // Connection challenges can contain owner-only authorization URLs and codes.
  return [{ text: "An account connection was requested.", type: "text" }];
};

const sharedEveMessages = (
  events: readonly SessionStreamEvent[],
  receipts: readonly EveMessageDisplayReceipt[] = []
): SharedEveMessage[] => {
  let state = conversationOf(events);
  state = projectEveMessageDisplay(state, events, receipts);
  const models = responseModelReferences(events);
  return state.messages.map((message: ReadonlyEveMessage): SharedEveMessage => {
    const modelId = sharedModelId(message, models);
    const selectedTool =
      message.role === "user" ? (eveMessageTool(message) ?? "") : "";
    return {
      ...(selectedTool === ""
        ? {}
        : { metadata: { custom: eveToolMetadata(selectedTool) } }),
      ...(modelId === "" ? {} : { metadata: { modelId } }),
      id: message.id,
      parts: message.parts.flatMap(sharedEvePart),
      role: message.role,
    };
  });
};
export { sharedEveMessages, sharedEvePart };
