"use client";

import { useEffect, useState } from "react";

import { MessageSiblingsView } from "@/components/message-siblings-view";
import { logicalResponseSlots } from "@/lib/eve/logical-response-slots";
import { useChatModels } from "@/providers/chat-models-provider";
import { useModelChange } from "@/providers/default-model-provider";

import { useLogicalChat } from "./eve-logical-context";
import { EveLogicalGroupRecovery } from "./eve-logical-group-recovery";
import { EveResponseGroupCards } from "./eve-response-group-cards";

export const EveLogicalVersions = ({
  conversationId,
  messageId,
  disabled,
}: {
  conversationId: string;
  messageId: string;
  disabled: boolean;
}) => {
  const { controller } = useLogicalChat();
  const { ids, index } = controller.siblings(conversationId, messageId);
  const select = (offset: number) => {
    const id = ids[index + offset];
    if (!disabled && id) {
      controller.selectNode(id);
    }
  };
  return (
    <MessageSiblingsView
      count={ids.length}
      index={Math.max(0, index)}
      disabled={disabled}
      onNext={() => select(1)}
      onPrevious={() => select(-1)}
    />
  );
};

export const EveLogicalResponses = ({
  conversationId,
  messageId,
  disabled,
}: {
  conversationId: string;
  messageId: string;
  disabled: boolean;
}) => {
  const { controller, snapshot, ownerId } = useLogicalChat();
  const { getModelById } = useChatModels();
  const changeModel = useModelChange();
  const [pending, setPending] = useState<string>();
  const userId = controller.logicalId(conversationId, messageId);
  const group = userId ? logicalResponseSlots(snapshot, userId) : undefined;
  const recoveredId = group?.slots.find((slot) => slot.operationId === pending)
    ?.original?.id;
  useEffect(() => {
    if (recoveredId) {
      controller.selectBranch(recoveredId);
      // oxlint-disable-next-line react/set-state-in-effect -- Reconcile a user-selected unresolved slot with its accepted native session.
      setPending(undefined);
    }
  }, [controller, recoveredId]);
  if (!group) {
    return null;
  }
  const selectedSlot = group.slots.find((slot) => slot.selected);
  const unconfirmed = group.slots.find(
    (slot) => slot.operationId === pending && !slot.original
  );
  return (
    <>
      <EveResponseGroupCards
        candidates={group.slots.map((slot) => ({
          disabled,
          modelName: getModelById(slot.modelId)?.name ?? slot.modelId,
          operationId: slot.operationId,
          state: slot.original ? "bound" : "unresolved",
          status: snapshot.agents.get(
            slot.attempt?.branch.id ?? slot.original?.id ?? ""
          )?.status,
        }))}
        selectedOperationId={
          unconfirmed?.operationId ?? selectedSlot?.operationId ?? null
        }
        onSelect={(operationId) => {
          const slot = group.slots.find(
            (candidate) => candidate.operationId === operationId
          );
          if (!slot) {
            return;
          }
          const model = getModelById(slot.modelId);
          if (model) {
            void changeModel(model.id);
          }
          setPending(slot.original ? undefined : operationId);
          if (slot.attempt) {
            controller.selectNode(slot.attempt.answer);
          } else if (slot.original) {
            controller.selectBranch(slot.original.id);
          }
        }}
      />
      {unconfirmed && (
        <EveLogicalGroupRecovery groupId={group.groupId} ownerId={ownerId} />
      )}
    </>
  );
};
