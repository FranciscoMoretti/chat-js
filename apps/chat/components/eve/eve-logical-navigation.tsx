"use client";

import React, { useEffect, useState } from "react";

import { MessageSiblingsView } from "@/components/message-siblings-view";
import { logicalResponseSlots } from "@/lib/eve/logical-response-slots";
import { useChatModels } from "@/providers/chat-models-provider";
import { useModelChange } from "@/providers/default-model-provider";

import { useLogicalChat } from "./eve-logical-context";
import { EveLogicalGroupRecovery } from "./eve-logical-group-recovery";
import { EveResponseGroupCards } from "./eve-response-group-cards";
/* oxlint-disable import/group-exports, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- EveLogicalVersions: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable import/group-exports, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveLogicalResponses: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including slot); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
  const group =
    typeof userId === "string" && userId !== ""
      ? logicalResponseSlots(snapshot, userId)
      : undefined;
  const recoveredId = group?.slots.find((slot) => slot.operationId === pending)
    ?.original?.id;
  useEffect(() => {
    if (typeof recoveredId === "string" && recoveredId !== "") {
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
/* oxlint-enable import/group-exports, max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
