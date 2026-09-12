import type { DynamicToolUIPart } from "ai";
import { isDataUIPart, isStaticToolUIPart, isToolUIPart } from "ai";

import type { ChatMessage } from "@/lib/ai/types";
import type { Part } from "@/lib/db/schema";

import {
  validateDynamicToolPart,
  validateToolPart,
} from "./message-part-validators";

const createBasePart = (
  messageId: string,
  index: number,
  type: string
): Omit<Part, "id" | "createdAt"> => ({
  data_blob: null,
  data_type: null,
  file_filename: null,
  file_mediaType: null,
  file_url: null,
  messageId,
  order: index,
  providerMetadata: null,
  reasoning_text: null,
  source_document_filename: null,
  source_document_mediaType: null,
  source_document_sourceId: null,
  source_document_title: null,
  source_url_sourceId: null,
  source_url_title: null,
  source_url_url: null,
  text_text: null,
  tool_errorText: null,
  tool_input: null,
  tool_name: null,
  tool_output: null,
  tool_state: null,
  tool_toolCallId: null,
  type,
});

const handleToolPartToDB = (
  part: ChatMessage["parts"][number],
  basePart: Omit<Part, "id" | "createdAt">
): Omit<Part, "id" | "createdAt"> | null => {
  const validationResult = validateToolPart(part);
  if (!validationResult.success) {
    return null;
  }

  const toolPart = validationResult.data;
  basePart.tool_name = toolPart.type.replace("tool-", "");
  basePart.tool_toolCallId = toolPart.toolCallId;
  basePart.tool_state = toolPart.state;

  const hasInputStates = [
    "input-available",
    "output-available",
    "output-error",
    "input-streaming",
  ];
  if (hasInputStates.includes(toolPart.state)) {
    basePart.tool_input = toolPart.input ?? null;
  }

  if (toolPart.state === "output-available") {
    basePart.tool_output = toolPart.output ?? null;
  }

  if (toolPart.state === "output-error") {
    basePart.tool_errorText = toolPart.errorText ?? null;
  }

  return basePart;
};

const handleDynamicToolPartToDB = (
  part: ChatMessage["parts"][number],
  basePart: Omit<Part, "id" | "createdAt">
): Omit<Part, "id" | "createdAt"> | null => {
  const validationResult = validateDynamicToolPart(part);
  if (!validationResult.success) {
    return null;
  }

  const dynamicPart = validationResult.data;
  basePart.tool_name = dynamicPart.toolName;
  basePart.tool_toolCallId = dynamicPart.toolCallId;
  basePart.tool_state = dynamicPart.state;

  const hasInputStates = [
    "input-available",
    "output-available",
    "output-error",
    "input-streaming",
    "approval-requested",
    "approval-responded",
    "output-denied",
  ];
  if (hasInputStates.includes(dynamicPart.state)) {
    basePart.tool_input = dynamicPart.input ?? null;
  }

  if (dynamicPart.state === "output-available") {
    basePart.tool_output = dynamicPart.output ?? null;
  }

  if (dynamicPart.state === "output-error") {
    basePart.tool_errorText = dynamicPart.errorText ?? null;
  }

  return basePart;
};

const handleDefaultPartToDB = (
  part: ChatMessage["parts"][number],
  basePart: Omit<Part, "id" | "createdAt">
): Omit<Part, "id" | "createdAt"> | null => {
  if ((part as { type: string }).type === "tool-invocation") {
    return null;
  }

  if (isToolUIPart(part)) {
    if (isStaticToolUIPart(part)) {
      return handleToolPartToDB(part, basePart);
    }
    return handleDynamicToolPartToDB(part, basePart);
  }

  if (isDataUIPart(part)) {
    basePart.data_type = part.type;
    basePart.data_blob = part.data;
    return basePart;
  }
  throw new Error(`Unsupported part type: ${part.type}`);
};

const mapUIPartToDBPart = (
  part: ChatMessage["parts"][number],
  index: number,
  messageId: string
): Omit<Part, "id" | "createdAt"> | null => {
  const basePart = createBasePart(messageId, index, part.type);

  if ("providerMetadata" in part && part.providerMetadata) {
    basePart.providerMetadata = part.providerMetadata;
  } else if ("callProviderMetadata" in part && part.callProviderMetadata) {
    basePart.providerMetadata = part.callProviderMetadata;
  }

  switch (part.type) {
    case "text": {
      basePart.text_text = part.text;
      return basePart;
    }

    case "reasoning": {
      basePart.reasoning_text = part.text;
      return basePart;
    }

    case "file": {
      basePart.file_mediaType = part.mediaType;
      basePart.file_filename = part.filename ?? null;
      basePart.file_url = part.url;
      return basePart;
    }

    case "source-url": {
      basePart.source_url_sourceId = part.sourceId;
      basePart.source_url_url = part.url;
      basePart.source_url_title = part.title ?? null;
      return basePart;
    }

    case "source-document": {
      basePart.source_document_sourceId = part.sourceId;
      basePart.source_document_mediaType = part.mediaType;
      basePart.source_document_title = part.title;
      basePart.source_document_filename = part.filename ?? null;
      return basePart;
    }

    case "step-start": {
      return basePart;
    }

    default: {
      return handleDefaultPartToDB(part, basePart);
    }
  }
};

/**
 * Maps UI message parts to database Part rows
 * Each UI part becomes a single Part row with prefix-based columns populated
 */
export const mapUIMessagePartsToDBParts = (
  parts: ChatMessage["parts"],
  messageId: string
): Omit<Part, "id" | "createdAt">[] =>
  parts
    .map((part, index) => mapUIPartToDBPart(part, index, messageId))
    .filter((part): part is Omit<Part, "id" | "createdAt"> => part !== null);

const createToolUIPartBase = (part: Part) => ({
  toolCallId: part.tool_toolCallId,
  type: part.type as `tool-${string}`,
});

const mapInputStreamingToolPart = (
  part: Part,
  base: ReturnType<typeof createToolUIPartBase>
): ChatMessage["parts"][number] =>
  ({
    ...base,
    state: "input-streaming" as const,
    ...(part.tool_input !== null && part.tool_input !== undefined
      ? { input: part.tool_input }
      : {}),
  }) as ChatMessage["parts"][number];

const mapInputAvailableToolPart = (
  part: Part,
  base: ReturnType<typeof createToolUIPartBase>
): ChatMessage["parts"][number] =>
  ({
    ...base,
    input: part.tool_input ?? null,
    state: "input-available" as const,
    ...(part.providerMetadata
      ? { callProviderMetadata: part.providerMetadata }
      : {}),
  }) as ChatMessage["parts"][number];

const mapOutputAvailableToolPart = (
  part: Part,
  base: ReturnType<typeof createToolUIPartBase>
): ChatMessage["parts"][number] =>
  ({
    ...base,
    input: part.tool_input ?? null,
    output: part.tool_output ?? null,
    state: "output-available" as const,
    ...(part.providerMetadata
      ? { callProviderMetadata: part.providerMetadata }
      : {}),
  }) as ChatMessage["parts"][number];

const mapOutputErrorToolPart = (
  part: Part,
  base: ReturnType<typeof createToolUIPartBase>
): ChatMessage["parts"][number] =>
  ({
    ...base,
    errorText: part.tool_errorText ?? "",
    input: part.tool_input ?? null,
    state: "output-error" as const,
    ...(part.providerMetadata
      ? { callProviderMetadata: part.providerMetadata }
      : {}),
  }) as ChatMessage["parts"][number];

const mapToolPartToUI = (part: Part): ChatMessage["parts"][number] | null => {
  if (!(part.tool_toolCallId && part.tool_state)) {
    return null;
  }

  const base = createToolUIPartBase(part);

  if (part.tool_state === "input-streaming") {
    return mapInputStreamingToolPart(part, base);
  }

  if (part.tool_state === "input-available") {
    return mapInputAvailableToolPart(part, base);
  }

  if (part.tool_state === "output-available") {
    return mapOutputAvailableToolPart(part, base);
  }

  if (part.tool_state === "output-error") {
    return mapOutputErrorToolPart(part, base);
  }

  return null;
};

const mapDynamicToolPartToUI = (
  part: Part
): ChatMessage["parts"][number] | null => {
  if (!(part.tool_toolCallId && part.tool_state && part.tool_name)) {
    return null;
  }

  const base = {
    toolCallId: part.tool_toolCallId,
    toolName: part.tool_name,
    type: "dynamic-tool" as const,
  };

  if (part.tool_state === "input-streaming") {
    return {
      ...base,
      input: part.tool_input,
      state: "input-streaming" as const,
    } as DynamicToolUIPart;
  }

  if (part.tool_state === "input-available") {
    return {
      ...base,
      input: part.tool_input,
      state: "input-available" as const,
      ...(part.providerMetadata
        ? { callProviderMetadata: part.providerMetadata }
        : {}),
    } as DynamicToolUIPart;
  }

  if (part.tool_state === "output-available") {
    return {
      ...base,
      input: part.tool_input,
      output: part.tool_output,
      state: "output-available" as const,
      ...(part.providerMetadata
        ? { callProviderMetadata: part.providerMetadata }
        : {}),
    } as DynamicToolUIPart;
  }

  if (part.tool_state === "output-error") {
    return {
      ...base,
      errorText: part.tool_errorText ?? "",
      input: part.tool_input,
      state: "output-error" as const,
      ...(part.providerMetadata
        ? { callProviderMetadata: part.providerMetadata }
        : {}),
    } as DynamicToolUIPart;
  }

  return null;
};

const mapDataPartToUI = (part: Part): ChatMessage["parts"][number] | null => {
  if (part.data_type && part.data_blob) {
    return {
      data: part.data_blob,
      type: part.type as `data-${string}`,
    } as ChatMessage["parts"][number];
  }
  if (part.data_blob) {
    return part.data_blob as ChatMessage["parts"][number];
  }
  return null;
};

const mapSourceUrlToUI = (part: Part): ChatMessage["parts"][number] => {
  const result: ChatMessage["parts"][number] = {
    sourceId: part.source_url_sourceId ?? "",
    type: "source-url" as const,
    url: part.source_url_url ?? "",
  };
  if (part.source_url_title) {
    (result as { title?: string }).title = part.source_url_title;
  }
  if (part.providerMetadata) {
    (result as { providerMetadata?: unknown }).providerMetadata =
      part.providerMetadata;
  }
  return result;
};

const mapSourceDocumentToUI = (part: Part): ChatMessage["parts"][number] => {
  const result: ChatMessage["parts"][number] = {
    mediaType: part.source_document_mediaType ?? "",
    sourceId: part.source_document_sourceId ?? "",
    title: part.source_document_title ?? "",
    type: "source-document" as const,
  };
  if (part.source_document_filename) {
    (result as { filename?: string }).filename = part.source_document_filename;
  }
  if (part.providerMetadata) {
    (result as { providerMetadata?: unknown }).providerMetadata =
      part.providerMetadata;
  }
  return result;
};

const mapDBPartToUIPart = (part: Part): ChatMessage["parts"][number] | null => {
  switch (part.type) {
    case "text": {
      return {
        text: part.text_text ?? "",
        type: "text" as const,
      };
    }

    case "reasoning": {
      const result: ChatMessage["parts"][number] = {
        text: part.reasoning_text ?? "",
        type: "reasoning" as const,
      };
      if (part.providerMetadata) {
        (result as { providerMetadata?: unknown }).providerMetadata =
          part.providerMetadata;
      }
      return result;
    }

    case "file": {
      return {
        type: "file" as const,
        mediaType: part.file_mediaType ?? "",
        ...(part.file_filename ? { filename: part.file_filename } : {}),
        url: part.file_url ?? "",
      };
    }

    case "source-url": {
      return mapSourceUrlToUI(part);
    }

    case "source-document": {
      return mapSourceDocumentToUI(part);
    }

    case "step-start": {
      return {
        type: "step-start" as const,
      };
    }

    case "dynamic-tool": {
      return mapDynamicToolPartToUI(part);
    }

    default: {
      if (part.type.startsWith("tool-")) {
        return mapToolPartToUI(part);
      }

      if (part.type.startsWith("data-")) {
        return mapDataPartToUI(part);
      }

      throw new Error(`Unsupported part type: ${part.type}`);
    }
  }
};

/**
 * Maps database Part rows back to UI message parts
 * Reconstructs the original ChatMessage parts array from Part rows
 */
export const mapDBPartsToUIParts = (dbParts: Part[]): ChatMessage["parts"] => {
  const parts = dbParts
    .sort((a, b) => a.order - b.order)
    .map(mapDBPartToUIPart);

  return parts.filter(
    (part): part is ChatMessage["parts"][number] => part !== null
  );
};
