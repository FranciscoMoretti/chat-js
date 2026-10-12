"use client";

import { withTaskCleanup } from "@/components/task-cleanup";

import { hasText } from "@/components/text-value";

import { useMutation } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
interface Revision {
  id: string;
  title: string;
  content: string;
}

const createDocumentDraftStore = (storageKey: string) => {
  const initial: {
    draft: Draft | undefined;
    ready: boolean;
    storageError: boolean;
  } = {
    draft: undefined,
    ready: false,
    storageError: false,
  };
  let snapshot = initial;
  const latest: { current: Draft | undefined } = { current: undefined };
  const listeners = new Set<() => void>();
  const publish = (next: typeof initial): void => {
    snapshot = next;
    latest.current = next.draft;
    for (const listener of listeners) {
      listener();
    }
  };
  return {
    latest,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    restore: (onRestore: (revisionId: string) => void): void => {
      if (snapshot.ready) {
        return;
      }
      let draft: Draft | undefined;
      let storageError = false;
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (typeof stored === "string" && stored !== "") {
          draft = draftSchema.parse(JSON.parse(stored));
          latest.current = draft;
          onRestore(draft.baseRevisionId);
        }
      } catch {
        storageError = true;
      }
      publish({ draft, ready: true, storageError });
    },
    update: (draft: Draft | undefined): void => {
      latest.current = draft;
      let storageError = false;
      // Publish only after durable persistence, while retaining edits if storage fails.
      try {
        if (draft) {
          sessionStorage.setItem(storageKey, JSON.stringify(draft));
        } else {
          sessionStorage.removeItem(storageKey);
        }
      } catch {
        storageError = true;
      }
      publish({ ...snapshot, draft, storageError });
    },
  };
};

/** One immutable request at a time; newer edits remain queued behind it. */
export const useDocumentDraft = ({
  conversationId,
  documentId,
  enabled,
  revision,
  onSaved,
  onRestore,
}: {
  readonly conversationId: string;
  readonly documentId: string;
  readonly enabled: boolean;
  readonly revision: Readonly<Revision> | undefined;
  readonly onSaved: (revisionId: string) => Promise<void>;
  readonly onRestore: (revisionId: string) => void;
}) => {
  const trpc = useTRPC();
  const { mutateAsync, isPending } = useMutation(
    trpc.eve.saveDocument.mutationOptions()
  );
  const storageKey = `eve-document-draft:${conversationId}:${documentId}`;
  const store = useMemo(
    () => createDocumentDraftStore(storageKey),
    [storageKey]
  );
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribe = store.subscribe(listener);
      if (enabled) {
        store.restore(onRestore);
      }
      return unsubscribe;
    },
    [store, enabled, onRestore]
  );
  const { draft, ready, storageError } = useSyncExternalStore(
    subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const { latest, update } = store;
  const [failure, setFailure] = useState<string>();
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return (): void => {
      active.current = false;
    };
  }, []);

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
    [enabled, ready, revision, update, latest]
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

    await withTaskCleanup(
      async () => {
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
            error instanceof Error
              ? error.message
              : "Document could not be saved."
          );
        }
      },
      () => {
        busy.current = false;
      }
    );
  }, [
    enabled,
    ready,
    conversationId,
    documentId,
    mutateAsync,
    update,
    onSaved,
    latest,
  ]);
  useEffect((): (() => void) | undefined => {
    if (!(enabled && ready && draft) || hasText(failure) || isPending) {
      return undefined;
    }

    const timer = setTimeout(() => {
      void save();
    }, 2000);

    return (): void => {
      clearTimeout(timer);
    };
  }, [enabled, ready, draft, failure, isPending, save]);

  return {
    discard: () => {
      if (!busy.current) {
        // oxlint-disable-next-line unicorn/no-useless-undefined -- The draft callback requires an argument; undefined clears the current draft.
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
    retry: save,
    saving: isPending,
    storageError,
  };
};
