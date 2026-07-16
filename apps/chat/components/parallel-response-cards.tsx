"use client";

import { LoaderCircle } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { useChatInput } from "@/providers/chat-input-provider";
import { useChatModels } from "@/providers/chat-models-provider";
import {
  getParallelResponseLifecycle,
  getStatusLabel,
} from "./parallel-response-status";

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

function PureParallelResponseCards({ messageId }: { messageId: string }) {
  const message = useMessageById<ChatMessage>(messageId);
  const thread = useApplicationThread();
  const parallelGroupInfo = useParallelGroupInfo(messageId);
  const navigateToMessage = useNavigateToMessage();
  const { handleModelChange } = useChatInput();
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
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      {sortedCardSlots.map((slot) => {
        const modelId = getEffectiveModelId(slot.message, slot.modelId);
        const modelName = modelId
          ? (getModelById(modelId)?.name ?? modelId)
          : "Model";
        const isSelected = selectedParallelIndex === slot.parallelIndex;
        const lifecycle = getParallelResponseLifecycle(slot.message);
        const isLoading = lifecycle !== "complete";
        const statusLabel = getStatusLabel(isSelected, lifecycle);

        return (
          <Button
            className={cn(
              "h-auto min-w-[160px] flex-col items-start gap-1 rounded-xl px-3 py-2 text-left",
              isSelected && "border-primary bg-primary/5 text-primary"
            )}
            key={`${message.id}-${slot.parallelIndex}`}
            onClick={() => {
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
                handleModelChange(modelId);
              }
            }}
            type="button"
            variant="outline"
          >
            <span className="font-medium text-sm">{modelName}</span>
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              {isLoading ? (
                <LoaderCircle className="size-3 animate-spin" />
              ) : null}
              {statusLabel}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export const ParallelResponseCards = memo(
  PureParallelResponseCards,
  (prevProps, nextProps) => prevProps.messageId === nextProps.messageId
);
