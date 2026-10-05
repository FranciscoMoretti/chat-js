import { defaultMessageReducer } from "eve/client";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  EveMessage,
  EveMessagePart,
  MessageStreamEvent,
} from "eve/client";
/* oxlint-enable sort-imports */

import { eveMessageTool, eveToolMetadata } from "./message-tool-selection";
import { responseModelReferences } from "./response-model";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { hasEveToolReceipt, toolOutputSchema } from "./tool-result";
/* oxlint-enable sort-imports */

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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Shared message input metadata is explicitly optional; assistant messages can have no turn/model identity and use the established empty-string fallback. The app guidance prefers optional chaining.
  const turnId = message.metadata?.turnId ?? "";
  return turnId === ""
    ? // oxlint-disable-next-line oxc/no-optional-chaining -- Shared message input metadata is explicitly optional; assistant messages can have no turn/model identity and use the established empty-string fallback. The app guidance prefers optional chaining.
      (message.metadata?.modelId ?? "")
    : (models.get(turnId) ?? "");
};

/* oxlint-disable max-lines-per-function, max-statements --
 * max-lines-per-function (#510): sharedTool keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): sharedTool keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/**
 * Keep visible tool content, never the owner's approval or runtime identities.
 * @param {Extract< ReadonlyMessageData<EveMessagePart>, { type: "dynamic-tool"; } >} part Native tool state whose display content may be shared.
 * @returns {EveMessagePart} A display part with approval IDs and receipt-only identities removed.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      return { ...base, inputText: part.inputText, state: part.state };
    }
    case "input-available": {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      return { ...base, state: part.state };
    }
    // The read-only UI union requires an ID; this placeholder is not an approval receipt.
    case "approval-requested": {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      return { ...base, approval: { id: "public" }, state: part.state };
    }
    case "approval-responded": {
      return {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      return { ...base, errorText: part.errorText, state: part.state };
    }
    case "output-available": {
      const result = toolOutputSchema.safeParse(part.output);
      if (hasEveToolReceipt(part.output)) {
        if (!result.success) {
          return {
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            ...base,
            errorText:
              "This tool result is unavailable in the shared conversation.",
            state: "output-error",
          };
        }
        return {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...base,
          output: result.data,
          partial: part.partial,
          state: part.state,
        };
      }
      return {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...base,
        output: part.output,
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (part.outputType ? { outputType: part.outputType } : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
        ...(part.outputType ? { outputType: part.outputType } : {}),
        partial: part.partial,
        state: part.state,
      };
    }
    default: {
      return {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing base own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Dynamic-tool display metadata is optional and may lack the EVE input request/response namespace; shared transcript must still project the tool part without prompting/answer text. The app guidance prefers optional chaining.
    const request = part.toolMetadata?.eve?.inputRequest;
    // oxlint-disable-next-line oxc/no-optional-chaining -- Dynamic-tool display metadata is optional and may lack the EVE input request/response namespace; shared transcript must still project the tool part without prompting/answer text. The app guidance prefers optional chaining.
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- An input response can be absent while an input request exists; response text and optionId lookups must not throw when sharing a pending request. The app guidance prefers optional chaining.
      response?.text ??
      // oxlint-disable-next-line oxc/no-optional-chaining -- Request/options can be absent and Array.find can return undefined for an unmatched optionId; preserve omission of nonexistent answer text. The app guidance prefers optional chaining. An input response can be absent while an input request exists; response text and optionId lookups must not throw when sharing a pending request. The app guidance prefers optional chaining.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (selectedTool === ""         ? {}         : { metadata: { custom: eveToolMetadata(selectedTool) } }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
      ...(selectedTool === ""
        ? {}
        : { metadata: { custom: eveToolMetadata(selectedTool) } }),
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (modelId === "" ? {} : { metadata: { modelId } }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
      ...(modelId === "" ? {} : { metadata: { modelId } }),
      id: message.id,
      parts: message.parts.flatMap(sharedEvePart),
      role: message.role,
    };
  });
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (sharedEveMessages, sharedEvePart); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { sharedEveMessages, sharedEvePart };
/* oxlint-enable import/no-named-export */
