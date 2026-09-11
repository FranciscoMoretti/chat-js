"use client";

import { useQuery } from "@tanstack/react-query";
import type { EveMessage, MessageStreamEvent } from "eve/client";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import type {
  createConversationInput,
  EveForkInput,
} from "@/lib/eve/contracts";
import {
  CreationRejected,
  requestConversation,
} from "@/lib/eve/create-conversation";
import { draftMessage } from "@/lib/eve/draft";
import { resolveForkSource } from "@/lib/eve/fork-source";
import {
  finishCreation,
  prepareCreation,
  readCreation,
} from "@/lib/eve/pending-create";
import { responseModel } from "@/lib/eve/response-model";
import { useDefaultModel } from "@/providers/default-model-provider";
import { useTRPC } from "@/trpc/react";
import { uploadAttachment, useEveAttachments } from "./use-eve-attachments";

type Operation = z.infer<typeof createConversationInput>;

export function useEveFork(ownerId: string, conversationId: string) {
  const trpc = useTRPC();
  const family = useQuery(
    trpc.eve.branches.queryOptions({ id: conversationId })
  );
  const selectedModel = useDefaultModel();
  const files = useEveAttachments();
  const { setAttachments } = files;
  const [draft, setDraft] = useState("");
  const [source, setSource] = useState<EveForkInput>();
  const [pending, setPending] = useState<Operation>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    try {
      const operation = readCreation(sessionStorage, ownerId, {
        conversationId,
      });
      if (operation) {
        if (!operation.fork) {
          throw new Error("Missing saved fork source.");
        }
        setPending(operation);
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
                  url: part.data,
                  name: part.filename,
                  contentType: part.mediaType,
                  digest: "",
                }))
        );
      }
    } catch {
      setError(
        "The saved version request could not be restored. Keep this tab for recovery."
      );
    }
  }, [conversationId, ownerId, setAttachments]);

  async function execute(operation: Operation) {
    const binding = await requestConversation(operation);
    finishCreation(sessionStorage, ownerId, { conversationId });
    window.location.assign(`/chat/${binding.id}`);
  }

  async function run(action: () => Promise<void>) {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      if (cause instanceof CreationRejected) {
        finishCreation(sessionStorage, ownerId, { conversationId });
        setPending(undefined);
        setOpen(true);
      }
      setError(
        cause instanceof Error ? cause.message : "Unable to create a version."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function begin(
    message: EveMessage,
    regeneration?: {
      response: EveMessage;
      events: readonly MessageStreamEvent[];
    }
  ) {
    return run(async () => {
      if (pending || !family.data || !message.metadata?.turnId) {
        return;
      }
      const modelId = regeneration
        ? responseModel(
            regeneration.events,
            regeneration.response.metadata?.turnId ?? ""
          )
        : selectedModel;
      const fork = resolveForkSource(
        conversationId,
        message.metadata.turnId,
        family.data.branches
      );
      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      // Re-upload the exact native bytes; never silently drop a file on an edit.
      const attachments = await Promise.all(
        message.parts
          .filter((part) => part.type === "file")
          .map(async (part) => {
            if (!part.url?.startsWith(`data:${part.mediaType};base64,`)) {
              throw new Error(
                "This attachment cannot yet be restored for editing."
              );
            }
            const blob = await (await fetch(part.url)).blob();
            return uploadAttachment(
              new File([blob], part.filename ?? "attachment", {
                type: part.mediaType,
              })
            );
          })
      );
      setDraft(text);
      files.setAttachments(attachments);
      setSource(fork);
      if (regeneration) {
        const operation = prepareCreation(
          sessionStorage,
          ownerId,
          draftMessage(text, attachments),
          modelId,
          { conversationId, fork }
        );
        setPending(operation);
        await execute(operation);
      } else {
        setOpen(true);
      }
    });
  }

  return {
    family,
    draft,
    setDraft,
    files,
    open,
    setOpen,
    busy,
    error,
    pending,
    begin,
    locked: busy || !!pending,
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
          { conversationId, fork: source }
        );
        setPending(operation);
        setOpen(false);
        await execute(operation);
      }),
    retry: () =>
      run(async () => {
        if (pending) {
          await execute(pending);
        }
      }),
  };
}
