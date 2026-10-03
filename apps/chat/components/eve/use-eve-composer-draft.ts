"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { z } from "zod";

import { frontendToolsSchema } from "@/lib/ai/types";
import type { UiToolName } from "@/lib/ai/types";
import { draftAttachment } from "@/lib/eve/draft";
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
/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- useEveComposerDraft: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including typeof text === "function" ? text(draft.text) : text); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including draft: Draft); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** Persist unsent input synchronously, before a response-card navigation can unmount it. */
export const useEveComposerDraft = (ownerId: string, scopeId: string) => {
  const key = `chatjs.eve.composer:${ownerId}:${scopeId}`;
  const current = useRef<Draft>(emptyDraft);
  const [value, setValue] = useState(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      const restored =
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
    (change: (draft: Draft) => Draft) => {
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
  return { ...value, error, loaded, setAttachments, setSelectedTool, setText };
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
