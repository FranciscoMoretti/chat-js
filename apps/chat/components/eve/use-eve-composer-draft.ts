"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { frontendToolsSchema } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
import { draftAttachment } from "@/lib/eve/draft";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DraftAttachment } from "@/lib/eve/draft";
/* oxlint-enable sort-imports */

/* oxlint-disable unicorn/no-null -- composerDraft: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const composerDraft = z.object({
  attachments: z.array(draftAttachment),
  selectedTool: frontendToolsSchema.nullable().default(null),
  text: z.string(),
});
/* oxlint-enable unicorn/no-null */
type Draft = z.infer<typeof composerDraft>;
/* oxlint-disable unicorn/no-null -- emptyDraft: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const emptyDraft: Draft = { attachments: [], selectedTool: null, text: "" };
/* oxlint-enable unicorn/no-null */
type ComposerDraftState = Draft & {
  error: string | undefined;
  loaded: boolean;
  setAttachments: Dispatch<SetStateAction<DraftAttachment[]>>;
  setSelectedTool: Dispatch<SetStateAction<UiToolName | null>>;
  setText: Dispatch<SetStateAction<string>>;
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useEveComposerDraft); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null -- useEveComposerDraft: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including draft: Draft); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
  const key = `chatjs.eve.composer:${ownerId}:${scopeId}`;
  const current = useRef<Draft>(emptyDraft);
  const [value, setValue] = useState(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      const restored =
        // oxlint-disable-next-line no-ternary -- Keep restored as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        typeof saved === "string" && saved !== ""
          ? composerDraft.parse(JSON.parse(saved))
          : { attachments: [], selectedTool: null, text: "" };
      current.current = restored;
      // oxlint-disable-next-line react/set-state-in-effect -- Hydrate controlled editor state from session storage on mount.
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
    (change: (draft: Draft) => Draft): void => {
      const next = change(current.current);
      current.current = next;
      setValue(next);
      try {
        if (next.text || next.attachments.length > 0 || next.selectedTool) {
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
    (text: SetStateAction<string>): void =>
      update((draft) => ({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing draft own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...draft,
        // oxlint-disable-next-line no-ternary -- Keep text as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        text: typeof text === "function" ? text(draft.text) : text,
      })),
    [update]
  );
  const setAttachments = useCallback(
    (attachments: SetStateAction<DraftAttachment[]>): void =>
      update((draft) => ({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing draft own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...draft,
        attachments:
          // oxlint-disable-next-line no-ternary -- Keep attachments as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          typeof attachments === "function"
            ? attachments(draft.attachments)
            : attachments,
      })),
    [update]
  );
  const setSelectedTool = useCallback(
    (tool: SetStateAction<UiToolName | null>): void =>
      update((draft) => ({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing draft own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...draft,
        selectedTool:
          // oxlint-disable-next-line no-ternary -- Keep selectedTool as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          typeof tool === "function" ? tool(draft.selectedTool) : tool,
      })),
    [update]
  );
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing value own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return { ...value, error, loaded, setAttachments, setSelectedTool, setText };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */
