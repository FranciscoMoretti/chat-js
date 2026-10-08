"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line sort-imports -- Oxfmt groups this type reader import by module; sort-imports requires a different binding-name or syntax order.
import { useEffect, useRef, useState, useTransition } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
import { expandSelectedModelValue, isSelectedModelValue } from "@/lib/ai/types";
import type { EveForkInput } from "@/lib/eve/contracts";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { CreationRejectedError } from "@/lib/eve/create-conversation";
/* oxlint-enable sort-imports */
import type { DraftAttachment } from "@/lib/eve/draft";
import { draftMessage } from "@/lib/eve/draft";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveUserForkBoundary, resolveForkSource } from "@/lib/eve/fork-source";
/* oxlint-enable sort-imports */
import type { EveMessageInput } from "@/lib/eve/message-input";
import { eveMessageTool } from "@/lib/eve/message-tool-selection";
/* oxlint-disable import/max-dependencies -- @/lib/eve/pending-create import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  finishCreation,
  prepareCreation,
  prepareResponseGroupCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import type {
  ReadonlyEveMessage,
  ReadonlyEveMessageInput,
  ReadonlyEveMessagePart,
} from "@/lib/eve/readonly-message-types";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";
import { responseModel } from "@/lib/eve/response-model";
import { useDefaultModel } from "@/providers/default-model-provider";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { useEveRuntime } from "./eve-logical-context";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { useEveAttachments } from "./use-eve-attachments";
/* oxlint-enable sort-imports */

type Operation<Request = NonNullable<ReturnType<typeof readCreationRequest>>> =
  Request extends { message: EveMessageInput | ReadonlyEveMessageInput }
    ? Omit<Request, "message"> & { readonly message: ReadonlyEveMessageInput }
    : never;

interface EditContext {
  // oxlint-disable-next-line no-magic-numbers -- The numeric index selects the original callback parameter in this type-only lookup; it does not add a runtime constant.
  readonly events?: Parameters<typeof responseModel>[0];
  readonly modelSelection?: SelectedModelValue;
  readonly response?: ReadonlyEveMessage;
}
/* oxlint-disable no-undefined -- responseModelSelection: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value */

const responseModelSelection = (
  response: {
    readonly metadata?:
      | {
          readonly turnId?: string | undefined;
          readonly modelId?: string | undefined;
        }
      | undefined;
  },
  // oxlint-disable-next-line no-magic-numbers -- The numeric index selects the original callback parameter in this type-only lookup; it does not add a runtime constant.
  events: Parameters<typeof responseModel>[0]
): Extract<SelectedModelValue, string> | undefined => {
  const modelId = responseModel(
    events,
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading turnId from response.metadata; preserve one receiver evaluation, skipped accesses and the existing "" fallback. The app guidance prefers optional chaining.
    response.metadata?.turnId ?? "",
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading modelId from response.metadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    response.metadata?.modelId
  );
  if (isSelectedModelValue(modelId)) {
    return modelId;
  }
  return undefined;
};
/* oxlint-enable no-undefined */

/* oxlint-disable no-magic-numbers, no-undefined, typescript/strict-boolean-expressions -- operationModelSelection: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including operation.modelId). */

const operationModelSelection = (
  operation: Operation
): SelectedModelValue | undefined => {
  if (!("modelIds" in operation)) {
    if (operation.modelId && isSelectedModelValue(operation.modelId)) {
      return operation.modelId;
    }
    return undefined;
  }
  const selection: Record<string, number> = {};
  for (const modelId of operation.modelIds) {
    selection[modelId] = (selection[modelId] ?? 0) + 1;
  }
  if (isSelectedModelValue(selection)) {
    return selection;
  }
  return undefined;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useEveFork); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */
/* oxlint-disable init-declarations, max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- useEveFork: ; init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-params: this callback signature is consumed by the existing library or feature API; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including editingMessageId); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const useEveFork = (
  ownerId: string,
  conversationId: string,
  onComparisonStarted?: (
    message: ReadonlyEveMessageInput,
    selectedTool: UiToolName | undefined,
    clearComposer: boolean
  ) => void
) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const restoreAttachments = useMutation(
    trpc.eve.restoreAttachments.mutationOptions()
  );
  const family = useQuery(
    trpc.eve.branches.queryOptions({ id: conversationId })
  );
  const openRuntime = useEveRuntime();
  const [isNavigating, startTransition] = useTransition();
  const selectedModel = useDefaultModel();
  const files = useEveAttachments();
  const { setAttachments } = files;
  const [draft, setDraft] = useState("");
  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(null);
  const [modelSelectionValue, setModelSelectionValue] =
    useState<SelectedModelValue>();
  const [source, setSource] = useState<EveForkInput>();
  const [pending, setPending] = useState<Operation>();
  const [editingBoundary, setEditingBoundary] = useState<string>();
  const [editingMessageId, setEditingMessageId] = useState<string>();
  const [editRestoreFailed, setEditRestoreFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [failure, setFailure] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    try {
      const operation: Operation | undefined = readCreationRequest(
        sessionStorage,
        ownerId,
        {
          conversationId,
        }
      );
      if (operation) {
        if (!operation.fork) {
          // oxlint-disable-next-line react/todo -- Preserve the explicit missing-fork recovery error.
          throw new Error("Missing saved fork source.");
        }
        // oxlint-disable-next-line react/set-state-in-effect -- Hydrate the controlled fork editor from its durable request.
        setPending(operation);
        setModelSelectionValue(operationModelSelection(operation));
        setSelectedTool(operation.selectedTool ?? null);
        setSource(operation.fork);
        if (operation.forkKind === "edit") {
          setEditingBoundary(
            operation.fork.beforeTurnId ?? operation.fork.beforeMessageId
          );
        }
        setDraft(
          // oxlint-disable-next-line no-ternary -- Keep setDraft argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          typeof operation.message === "string"
            ? operation.message
            : operation.message
                .filter(
                  (
                    part
                  ): part is Extract<
                    Exclude<ReadonlyEveMessageInput, string>[number],
                    { readonly type: "text" }
                  > => part.type === "text"
                )
                .map((part) => part.text)
                .join("\n")
        );
        setAttachments(
          // oxlint-disable-next-line no-ternary -- Keep setAttachments argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          typeof operation.message === "string"
            ? []
            : operation.message
                .filter(
                  (
                    part
                  ): part is Extract<
                    Exclude<ReadonlyEveMessageInput, string>[number],
                    { readonly type: "file" }
                  > => part.type === "file"
                )
                .map((part) => ({
                  contentType: part.mediaType,
                  digest: "",
                  name: part.filename,
                  url: part.data,
                }))
        );
      }
    } catch {
      setRestoreFailed(true);
      setFailure(
        "The saved version request could not be restored. Keep this tab for recovery."
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required restore cleanup in finally.
    } finally {
      setLoaded(true);
    }
  }, [conversationId, ownerId, setAttachments]);

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve execute's awaited sequencing and rejected-Promise behavior. */
  const execute = async (operation: Operation): Promise<void> => {
    const binding = await resolveCreationRequest(
      sessionStorage,
      ownerId,
      operation,
      {
        conversationId,
      }
    );
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.eve.branches.pathKey(),
        refetchType: "none",
      }),
      queryClient.invalidateQueries({ queryKey: trpc.eve.list.pathKey() }),
    ]);
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing binding own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    await openRuntime({ ...binding, operation, ownerId });
    startTransition(() => {
      // App Router Activity can keep this source route mounted while its successor
      // is active. Clear the fulfilled editor in the navigation transition so
      // recovery cannot revive an operation storage has already released.
      setPending(undefined);
      setEditingMessageId(undefined);
      setEditingBoundary(undefined);
      setSource(undefined);
      setDraft("");
      setSelectedTool(null);
      setModelSelectionValue(undefined);
      setEditRestoreFailed(false);
      setAttachments([]);
    });
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve run's awaited sequencing and rejected-Promise behavior. */
  const run = async (action: () => Promise<void>): Promise<void> => {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setFailure("");
    try {
      await action();
    } catch (error) {
      if (error instanceof CreationRejectedError) {
        setRejected(true);
        try {
          finishCreation(sessionStorage, ownerId, { conversationId });
          setPending(undefined);
          setRejected(false);
        } catch {
          setFailure(
            "The rejected version request could not be cleared. Keep this tab for recovery."
          );
          return;
        }
      }
      setFailure(
        // oxlint-disable-next-line no-ternary -- Keep setFailure argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        error instanceof Error ? error.message : "Unable to create a version."
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required fork lock cleanup in finally.
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve begin's awaited sequencing and rejected-Promise behavior. */
  const begin = (
    message: ReadonlyEveMessage,
    regeneration?: {
      readonly response: ReadonlyEveMessage;
      readonly events: Parameters<typeof responseModel>[0];
    },
    editContext?: EditContext
  ): Promise<void> =>
    run(async () => {
      const boundary = eveUserForkBoundary(message);
      if (pending || editingMessageId || !family.data || !boundary) {
        return;
      }
      // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading response from editContext; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep responseSelection as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      const responseSelection = editContext?.response
        ? responseModelSelection(editContext.response, editContext.events ?? [])
        : undefined;
      const editingSelection =
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading modelSelection from editContext; preserve one receiver evaluation, skipped accesses and the existing responseSelection fallback. The app guidance prefers optional chaining.
        editContext?.modelSelection ?? responseSelection ?? selectedModel;
      // oxlint-disable-next-line no-ternary -- Keep modelId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      const modelId = regeneration
        ? responseModelSelection(regeneration.response, regeneration.events)
        : undefined;
      const fork = resolveForkSource(
        conversationId,
        boundary,
        family.data.branches
      );
      const text = message.parts
        .filter((part: ReadonlyEveMessagePart) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      const originalTool = eveMessageTool(message);
      setSelectedTool(originalTool);
      setModelSelectionValue(editingSelection);
      setDraft(text);
      setSource(fork);
      if (!regeneration) {
        setEditRestoreFailed(false);
        setEditingBoundary(boundary);
        setEditingMessageId(message.id);
        files.setAttachments([]);
      }
      // Re-upload the exact native bytes; never silently drop a file on an edit.
      let attachments: DraftAttachment[];
      try {
        // oxlint-disable-next-line no-ternary -- Keep = operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        attachments = message.parts.some(
          (part: ReadonlyEveMessagePart) => part.type === "file"
        )
          ? await restoreAttachments.mutateAsync({
              conversationId,
              messageId: message.id,
            })
          : [];
      } catch (error) {
        if (!regeneration) {
          setEditRestoreFailed(true);
        }
        throw error;
      }
      files.setAttachments(attachments);
      if (regeneration) {
        if (!modelId || typeof modelId !== "string") {
          throw new Error(
            "The response model is unavailable. Reload before regenerating."
          );
        }
        const operation = prepareCreation(
          sessionStorage,
          ownerId,
          draftMessage(text, attachments),
          modelId,
          { conversationId, fork, forkKind: "regenerate" },
          originalTool ?? undefined
        );
        setPending(operation);
        await execute(operation);
      } else {
        setEditingMessageId(message.id);
      }
    });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return {
    begin,
    busy,
    cancelEdit: () => {
      if (busy || pending || isNavigating) {
        return;
      }
      setEditingMessageId(undefined);
      setEditingBoundary(undefined);
      setEditRestoreFailed(false);
      setSource(undefined);
      setFailure("");
    },
    compare: (
      message: ReadonlyEveMessageInput,
      modelIds: readonly string[],
      beforeTurnId: string,
      requestedTool?: UiToolName,
      clearComposer = true
    ) =>
      run(async () => {
        if (!loaded || restoreFailed || pending || editingMessageId) {
          return;
        }
        const operation = prepareResponseGroupCreation(
          sessionStorage,
          ownerId,
          message,
          modelIds,
          {
            conversationId,
            fork: {
              beforeTurnId,
              checkpointId: crypto.randomUUID(),
              conversationId,
            },
          },
          requestedTool
        );
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onComparisonStarted; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
        onComparisonStarted?.(
          operation.message,
          operation.selectedTool,
          clearComposer
        );
        setPending(operation);
        await execute(operation);
      }),
    draft,
    editingBoundary,
    editingMessageId,
    error: failure,
    family,
    files,
    locked:
      !loaded ||
      restoreFailed ||
      editRestoreFailed ||
      busy ||
      isNavigating ||
      Boolean(pending),
    modelSelection: {
      onChange: (value: SelectedModelValue) => {
        if (busy || pending || isNavigating) {
          return Promise.resolve();
        }
        setModelSelectionValue(value);
        return Promise.resolve();
      },
      value: modelSelectionValue ?? selectedModel,
    },
    pending,
    rejected,
    retry: () =>
      run(async () => {
        if (pending && rejected) {
          try {
            finishCreation(sessionStorage, ownerId, { conversationId });
            setPending(undefined);
            setRejected(false);
          } catch {
            setFailure(
              "The rejected version request could not be cleared. Keep this tab for recovery."
            );
          }
        } else if (pending) {
          await execute(pending);
        }
      }),
    selectedTool,
    setDraft,
    setSelectedTool,
    submit: () =>
      run(async () => {
        if (
          !loaded ||
          restoreFailed ||
          editRestoreFailed ||
          isNavigating ||
          pending ||
          !source
        ) {
          return;
        }
        const modelIds = expandSelectedModelValue(
          modelSelectionValue ?? selectedModel
        );
        const message = draftMessage(draft, files.attachments);
        const operation =
          // oxlint-disable-next-line no-ternary -- Keep operation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          modelIds.length > 1
            ? prepareResponseGroupCreation(
                sessionStorage,
                ownerId,
                message,
                modelIds,
                { conversationId, fork: source, forkKind: "edit" },
                selectedTool ?? undefined
              )
            : prepareCreation(
                sessionStorage,
                ownerId,
                message,
                modelIds[0],
                { conversationId, fork: source, forkKind: "edit" },
                selectedTool ?? undefined
              );
        setPending(operation);
        await execute(operation);
      }),
  };
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable init-declarations, max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-lines -- use-eve-fork keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
