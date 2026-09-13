"use client";

import { useQuery } from "@tanstack/react-query";
import type { EveMessage, MessageStreamEvent } from "eve/client";
import { useEffect, useRef, useState } from "react";

import type { UiToolName } from "@/lib/ai/types";
import { config } from "@/lib/config";
import {
  consumeComparisonDraftIntent,
  saveComparisonDraftIntent,
} from "@/lib/eve/comparison-draft-intent";
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

export const useEveFork = (
  ownerId: string,
  conversationId: string,
  onComparisonCreated?: (
    message: EveMessageInput,
    selectedTool: UiToolName | undefined,
    clearComposer: boolean
  ) => void
) => {
  const trpc = useTRPC();
  const family = useQuery(
    trpc.eve.branches.queryOptions({ id: conversationId })
  );
  const selectedModel = useDefaultModel();
  const files = useEveAttachments();
  const { setAttachments } = files;
  const [draft, setDraft] = useState("");
  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(null);
  const [source, setSource] = useState<EveForkInput>();
  const [pending, setPending] = useState<Operation>();
  const [open, setOpen] = useState(false);
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
        setSelectedTool(operation.selectedTool ?? null);
        setSource(operation.fork);
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
    if ("modelIds" in operation) {
      onComparisonCreated?.(
        operation.message,
        operation.selectedTool,
        consumeComparisonDraftIntent(
          sessionStorage,
          ownerId,
          conversationId,
          operation.operationId
        )
      );
    }
    window.location.assign(`/chat/${id}`);
  };

  const run = async (action: () => Promise<void>, reopenEdit = true) => {
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
        setOpen(reopenEdit);
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
    }
  ) =>
    run(async () => {
      const boundary = eveUserForkBoundary(message);
      if (pending || !family.data || !boundary) {
        return;
      }
      const modelId = regeneration
        ? responseModel(
            regeneration.events,
            regeneration.response.metadata?.turnId ?? "",
            regeneration.response.metadata?.modelId
          )
        : selectedModel;
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
      // Re-upload the exact native bytes; never silently drop a file on an edit.
      const attachments = await Promise.all(
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
      setSelectedTool(originalTool);
      setDraft(text);
      files.setAttachments(attachments);
      setSource(fork);
      if (regeneration) {
        const operation = prepareCreation(
          sessionStorage,
          ownerId,
          draftMessage(text, attachments),
          modelId,
          { conversationId, fork },
          originalTool ?? undefined
        );
        setPending(operation);
        await execute(operation);
      } else {
        setOpen(true);
      }
    });

  return {
    begin,
    busy,
    compare: (
      message: EveMessageInput,
      modelIds: string[],
      beforeTurnId: string,
      requestedTool?: UiToolName,
      clearComposer = true
    ) =>
      run(async () => {
        if (!loaded || restoreFailed || pending || open) {
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
        saveComparisonDraftIntent(
          sessionStorage,
          ownerId,
          conversationId,
          operation.operationId,
          clearComposer
        );
        setPending(operation);
        await execute(operation);
      }, false),
    draft,
    error: failure,
    family,
    files,
    locked: !loaded || restoreFailed || busy || !!pending,
    open,
    pending,
    retry: () =>
      run(
        async () => {
          if (pending) {
            await execute(pending);
          }
        },
        !(pending && "modelIds" in pending)
      ),
    selectedTool,
    setDraft,
    setOpen,
    setSelectedTool,
    submit: () =>
      run(async () => {
        if (!source) {
          return;
        }
        const operation = prepareCreation(
          sessionStorage,
          ownerId,
          draftMessage(draft, files.attachments),
          selectedModel,
          { conversationId, fork: source },
          selectedTool ?? undefined
        );
        setPending(operation);
        setOpen(false);
        await execute(operation);
      }),
  };
};
