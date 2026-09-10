import {
  defaultMessageReducer,
  type EveMessagePart,
  type MessageStreamEvent,
} from "eve/client";
import { evePlatformOutput } from "./platform-result";

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
    // Tool inputs/results are conversation content; runtime metadata is not.
    const { toolMetadata, ...content } = part;
    let publicPart: EveMessagePart = content;
    if (
      content.state === "output-available" &&
      content.toolName === "codeExecution"
    ) {
      const result = evePlatformOutput.safeParse(content.output);
      if (result.success) {
        publicPart = { ...content, output: result.data };
      }
    }
    const parts: EveMessagePart[] = [publicPart];
    const request = toolMetadata?.eve?.inputRequest;
    const response = toolMetadata?.eve?.inputResponse;
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
    return [part];
  }
  // Connection challenges can contain owner-only authorization URLs and codes.
  return [{ type: "text", text: "An account connection was requested." }];
}

export function sharedEveMessages(events: readonly MessageStreamEvent[]) {
  const reducer = defaultMessageReducer();
  const state = events.reduce(reducer.reduce, reducer.initial());
  return state.messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts.flatMap(sharedEvePart),
  }));
}
