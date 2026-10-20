"use client";

import type { JSX as ReactJSX } from "react";
import React, { useMemo, useSyncExternalStore } from "react";

import { MessageSiblingsView } from "@/components/message-siblings-view";
import { logicalResponseSlots } from "@/lib/eve/logical-response-slots";
import type { LogicalChat } from "@/lib/eve/logical-chat";
import { useChatModels } from "@/providers/chat-models-provider";
import { useModelChange } from "@/providers/default-model-provider";

import { useLogicalChat } from "./eve-logical-context";
import { EveLogicalGroupRecovery } from "./eve-logical-group-recovery";
import { EveResponseGroupCards } from "./eve-response-group-cards";

const createResponseSelection = (
  controller: Readonly<
    Pick<LogicalChat, "subscribe" | "getSnapshot" | "selectBranch">
  >,
  userId: string | undefined
) => {
  let pending: string | undefined;
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
      (slot) => slot.operationId === pending
    )?.original?.id;
    if (typeof recoveredId !== "string" || recoveredId === "") {
      return;
    }
    // Clear before selection emits a new controller snapshot, preventing re-entry.
    pending = undefined;
    controller.selectBranch(recoveredId);
    publish();
  };
  return {
    getSnapshot: () => pending,
    getServerSnapshot: (): undefined => undefined,
    select: (operationId: string | undefined): void => {
      pending = operationId;
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

const EveLogicalVersions = ({
  conversationId,
  messageId,
  disabled,
}: {
  readonly conversationId: string;
  readonly messageId: string;
  readonly disabled: boolean;
}): ReactJSX.Element => {
  const { controller } = useLogicalChat();
  const { ids, index } = controller.siblings(conversationId, messageId);
  const select = (offset: number): void => {
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
      onNext={() => {
        select(1);
      }}
      onPrevious={() => {
        select(-1);
      }}
    />
  );
};

const EveLogicalResponses = ({
  conversationId,
  messageId,
  disabled,
}: {
  readonly conversationId: string;
  readonly messageId: string;
  readonly disabled: boolean;
}): ReactJSX.Element | null => {
  const { controller, snapshot, ownerId } = useLogicalChat();
  const { getModelById } = useChatModels();
  const changeModel = useModelChange();
  const userId = controller.logicalId(conversationId, messageId);
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
    (slot: {
      readonly operationId: string;
      readonly original?: Readonly<{ id: string }>;
    }) => slot.operationId === pending && !slot.original
  );
  return (
    <>
      <EveResponseGroupCards
        candidates={group.slots.map(
          (slot: {
            readonly modelId: string;
            readonly operationId: string;
            readonly original?: Readonly<{ id: string }>;
            readonly attempt?: Readonly<{ branch: Readonly<{ id: string }> }>;
          }) => ({
            disabled,
            modelName: getModelById(slot.modelId)?.name ?? slot.modelId,
            operationId: slot.operationId,
            state: slot.original ? "bound" : "unresolved",
            status: snapshot.agents.get(
              slot.attempt?.branch.id ?? slot.original?.id ?? ""
            )?.status,
          })
        )}
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
          const model = getModelById(slot.modelId);
          if (model) {
            void changeModel(model.id);
          }
          selection.select(slot.original ? undefined : operationId);
          if (slot.attempt) {
            controller.selectNode(slot.attempt.answer);
          } else if (slot.original) {
            controller.selectBranch(slot.original.id);
          }
        }}
      />
      <EveLogicalGroupRecovery
        autoOnly={!unconfirmed}
        groupId={group.groupId}
        ownerId={ownerId}
      />
    </>
  );
};
export { EveLogicalResponses, EveLogicalVersions };
