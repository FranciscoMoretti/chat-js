"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";

import { toolNameSchema } from "@/lib/ai/types";
import type { UiToolName } from "@/lib/ai/types";
import { draftAttachment } from "@/lib/eve/draft";
import type { DraftAttachment } from "@/lib/eve/draft";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const composerDraft = z.object({
  attachments: z.array(draftAttachment),
  selectedTool: toolNameSchema.nullable().default(null),
  text: z.string(),
});
type Draft = ReadonlyNativeSurface<z.infer<typeof composerDraft>>;

const emptyDraft: Draft = { attachments: [], selectedTool: null, text: "" };
const draftKey = (ownerId: string, scopeId: string): string =>
  `chatjs.eve.composer:${ownerId}:${scopeId}`;

const parseSavedDraft = (saved: string | null): Draft =>
  saved === null || saved === ""
    ? emptyDraft
    : composerDraft.parse(JSON.parse(saved));

const readHandoffDestination = (key: string): Draft => {
  const saved = sessionStorage.getItem(key);
  try {
    return parseSavedDraft(saved);
  } catch {
    // An unreadable destination cannot be merged with the intact follow-up.
    return emptyDraft;
  }
};

/** Transfer text typed in the composer that created this conversation. */
export const handoffEveComposerDraft = (
  ownerId: string,
  scopeId: string,
  text: string
): void => {
  const key = draftKey(ownerId, scopeId);
  const draft = readHandoffDestination(key);
  if (draft.text === text) {
    return;
  }
  sessionStorage.setItem(
    key,
    JSON.stringify({
      ...draft,
      text: draft.text ? `${draft.text}\n\n${text}` : text,
    })
  );
};

interface DraftSnapshot {
  value: Draft;
  loaded: boolean;
  error: string | undefined;
}
const createDraftStore = (key: string) => {
  const initial: DraftSnapshot = {
    value: emptyDraft,
    loaded: false,
    error: undefined,
  };
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const publish = (next: DraftSnapshot): void => {
    snapshot = next;
    for (const listener of listeners) {
      listener();
    }
  };
  const update = (change: (draft: Draft) => Draft): void => {
    const value = change(snapshot.value);
    let error: string | undefined;
    try {
      if (
        value.text ||
        value.attachments.length > 0 ||
        value.selectedTool !== null
      ) {
        sessionStorage.setItem(key, JSON.stringify(value));
      } else {
        sessionStorage.removeItem(key);
      }
    } catch {
      error =
        "Your draft could not be saved. Keep this tab open before switching responses.";
    }
    publish({ ...snapshot, value, error });
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (!snapshot.loaded) {
        try {
          publish({
            value: parseSavedDraft(sessionStorage.getItem(key)),
            loaded: true,
            error: undefined,
          });
        } catch {
          publish({
            ...snapshot,
            loaded: true,
            error:
              "The saved draft could not be restored. Keep this tab open for recovery.",
          });
        }
      }
      return () => {
        listeners.delete(listener);
      };
    },
    update,
  };
};
type ComposerDraftState = Draft & {
  error: string | undefined;
  loaded: boolean;
  setAttachments: Dispatch<
    SetStateAction<readonly Readonly<DraftAttachment>[]>
  >;
  setSelectedTool: Dispatch<SetStateAction<UiToolName | null>>;
  setText: Dispatch<SetStateAction<string>>;
};

/**
 * Persist unsent input synchronously, before response navigation can unmount it.
 * @param {string} ownerId The owner whose drafts remain isolated in this tab.
 * @param {string} scopeId The conversation or response scope that owns this input.
 * @returns {ComposerDraftState} Draft fields, restore and save status, and React-compatible setters.
 */
export const useEveComposerDraft = (
  ownerId: string,
  scopeId: string
): ComposerDraftState => {
  const key = draftKey(ownerId, scopeId);
  const store = useMemo(() => createDraftStore(key), [key]);
  const { value, loaded, error } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const { update } = store;
  const setText = useCallback(
    (text: SetStateAction<string>): void => {
      update((draft) => ({
        ...draft,
        text: typeof text === "function" ? text(draft.text) : text,
      }));
    },
    [update]
  );
  const setAttachments = useCallback(
    (
      attachments: SetStateAction<readonly Readonly<DraftAttachment>[]>
    ): void => {
      update((draft) => ({
        ...draft,
        attachments:
          typeof attachments === "function"
            ? attachments(draft.attachments)
            : attachments,
      }));
    },
    [update]
  );
  const setSelectedTool = useCallback(
    (tool: SetStateAction<UiToolName | null>): void => {
      update((draft) => ({
        ...draft,
        selectedTool:
          typeof tool === "function" ? tool(draft.selectedTool) : tool,
      }));
    },
    [update]
  );
  return { ...value, error, loaded, setAttachments, setSelectedTool, setText };
};
