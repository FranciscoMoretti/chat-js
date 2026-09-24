"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { EveMessage, MessageStreamEvent } from "eve/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { expandSelectedModelValue, isSelectedModelValue } from "@/lib/ai/types";
import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
import { config } from "@/lib/config";
import type { EveForkInput } from "@/lib/eve/contracts";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { draftMessage } from "@/lib/eve/draft";
import { eveUserForkBoundary, resolveForkSource } from "@/lib/eve/fork-source";
import type { EveMessageInput } from "@/lib/eve/message-input";
import { eveMessageTool } from "@/lib/eve/message-tool-selection";
import {
  finishCreation,
  prepareCreation,
  prepareResponseGroupCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";
import { responseModel } from "@/lib/eve/response-model";
import { restoreEveAttachment } from "@/lib/eve/restore-attachment";
import { useDefaultModel } from "@/providers/default-model-provider";
import { useTRPC } from "@/trpc/react";

import { uploadAttachment, useEveAttachments } from "./use-eve-attachments";

type Operation = NonNullable<ReturnType<typeof readCreationRequest>>;

type EditContext = {
  events?: readonly MessageStreamEvent[];
  modelSelection?: SelectedModelValue;
  response?: EveMessage;
};

const responseModelSelection = (
  response: EveMessage,
  events: readonly MessageStreamEvent[]
) => {
  const modelId = responseModel(
    events,
    response.metadata?.turnId ?? "",
    response.metadata?.modelId
  );
  return isSelectedModelValue(modelId) ? modelId : undefined;
};

const operationModelSelection = (operation: Operation) => {
  if (!("modelIds" in operation)) {
    return operation.modelId && isSelectedModelValue(operation.modelId)
      ? operation.modelId
      : undefined;
  }
  const selection: Record<string, number> = {};
  for (const modelId of operation.modelIds) {
    selection[modelId] = (selection[modelId] ?? 0) + 1;
  }
  return isSelectedModelValue(selection) ? selection : undefined;
};

export const useEveFork = (
  ownerId: string,
  conversationId: string,
  onComparisonStarted?: (
    message: EveMessageInput,
    selectedTool: UiToolName | undefined,
    clearComposer: boolean
  ) => void
) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const family = useQuery(
    trpc.eve.branches.queryOptions({ id: conversationId })
  );
  const router = useRouter();
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
  const [failure, setFailure] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    try {
      const operation = readCreationRequest(sessionStorage, ownerId, {
        conversationId,
      });
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
          typeof operation.message === "string"
            ? operation.message
            : operation.message
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n")
        );
        setAttachments(
          typeof operation.message === "string"
            ? []
            : operation.message
                .filter((part) => part.type === "file")
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

  const execute = async (operation: Operation) => {
    const id = await resolveCreationRequest(
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
      router.push(`/chat/${id}`, { scroll: false });
    });
  };

  const run = async (action: () => Promise<void>) => {
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
        finishCreation(sessionStorage, ownerId, { conversationId });
        setPending(undefined);
      }
      setFailure(
        error instanceof Error ? error.message : "Unable to create a version."
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required fork lock cleanup in finally.
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const begin = (
    message: EveMessage,
    regeneration?: {
      response: EveMessage;
      events: readonly MessageStreamEvent[];
    },
    editContext?: EditContext
  ) =>
    run(async () => {
      const boundary = eveUserForkBoundary(message);
      if (pending || editingMessageId || !family.data || !boundary) {
        return;
      }
      const responseSelection = editContext?.response
        ? responseModelSelection(editContext.response, editContext.events ?? [])
        : undefined;
      const editingSelection =
        editContext?.modelSelection ?? responseSelection ?? selectedModel;
      const modelId = regeneration
        ? responseModelSelection(regeneration.response, regeneration.events)
        : undefined;
      const fork = resolveForkSource(
        conversationId,
        boundary,
        family.data.branches
      );
      const text = message.parts
        .filter((part) => part.type === "text")
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
      let attachments: Awaited<ReturnType<typeof uploadAttachment>>[];
      try {
        attachments = await Promise.all(
          message.parts
            .filter((part) => part.type === "file")
            .map(async (part) => {
              const file = await restoreEveAttachment(
                part,
                window.location.origin,
                config.attachments.maxBytes
              );
              return uploadAttachment(file);
            })
        );
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
      message: EveMessageInput,
      modelIds: string[],
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
      !!pending,
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
    retry: () =>
      run(async () => {
        if (pending) {
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
};
