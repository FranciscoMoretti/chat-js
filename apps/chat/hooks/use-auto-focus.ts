"use client";

import type { LexicalEditor } from "lexical";
import { useEffect } from "react";

const FALLBACK_FOCUS_TIMEOUT_MS = 120;

const isTypingSurface = (element: unknown): boolean =>
  (element instanceof HTMLInputElement &&
    !element.readOnly &&
    !element.disabled &&
    element.type !== "hidden") ||
  (element instanceof HTMLTextAreaElement &&
    !element.readOnly &&
    !element.disabled) ||
  (element instanceof HTMLElement && element.isContentEditable);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useAutoFocus); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

/* oxlint-disable unicorn/no-null -- unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const useAutoFocus = ({
  autoFocus,
  editor,
}: {
  readonly autoFocus: boolean;
  readonly editor: Readonly<Pick<LexicalEditor, "focus">> | null;
}): void => {
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
    return (): void => {
      globalThis.cancelAnimationFrame(raf);
      if (fallbackTimeout !== null) {
        globalThis.clearTimeout(fallbackTimeout);
      }
    };
  }, [autoFocus, editor]);
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable unicorn/no-null */
