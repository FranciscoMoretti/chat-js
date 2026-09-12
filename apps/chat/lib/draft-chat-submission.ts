import type { AppModelId } from "@/lib/ai/app-model-id";
import type {
  Attachment,
  ChatMessage,
  SelectedModelValue,
  UiToolName,
} from "@/lib/ai/types";
import { expandSelectedModelValue } from "@/lib/ai/types";
import { generateUUID } from "@/lib/utils";

export interface ParallelRequestSpec {
  createdAt: Date;
  isPrimary: boolean;
  modelId: AppModelId;
  parallelGroupId: string | null;
  parallelIndex: number;
  requestId: string;
}

export interface DraftChatSubmission {
  message: ChatMessage;
  requestSpecs: ParallelRequestSpec[];
}

export const buildDraftChatSubmission = ({
  attachments,
  input,
  normalizedSelectedModel,
  parallelResponsesEnabled,
  parentMessageId,
  selectedTool,
}: {
  attachments: Attachment[];
  input: string;
  normalizedSelectedModel: SelectedModelValue;
  parallelResponsesEnabled: boolean;
  parentMessageId: string | null;
  selectedTool: UiToolName | null;
}): DraftChatSubmission => {
  const requestedModelIds = expandSelectedModelValue(normalizedSelectedModel);
  const [primaryModelId] = requestedModelIds;

  if (!primaryModelId) {
    throw new Error(
      "Cannot build a draft chat submission without a selected model"
    );
  }

  const isParallelRequest =
    parallelResponsesEnabled && requestedModelIds.length > 1;
  const parallelGroupId = isParallelRequest ? generateUUID() : null;
  const requestSpecs = isParallelRequest
    ? requestedModelIds.map((modelId, parallelIndex): ParallelRequestSpec => ({
        createdAt: new Date(Date.now() + parallelIndex),
        isPrimary: parallelIndex === 0,
        modelId,
        parallelGroupId,
        parallelIndex,
        requestId: generateUUID(),
      }))
    : [
        {
          createdAt: new Date(Date.now()),
          isPrimary: true,
          modelId: primaryModelId,
          parallelGroupId: null,
          parallelIndex: 0,
          requestId: generateUUID(),
        },
      ];

  return {
    message: {
      id: generateUUID(),
      metadata: {
        activeStreamId: null,
        createdAt: new Date(),
        isPrimaryParallel: null,
        parallelGroupId,
        parallelIndex: null,
        parentMessageId,
        selectedModel: normalizedSelectedModel,
        selectedTool: selectedTool || undefined,
      },
      parts: [
        ...attachments.map((attachment) => ({
          mediaType: attachment.contentType,
          name: attachment.name,
          type: "file" as const,
          url: attachment.url,
        })),
        {
          text: input,
          type: "text",
        },
      ],
      role: "user",
    },
    requestSpecs,
  };
};
