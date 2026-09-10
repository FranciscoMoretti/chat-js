"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useTRPC } from "@/trpc/react";

const draftSchema = z.object({
  baseRevisionId: z.uuid(),
  title: z.string(),
  content: z.string(),
  operationId: z.uuid(),
  submittedContent: z.string().optional(),
});
type Draft = z.infer<typeof draftSchema>;
type Revision = { id: string; title: string; content: string };

/** One immutable request at a time; newer edits remain queued behind it. */
export function useDocumentDraft({
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
}) {
  const trpc = useTRPC();
  const { mutateAsync, isPending } = useMutation(
    trpc.eve.saveDocument.mutationOptions()
  );
  const [draft, setDraft] = useState<Draft>();
  const latest = useRef<Draft>(undefined);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
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
      const current = latest.current;
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
              title: revision.title,
              content,
              operationId: crypto.randomUUID(),
            }
      );
    },
    [enabled, ready, revision, update]
  );

  const save = useCallback(async () => {
    const current = latest.current;
    if (!(enabled && ready && current) || busy.current) {
      return;
    }
    busy.current = true;
    setError(undefined);
    const submitted = {
      ...current,
      submittedContent: current.submittedContent ?? current.content,
    };
    update(submitted);
    try {
      const saved = await mutateAsync({
        conversationId,
        documentId,
        expectedRevisionId: submitted.baseRevisionId,
        operationId: submitted.operationId,
        title: submitted.title,
        content: submitted.submittedContent,
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
              title: saved.title,
              content: newest.content,
              operationId: crypto.randomUUID(),
            }
          : undefined
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Document could not be saved."
      );
    } finally {
      busy.current = false;
    }
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
    if (!(enabled && ready && draft) || error || isPending) {
      return;
    }
    const timer = setTimeout(() => save(), 2000);
    return () => clearTimeout(timer);
  }, [enabled, ready, draft, error, isPending, save]);

  return {
    draft,
    ready,
    edit,
    error,
    storageError,
    saving: isPending,
    retry: () => save(),
    discard: () => {
      if (!busy.current) {
        update(undefined);
        setError(undefined);
      }
    },
  };
}
