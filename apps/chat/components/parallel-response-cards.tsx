"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNavigateToMessage } from "@/hooks/use-navigate-to-message";
import type { AppModelId } from "@/lib/ai/app-models";
import {
  type ChatMessage,
  expandSelectedModelValue,
  getPrimarySelectedModelId,
} from "@/lib/ai/types";
import { useMessageById } from "@/lib/stores/base";
import { useApplicationThread } from "@/lib/stores/custom-store-provider";
import { useParallelGroupInfo } from "@/lib/stores/hooks-threads";
import { getParallelResponseForSlot } from "@/lib/thread-utils";
import { useChatInput } from "@/providers/chat-input-provider";
import { useChatModels } from "@/providers/chat-models-provider";
import {
  getParallelResponseLifecycle,
  getStatusLabel,
} from "./parallel-response-status";
import { ResponseChoiceCards } from "./response-choice-cards";

function getEffectiveModelId(
  message: {
    metadata: { selectedModel: ChatMessage["metadata"]["selectedModel"] };
  } | null,
  fallbackModelId: AppModelId
): AppModelId | undefined {
  return message?.metadata.selectedModel
    ? (getPrimarySelectedModelId(message.metadata.selectedModel) ?? undefined)
    : fallbackModelId;
}

function getModelOrderIndex(
  modelId: AppModelId | undefined,
  models: Array<{ id: string }>
): number {
  if (!modelId) {
    return Number.POSITIVE_INFINITY;
  }
  const index = models.findIndex((m) => m.id === modelId);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function PureParallelResponseCards({
  messageId,
  isReadonly = false,
}: {
  messageId: string;
  isReadonly?: boolean;
}) {
  return isReadonly ? (
    <ParallelCardsContent messageId={messageId} />
  ) : (
    <EditableParallelCards messageId={messageId} />
  );
}

function EditableParallelCards({ messageId }: { messageId: string }) {
  const { handleModelChange } = useChatInput();
  return (
    <ParallelCardsContent
      handleModelChange={handleModelChange}
      messageId={messageId}
    />
  );
}

function ParallelCardsContent({
  messageId,
  handleModelChange,
}: {
  messageId: string;
  handleModelChange?: (modelId: AppModelId) => Promise<void>;
}) {
  const message = useMessageById<ChatMessage>(messageId);
  const thread = useApplicationThread();
  const parallelGroupInfo = useParallelGroupInfo(messageId);
  const navigateToMessage = useNavigateToMessage();
  const { getModelById, models } = useChatModels();
  const [pendingParallelIndex, setPendingParallelIndex] = useState<
    number | null
  >(null);
  const activatedRunIdRef = useRef<string | null>(null);

  const cardSlots = useMemo(() => {
    if (
      !message ||
      message.role !== "user" ||
      !message.metadata.parallelGroupId ||
      typeof message.metadata.selectedModel === "string"
    ) {
      return [];
    }

    const requestedModelIds = expandSelectedModelValue(
      message.metadata.selectedModel
    );

    return requestedModelIds.map((modelId, parallelIndex) => {
      const actualMessage = parallelGroupInfo
        ? getParallelResponseForSlot(
            parallelGroupInfo.messages,
            parallelIndex,
            parallelGroupInfo.selectedMessageId
          )
        : null;

      return {
        modelId,
        parallelIndex,
        message: actualMessage ?? null,
        run: parallelGroupInfo?.runsByParallelIndex[parallelIndex],
      };
    });
  }, [message, parallelGroupInfo]);

  const sortedCardSlots = useMemo(() => {
    return [...cardSlots].sort((left, right) => {
      const leftOrder = getModelOrderIndex(
        getEffectiveModelId(left.message, left.modelId),
        models
      );
      const rightOrder = getModelOrderIndex(
        getEffectiveModelId(right.message, right.modelId),
        models
      );

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      const leftMessageId =
        left.message?.id ?? `${left.modelId}:${left.parallelIndex}`;
      const rightMessageId =
        right.message?.id ?? `${right.modelId}:${right.parallelIndex}`;

      return leftMessageId.localeCompare(rightMessageId);
    });
  }, [cardSlots, models]);

  const selectedParallelIndex = useMemo(() => {
    if (pendingParallelIndex !== null) {
      return pendingParallelIndex;
    }

    if (parallelGroupInfo?.selectedMessageId) {
      const selectedMessage = parallelGroupInfo.messages.find(
        (candidate) => candidate.id === parallelGroupInfo.selectedMessageId
      );
      if (typeof selectedMessage?.metadata.parallelIndex === "number") {
        return selectedMessage.metadata.parallelIndex;
      }
    }

    return cardSlots.length > 0 ? 0 : null;
  }, [cardSlots.length, parallelGroupInfo, pendingParallelIndex]);

  useEffect(() => {
    if (pendingParallelIndex === null) {
      return;
    }

    const slot = cardSlots.find(
      (slot) => slot.parallelIndex === pendingParallelIndex
    );
    if (!slot) {
      return;
    }
    if (!slot.message) {
      if (slot.run && activatedRunIdRef.current !== slot.run.id) {
        activatedRunIdRef.current = slot.run.id;
        thread.setActiveRun(slot.run.id);
      }
      return;
    }

    setPendingParallelIndex(null);
    if (activatedRunIdRef.current !== slot.run?.id) {
      navigateToMessage(slot.message.id);
    }
    activatedRunIdRef.current = null;
  }, [cardSlots, navigateToMessage, pendingParallelIndex, thread]);

  if (!message || sortedCardSlots.length <= 1) {
    return null;
  }

  return (
    <ResponseChoiceCards
      slots={sortedCardSlots.map((slot) => {
        const modelId = getEffectiveModelId(slot.message, slot.modelId);
        const modelName = modelId
          ? (getModelById(modelId)?.name ?? modelId)
          : "Model";
        const selected = selectedParallelIndex === slot.parallelIndex;
        const lifecycle = getParallelResponseLifecycle(
          slot.message,
          slot.run?.status
        );
        return {
          id: `${message.id}-${slot.parallelIndex}`,
          modelName,
          selected,
          loading: lifecycle === "queued" || lifecycle === "generating",
          statusLabel: getStatusLabel(selected, lifecycle),
          onSelect: () => {
            if (slot.message) {
              activatedRunIdRef.current = null;
              setPendingParallelIndex(null);
              navigateToMessage(slot.message.id);
            } else if (slot.run) {
              activatedRunIdRef.current = slot.run.id;
              setPendingParallelIndex(slot.parallelIndex);
              thread.setActiveRun(slot.run.id);
            } else {
              setPendingParallelIndex(slot.parallelIndex);
              navigateToMessage(message.id);
            }
            if (modelId) {
              handleModelChange?.(modelId);
            }
          },
        };
      })}
    />
  );
}

export const ParallelResponseCards = memo(
  PureParallelResponseCards,
  (prevProps, nextProps) =>
    prevProps.messageId === nextProps.messageId &&
    prevProps.isReadonly === nextProps.isReadonly
);
