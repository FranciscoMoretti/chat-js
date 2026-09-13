import { defaultMessageReducer } from "eve/client";
import type { EveMessagePart, MessageStreamEvent } from "eve/client";

import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
import { evePlatformOutput, isEvePlatformTool } from "./platform-result";
import { responseModelReferences } from "./response-model";

/** Keep visible tool content, never the owner's approval or runtime identities. */
const sharedTool = (
  part: Extract<
    EveMessagePart,
    {
      type: "dynamic-tool";
    }
  >
): EveMessagePart => {
  const base: Pick<typeof part, "type" | "toolCallId" | "toolName" | "input"> =
    {
      input: part.input,
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      type: "dynamic-tool",
    };
  switch (part.state) {
    case "input-streaming": {
      return { ...base, inputText: part.inputText, state: part.state };
    }
    case "input-available": {
      return { ...base, state: part.state };
    }
    // The read-only UI union requires an ID; this placeholder is not an approval receipt.
    case "approval-requested": {
      return { ...base, approval: { id: "public" }, state: part.state };
    }
    case "approval-responded": {
      return {
        ...base,
        approval: {
          approved: part.approval.approved,
          id: "public",
          reason: part.approval.reason,
        },
        state: part.state,
      };
    }
    case "output-denied": {
      return {
        ...base,
        approval: {
          approved: false,
          id: "public",
          reason: part.approval.reason,
        },
        state: part.state,
      };
    }
    case "output-error": {
      return { ...base, errorText: part.errorText, state: part.state };
    }
    case "output-available": {
      if (isEvePlatformTool(part.toolName)) {
        const result = evePlatformOutput.safeParse(part.output);
        if (!result.success) {
          return {
            ...base,
            errorText:
              "This tool result is unavailable in the shared conversation.",
            state: "output-error",
          };
        }
        return {
          ...base,
          output: result.data,
          partial: part.partial,
          state: part.state,
        };
      }
      return {
        ...base,
        output: part.output,
        partial: part.partial,
        state: part.state,
      };
    }
    default: {
      return {
        ...base,
        errorText: "This tool state is unavailable in the shared conversation.",
        state: "output-error",
      };
    }
  }
};

export const sharedEvePart = (part: EveMessagePart): EveMessagePart[] => {
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
  if (part.type === "dynamic-tool") {
    const parts: EveMessagePart[] = [sharedTool(part)];
    const request = part.toolMetadata?.eve?.inputRequest;
    const response = part.toolMetadata?.eve?.inputResponse;
    if (request) {
      parts.push({ text: request.prompt, type: "text" });
      if (request.options?.length) {
        parts.push({
          text: request.options.map((option) => option.label).join(" · "),
          type: "text",
        });
      }
    }
    const answer =
      response?.text ??
      request?.options?.find((option) => option.id === response?.optionId)
        ?.label;
    if (answer) {
      parts.push({ text: `Response: ${answer}`, type: "text" });
    }
    return parts;
  }
  if (part.type === "step-start") {
    return [{ type: "step-start" }];
  }
  // Connection challenges can contain owner-only authorization URLs and codes.
  return [{ text: "An account connection was requested.", type: "text" }];
};

export const sharedEveMessages = (events: readonly MessageStreamEvent[]) => {
  const reducer = defaultMessageReducer();
  // oxlint-disable-next-line unicorn/no-array-reduce -- Use EVE’s native event reducer and initial state for this projection.
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
      parts: message.parts.flatMap(sharedEvePart),
      role: message.role,
    };
  });
};
