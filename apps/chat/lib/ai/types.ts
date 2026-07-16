import type {
  InferUITool,
  LanguageModelUsage,
  UIMessage,
  UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import type { codeExecution } from "@/tools/platform/code-execution";
import type { deepResearch } from "@/tools/platform/deep-research/deep-research";
import type { createCodeDocumentTool } from "@/tools/platform/documents/create-code-document";
import type { createSheetDocumentTool } from "@/tools/platform/documents/create-sheet-document";
import type { createTextDocumentTool } from "@/tools/platform/documents/create-text-document";
import type { editCodeDocumentTool } from "@/tools/platform/documents/edit-code-document";
import type { editSheetDocumentTool } from "@/tools/platform/documents/edit-sheet-document";
import type { editTextDocumentTool } from "@/tools/platform/documents/edit-text-document";
import type { generateImageTool as generateImageToolFactory } from "@/tools/platform/generate-image";
import type { generateVideoTool as generateVideoToolFactory } from "@/tools/platform/generate-video";
import type { readDocument } from "@/tools/platform/read-document";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
import type { tavilyWebSearch } from "@/tools/platform/web-search";
import type { AppModelId } from "./app-models";
import type { InstalledTools } from "./installed-tools";

export const toolNameSchema = z.enum([
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
  "readDocument",
  "webSearch",
  "codeExecution",
  "generateImage",
  "generateVideo",
  "deepResearch",
]);

const _ = toolNameSchema.options satisfies ToolName[];

type ToolNameInternal = z.infer<typeof toolNameSchema>;

const frontendToolsSchema = z.enum([
  "webSearch",
  "deepResearch",
  "generateImage",
  "generateVideo",
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
]);

const __ = frontendToolsSchema.options satisfies ToolNameInternal[];

export type UiToolName = z.infer<typeof frontendToolsSchema>;

export type SelectedModelCounts = Partial<Record<AppModelId, number>>;
export type SelectedModelValue = AppModelId | SelectedModelCounts;

export function isSelectedModelCounts(
  value: unknown
): value is SelectedModelCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  if (Object.keys(value).length === 0) {
    return false;
  }

  return Object.entries(value).every(
    ([modelId, count]) =>
      typeof modelId === "string" &&
      typeof count === "number" &&
      Number.isInteger(count) &&
      count > 0
  );
}

export function isSelectedModelValue(
  value: unknown
): value is SelectedModelValue {
  return typeof value === "string" || isSelectedModelCounts(value);
}

export function getPrimarySelectedModelId(
  selectedModel: SelectedModelValue | null | undefined
): AppModelId | null {
  if (!selectedModel) {
    return null;
  }

  if (typeof selectedModel === "string") {
    return selectedModel;
  }

  const [firstSelectedModelId] = Object.entries(selectedModel).find(
    ([, count]) => typeof count === "number" && count > 0
  ) ?? [null];

  return firstSelectedModelId as AppModelId | null;
}

export function expandSelectedModelValue(
  selectedModel: SelectedModelValue
): AppModelId[] {
  if (typeof selectedModel === "string") {
    return [selectedModel];
  }

  const expanded: AppModelId[] = [];

  for (const [modelId, count] of Object.entries(selectedModel)) {
    if (!(typeof count === "number" && Number.isInteger(count) && count > 0)) {
      continue;
    }

    for (let index = 0; index < count; index += 1) {
      expanded.push(modelId as AppModelId);
    }
  }

  return expanded;
}

const messageMetadataSchema = z.object({
  createdAt: z.date(),
  parentMessageId: z.string().nullable(),
  parallelGroupId: z.string().nullable().optional(),
  parallelIndex: z.number().int().nullable().optional(),
  isPrimaryParallel: z.boolean().nullable().optional(),
  selectedModel: z.custom<SelectedModelValue>(isSelectedModelValue),
  activeStreamId: z.string().nullable(),
  selectedTool: frontendToolsSchema.optional(),
  usage: z.custom<LanguageModelUsage | undefined>((_val) => true).optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type createTextDocumentToolType = InferUITool<
  ReturnType<typeof createTextDocumentTool>
>;
type createCodeDocumentToolType = InferUITool<
  ReturnType<typeof createCodeDocumentTool>
>;
type createSheetDocumentToolType = InferUITool<
  ReturnType<typeof createSheetDocumentTool>
>;
type editTextDocumentToolType = InferUITool<
  ReturnType<typeof editTextDocumentTool>
>;
type editCodeDocumentToolType = InferUITool<
  ReturnType<typeof editCodeDocumentTool>
>;
type editSheetDocumentToolType = InferUITool<
  ReturnType<typeof editSheetDocumentTool>
>;
type deepResearchTool = InferUITool<ReturnType<typeof deepResearch>>;
type readDocumentTool = InferUITool<ReturnType<typeof readDocument>>;
type generateImageTool = InferUITool<
  ReturnType<typeof generateImageToolFactory>
>;
type generateVideoTool = InferUITool<
  ReturnType<typeof generateVideoToolFactory>
>;
type webSearchTool = InferUITool<ReturnType<typeof tavilyWebSearch>>;
type codeExecutionTool = InferUITool<ReturnType<typeof codeExecution>>;

export type ChatTools = {
  codeExecution: codeExecutionTool;
  createCodeDocument: createCodeDocumentToolType;
  createSheetDocument: createSheetDocumentToolType;
  createTextDocument: createTextDocumentToolType;
  deepResearch: deepResearchTool;
  editCodeDocument: editCodeDocumentToolType;
  editSheetDocument: editSheetDocumentToolType;
  editTextDocument: editTextDocumentToolType;
  generateImage: generateImageTool;
  generateVideo: generateVideoTool;
  readDocument: readDocumentTool;
  webSearch: webSearchTool;
} & InstalledTools;

interface FollowupSuggestions {
  suggestions: string[];
}

export type CustomUIDataTypes = {
  appendMessage: string;
  userMessagePersisted: {
    chatId: string;
    parallelGroupId: string | null;
    userMessageId: string;
  };
  followupSuggestions: FollowupSuggestions;
  researchUpdate: ResearchUpdate;
};

export type ChatMessage = Omit<
  UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>,
  "metadata"
> & {
  metadata: MessageMetadata;
};

export type ToolName = keyof ChatTools | ToolNameInternal;

export type ToolOutput<T extends keyof ChatTools> = ChatTools[T]["output"];

export type StreamWriter = UIMessageStreamWriter<ChatMessage>;

export interface Attachment {
  contentType: string;
  name: string;
  url: string;
}
