"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { useTRPC } from "@/trpc/react";

const draftSchema = z.object({
  baseRevisionId: z.uuid(),
  content: z.string(),
  operationId: z.uuid(),
  submittedContent: z.string().optional(),
  title: z.string(),
});
type Draft = z.infer<typeof draftSchema>;
type Revision = { id: string; title: string; content: string };

/** One immutable request at a time; newer edits remain queued behind it. */
export const useDocumentDraft = ({
  conversationId,
  documentId,
  enabled,
  revision,
  onSaved,
  onRestore,
}: {
  conversationId: string;
  documentId: string;
  enabled: boolean;
  revision: Revision | undefined;
  onSaved: (revisionId: string) => Promise<void>;
  onRestore: (revisionId: string) => void;
}) => {
  const trpc = useTRPC();
  const { mutateAsync, isPending } = useMutation(
    trpc.eve.saveDocument.mutationOptions()
  );
  const [draft, setDraft] = useState<Draft>();
  const latest = useRef<Draft | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [storageError, setStorageError] = useState(false);
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const storageKey = `eve-document-draft:${conversationId}:${documentId}`;

  const update = useCallback(
    (next: Draft | undefined) => {
      latest.current = next;
      setDraft(next);
      try {
        if (next) {
          sessionStorage.setItem(storageKey, JSON.stringify(next));
        } else {
          sessionStorage.removeItem(storageKey);
        }
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    },
    [storageKey]
  );

  useEffect(() => {
    if (!enabled || ready) {
      return;
    }
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const restored = draftSchema.parse(JSON.parse(stored));
        latest.current = restored;
        // oxlint-disable-next-line react/set-state-in-effect -- Hydrate the controlled editor from browser storage.
        setDraft(restored);
        onRestore(restored.baseRevisionId);
      }
    } catch {
      setStorageError(true);
    }
    setReady(true);
  }, [enabled, ready, storageKey, onRestore]);

  const edit = useCallback(
    (content: string) => {
      if (!(enabled && ready && revision)) {
        return;
      }
      const { current } = latest;
      if (current?.content === content) {
        return;
      }
      if (!current && content === revision.content) {
        return;
      }
      update(
        current
          ? { ...current, content }
          : {
              baseRevisionId: revision.id,
              content,
              operationId: crypto.randomUUID(),
              title: revision.title,
            }
      );
    },
    [enabled, ready, revision, update]
  );

  const save = useCallback(async () => {
    const { current } = latest;
    if (!(enabled && ready && current) || busy.current) {
      return;
    }
    busy.current = true;
    setFailure(undefined);
    const submitted = {
      ...current,
      submittedContent: current.submittedContent ?? current.content,
    };
    update(submitted);
    /* oxlint-disable react/todo -- Preserve save lock cleanup in finally. */
    try {
      const saved = await mutateAsync({
        content: submitted.submittedContent,
        conversationId,
        documentId,
        expectedRevisionId: submitted.baseRevisionId,
        operationId: submitted.operationId,
        title: submitted.title,
      });
      if (!active.current) {
        return;
      }
      await onSaved(saved.id);
      if (!active.current) {
        return;
      }
      const newest = latest.current;
      update(
        newest && newest.content !== submitted.submittedContent
          ? {
              baseRevisionId: saved.id,
              content: newest.content,
              operationId: crypto.randomUUID(),
              title: saved.title,
            }
          : undefined
      );
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Document could not be saved."
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required save lock cleanup in finally.
    } finally {
      busy.current = false;
    }
    /* oxlint-enable react/todo */
  }, [
    enabled,
    ready,
    conversationId,
    documentId,
    mutateAsync,
    update,
    onSaved,
  ]);

  useEffect(() => {
    if (!(enabled && ready && draft) || failure || isPending) {
      return;
    }
    const timer = setTimeout(() => save(), 2000);
    return () => clearTimeout(timer);
  }, [enabled, ready, draft, failure, isPending, save]);

  return {
    discard: () => {
      if (!busy.current) {
        update(undefined);
        setFailure(undefined);
      }
    },
    draft,
    edit,
    error: failure,
    ready,
    restore: (content: string, title: string, baseRevisionId: string) => {
      if (!(enabled && ready) || busy.current || latest.current) {
        return;
      }
      update({
        baseRevisionId,
        content,
        operationId: crypto.randomUUID(),
        title,
      });
    },
    retry: () => save(),
    saving: isPending,
    storageError,
  };
};
