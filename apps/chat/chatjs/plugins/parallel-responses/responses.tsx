"use client";

import type { ChatResponseProps } from "@/chatjs/core/chat/contracts";
import type { JSX as ReactJSX } from "react";
import React, { useMemo, useSyncExternalStore } from "react";

import { logicalResponseSlots } from "./logical-response-slots";
import type { LogicalChat } from "@/lib/eve/logical-chat";
import { useChatModels } from "@/providers/chat-models-provider";

import { useLogicalChat } from "@/components/eve/eve-logical-context";
import { EveLogicalGroupRecovery } from "./eve-logical-group-recovery";
import { EveResponseGroupCards } from "./eve-response-group-cards";

const createResponseSelection = (
  controller: Readonly<
    Pick<LogicalChat, "subscribe" | "getSnapshot" | "selectBranch">
  >,
  userId: string | undefined
) => {
  let pending: { operationId: string; onSelected: () => void } | undefined;
  const listeners = new Set<() => void>();
  const publish = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };
  const recover = (): void => {
    if (userId === undefined || pending === undefined) {
      return;
    }
    const group = logicalResponseSlots(controller.getSnapshot(), userId);
    const recoveredId = group?.slots.find(
      (slot) => slot.operationId === pending?.operationId
    )?.original?.id;
    if (typeof recoveredId !== "string" || recoveredId === "") {
      return;
    }
    // Clear before selection emits a new controller snapshot, preventing re-entry.
    const { onSelected } = pending;
    pending = undefined;
    controller.selectBranch(recoveredId, onSelected);
    publish();
  };
  return {
    getSnapshot: () => pending?.operationId,
    getServerSnapshot: (): undefined => undefined,
    select: (request?: typeof pending): void => {
      pending = request;
      publish();
      recover();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      const unsubscribe = controller.subscribe(recover);
      recover();
      return () => {
        unsubscribe();
        listeners.delete(listener);
      };
    },
  };
};

export const ParallelResponses = ({
  branchId,
  messageId,
  disabled,
  onModelChange,
}: ChatResponseProps): ReactJSX.Element | null => {
  const { controller, snapshot, ownerId } = useLogicalChat();
  const { getModelById } = useChatModels();
  const userId = controller.logicalId(branchId, messageId);
  const selection = useMemo(
    () => createResponseSelection(controller, userId),
    [controller, userId]
  );
  const pending = useSyncExternalStore(
    selection.subscribe,
    selection.getSnapshot,
    selection.getServerSnapshot
  );
  const group =
    typeof userId === "string" && userId !== ""
      ? logicalResponseSlots(snapshot, userId)
      : undefined;
  if (!group) {
    return null;
  }
  const selectedSlot = group.slots.find(
    (slot: { readonly selected: boolean }) => slot.selected
  );
  const unconfirmed = group.slots.find(
    (slot) => slot.operationId === pending && !slot.original
  );
  return (
    <>
      <EveResponseGroupCards
        candidates={group.slots.map((slot) => {
          const branchState = slot.original ? "bound" : "unresolved";
          return {
            disabled,
            modelName:
              slot.modelId === null
                ? "Response"
                : (getModelById(slot.modelId)?.name ?? slot.modelId),
            operationId: slot.operationId,
            state: slot.rejection ? "rejected" : branchState,
            status: snapshot.agents.get(
              slot.attempt?.branch.id ?? slot.original?.id ?? ""
            )?.status,
          };
        })}
        selectedOperationId={
          unconfirmed?.operationId ?? selectedSlot?.operationId ?? null
        }
        onSelect={(operationId) => {
          const slot = group.slots.find(
            (candidate: { readonly operationId: string }) =>
              candidate.operationId === operationId
          );
          if (!slot) {
            return;
          }
          const onSelected = () => {
            const model =
              slot.modelId === null ? undefined : getModelById(slot.modelId);
            if (model) {
              void onModelChange(model.id);
            }
          };
          if (slot.attempt) {
            selection.select();
            controller.selectNode(slot.attempt.answer);
            onSelected();
          } else {
            selection.select({ operationId, onSelected });
          }
        }}
      />
      <EveLogicalGroupRecovery
        autoOnly={!unconfirmed}
        rejection={unconfirmed?.rejection?.error}
        groupId={group.groupId}
        ownerId={ownerId}
      />
    </>
  );
};
