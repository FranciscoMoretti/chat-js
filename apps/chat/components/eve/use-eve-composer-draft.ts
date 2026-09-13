"use client";

import {
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";

import { frontendToolsSchema, type UiToolName } from "@/lib/ai/types";
import { type DraftAttachment, draftAttachment } from "@/lib/eve/draft";

const composerDraft = z.object({
  text: z.string(),
  attachments: z.array(draftAttachment),
  selectedTool: frontendToolsSchema.nullable().default(null),
});
type Draft = z.infer<typeof composerDraft>;

/** Persist unsent input synchronously, before a response-card navigation can unmount it. */
export function useEveComposerDraft(ownerId: string, scopeId: string) {
  const key = `chatjs.eve.composer:${ownerId}:${scopeId}`;
  const current = useRef<Draft>({
    text: "",
    attachments: [],
    selectedTool: null,
  });
  const [value, setValue] = useState(current.current);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      const restored = saved
        ? composerDraft.parse(JSON.parse(saved))
        : { text: "", attachments: [], selectedTool: null };
      current.current = restored;
      setValue(restored);
      setError(undefined);
    } catch {
      setError(
        "The saved draft could not be restored. Keep this tab open for recovery."
      );
    }
    setLoaded(true);
  }, [key]);
  const update = useCallback(
    (change: (draft: Draft) => Draft) => {
      const next = change(current.current);
      current.current = next;
      setValue(next);
      try {
        if (next.text || next.attachments.length || next.selectedTool) {
          sessionStorage.setItem(key, JSON.stringify(next));
        } else {
          sessionStorage.removeItem(key);
        }
        setError(undefined);
      } catch {
        setError(
          "Your draft could not be saved. Keep this tab open before switching responses."
        );
      }
    },
    [key]
  );
  const setText = useCallback(
    (text: SetStateAction<string>) =>
      update((draft) => ({
        ...draft,
        text: typeof text === "function" ? text(draft.text) : text,
      })),
    [update]
  );
  const setAttachments = useCallback(
    (attachments: SetStateAction<DraftAttachment[]>) =>
      update((draft) => ({
        ...draft,
        attachments:
          typeof attachments === "function"
            ? attachments(draft.attachments)
            : attachments,
      })),
    [update]
  );
  const setSelectedTool = useCallback(
    (tool: SetStateAction<UiToolName | null>) =>
      update((draft) => ({
        ...draft,
        selectedTool:
          typeof tool === "function" ? tool(draft.selectedTool) : tool,
      })),
    [update]
  );
  return { ...value, setText, setAttachments, setSelectedTool, loaded, error };
}
