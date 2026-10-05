import { defaultMessageReducer } from "eve/client";
import type {
  EveMessage,
  EveMessagePart,
  MessageStreamEvent,
} from "eve/client";

import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
import { responseModelReferences } from "./response-model";
import { toolOutputSchema, hasEveToolReceipt } from "./tool-result";

// This local view only covers EVE's plain message data; opaque tool values stay unknown.
type ReadonlyMessageData<Value> = Value extends object
  ? { readonly [Property in keyof Value]: ReadonlyMessageData<Value[Property]> }
  : Value;

const EMPTY_OPTION_COUNT = 0;

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
    readonly metadata?: Pick<
      NonNullable<EveMessage["metadata"]>,
      "modelId" | "turnId"
    >;
  },
  models: Readonly<Pick<ReadonlyMap<string, string>, "get">>
): string => {
  if (message.role !== "assistant") {
    return "";
  }
  const turnId = message.metadata?.turnId ?? "";
  return turnId === ""
    ? (message.metadata?.modelId ?? "")
    : (models.get(turnId) ?? "");
};

/* oxlint-disable max-lines-per-function, max-statements --
 * max-lines-per-function (#510): sharedTool keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): sharedTool keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/**
 * Keep visible tool content, never the owner's approval or runtime identities.
 * @param part Native tool state whose display content may be shared.
 * @returns A display part with approval IDs and receipt-only identities removed.
 */
const sharedTool = (
  part: Extract<
    ReadonlyMessageData<EveMessagePart>,
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
      const result = toolOutputSchema.safeParse(part.output);
      if (hasEveToolReceipt(part.output)) {
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
        ...(part.outputType ? { outputType: part.outputType } : {}),
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
/* oxlint-enable max-lines-per-function, max-statements */

/* oxlint-disable max-statements -- max-statements (#512): sharedEvePart keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const sharedEvePart = (
  part: ReadonlyMessageData<EveMessagePart>
): EveMessagePart[] => {
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
      if (request.options && request.options.length > EMPTY_OPTION_COUNT) {
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
    if (typeof answer === "string" && answer !== "") {
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
/* oxlint-enable max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): sharedEveMessages accepts events: readonly MessageStreamEvent[]; current; event; message; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const sharedEveMessages = (
  events: readonly MessageStreamEvent[]
): SharedEveMessage[] => {
  const reducer = defaultMessageReducer();
  const reduceEvent = reducer.reduce.bind(reducer);
  // oxlint-disable-next-line unicorn/no-array-reduce -- Use EVE’s native event reducer and initial state for this projection.
  const state = events.reduce(
    (current, event) => reduceEvent(current, event),
    reducer.initial()
  );
  const models = responseModelReferences(events);
  // oxlint-disable-next-line oxc/no-map-spread -- #541: Decorate materialized transcript messages without mutating the reducer state.
  return state.messages.map((message): SharedEveMessage => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { sharedEveMessages, sharedEvePart };
