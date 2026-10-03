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
interface Revision {
  id: string;
  title: string;
  content: string;
}
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return -- useDocumentDraft: ; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2000); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including failure); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

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
      if (typeof stored === "string" && stored !== "") {
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
    // oxlint-disable-next-line typescript/no-misused-promises -- #585: Autosave owns pending state and retryable failures; this timer only schedules the existing save lifecycle.
    const timer = setTimeout(() => save(), 2000);
    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return */
