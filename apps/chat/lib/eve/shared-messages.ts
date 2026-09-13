import {
  defaultMessageReducer,
  type EveMessagePart,
  type MessageStreamEvent,
} from "eve/client";

import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
import { evePlatformOutput, isEvePlatformTool } from "./platform-result";
import { responseModelReferences } from "./response-model";

/** Keep visible tool content, never the owner's approval or runtime identities. */
function sharedTool(
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>
): EveMessagePart {
  const base: Pick<typeof part, "type" | "toolCallId" | "toolName" | "input"> =
    {
      type: "dynamic-tool",
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      input: part.input,
    };
  switch (part.state) {
    case "input-streaming":
      return { ...base, state: part.state, inputText: part.inputText };
    case "input-available":
      return { ...base, state: part.state };
    // The read-only UI union requires an ID; this placeholder is not an approval receipt.
    case "approval-requested":
      return { ...base, state: part.state, approval: { id: "public" } };
    case "approval-responded":
      return {
        ...base,
        state: part.state,
        approval: {
          id: "public",
          approved: part.approval.approved,
          reason: part.approval.reason,
        },
      };
    case "output-denied":
      return {
        ...base,
        state: part.state,
        approval: {
          id: "public",
          approved: false,
          reason: part.approval.reason,
        },
      };
    case "output-error":
      return { ...base, state: part.state, errorText: part.errorText };
    case "output-available": {
      if (isEvePlatformTool(part.toolName)) {
        const result = evePlatformOutput.safeParse(part.output);
        if (!result.success) {
          return {
            ...base,
            state: "output-error",
            errorText:
              "This tool result is unavailable in the shared conversation.",
          };
        }
        return {
          ...base,
          state: part.state,
          output: result.data,
          partial: part.partial,
        };
      }
      return {
        ...base,
        state: part.state,
        output: part.output,
        partial: part.partial,
      };
    }
    default:
      return {
        ...base,
        state: "output-error",
        errorText: "This tool state is unavailable in the shared conversation.",
      };
  }
}

export function sharedEvePart(part: EveMessagePart): EveMessagePart[] {
  if (part.type === "text" || part.type === "reasoning") {
    return [{ type: part.type, text: part.text, state: part.state }];
  }
  if (part.type === "file") {
    return [
      {
        type: "file",
        filename: part.filename,
        mediaType: part.mediaType,
        url: part.url,
        size: part.size,
      },
    ];
  }
  if (part.type === "dynamic-tool") {
    const parts: EveMessagePart[] = [sharedTool(part)];
    const request = part.toolMetadata?.eve?.inputRequest;
    const response = part.toolMetadata?.eve?.inputResponse;
    if (request) {
      parts.push({ type: "text", text: request.prompt });
      if (request.options?.length) {
        parts.push({
          type: "text",
          text: request.options.map((option) => option.label).join(" · "),
        });
      }
    }
    const answer =
      response?.text ??
      request?.options?.find((option) => option.id === response?.optionId)
        ?.label;
    if (answer) {
      parts.push({ type: "text", text: `Response: ${answer}` });
    }
    return parts;
  }
  if (part.type === "step-start") {
    return [{ type: "step-start" }];
  }
  // Connection challenges can contain owner-only authorization URLs and codes.
  return [{ type: "text", text: "An account connection was requested." }];
}

export function sharedEveMessages(events: readonly MessageStreamEvent[]) {
  const reducer = defaultMessageReducer();
  const state = events.reduce(reducer.reduce, reducer.initial());
  const models = responseModelReferences(events);
  return state.messages.map((message) => {
    let modelId: string | undefined;
    if (message.role === "assistant") {
      modelId = message.metadata?.turnId
        ? models.get(message.metadata.turnId)
        : message.metadata?.modelId;
    }
    const selectedTool =
      message.role === "user" ? eveMessageTool(message) : null;
    return {
      ...(selectedTool
        ? { metadata: { custom: eveToolMetadata(selectedTool) } }
        : {}),
      ...(modelId ? { metadata: { modelId } } : {}),
      id: message.id,
      role: message.role,
      parts: message.parts.flatMap(sharedEvePart),
    };
  });
}
