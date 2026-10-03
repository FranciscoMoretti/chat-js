"use client";

import type { LexicalEditor } from "lexical";
import { useEffect } from "react";

const FALLBACK_FOCUS_TIMEOUT_MS = 120;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- isTypingSurface: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including element: Element | null). */

const isTypingSurface = (element: Element | null): boolean =>
  (element instanceof HTMLInputElement &&
    !element.readOnly &&
    !element.disabled &&
    element.type !== "hidden") ||
  (element instanceof HTMLTextAreaElement &&
    !element.readOnly &&
    !element.disabled) ||
  (element instanceof HTMLElement && element.isContentEditable);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- useAutoFocus: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const useAutoFocus = ({
  autoFocus,
  editor,
}: {
  autoFocus: boolean;
  editor: LexicalEditor | null;
}) => {
  useEffect(() => {
    if (!(autoFocus && editor)) {
      return;
    }

    let fallbackTimeout: number | null = null;

    const raf = globalThis.requestAnimationFrame(() => {
      const active = document.activeElement;
      const isUserTypingElsewhere = isTypingSurface(active);

      if (!isUserTypingElsewhere) {
        editor.focus();
        // Minimal fallback for hydration/layout races where focus is stolen.
        // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Use the browser timer overload because the focus cleanup stores a numeric timeout ID.
        fallbackTimeout = window.setTimeout(() => {
          const currentActive = document.activeElement;
          const canSafelyStealFocus = !isTypingSurface(currentActive);

          if (canSafelyStealFocus) {
            editor.focus();
          }
        }, FALLBACK_FOCUS_TIMEOUT_MS);
      }
    });

    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
    return () => {
      globalThis.cancelAnimationFrame(raf);
      if (fallbackTimeout !== null) {
        globalThis.clearTimeout(fallbackTimeout);
      }
    };
  }, [autoFocus, editor]);
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
