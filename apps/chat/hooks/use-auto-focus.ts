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

export const useAutoFocus = ({
  autoFocus,
  editor,
}: {
  readonly autoFocus: boolean;
  readonly editor: Readonly<Pick<LexicalEditor, "focus">> | null;
}): void => {
  useEffect((): (() => void) | undefined => {
    if (!(autoFocus && editor)) {
      return undefined;
    }

    let fallbackTimeout: number | null = null;

    const raf = globalThis.requestAnimationFrame(() => {
      const active = document.activeElement;
      const isUserTypingElsewhere = isTypingSurface(active);

      if (!isUserTypingElsewhere) {
        editor.focus();
        // Minimal fallback for hydration/layout races where focus is stolen.
        fallbackTimeout = window.setTimeout(() => {
          const currentActive = document.activeElement;
          const canSafelyStealFocus = !isTypingSurface(currentActive);

          if (canSafelyStealFocus) {
            editor.focus();
          }
        }, FALLBACK_FOCUS_TIMEOUT_MS);
      }
    });

    return (): void => {
      globalThis.cancelAnimationFrame(raf);
      if (fallbackTimeout !== null) {
        globalThis.clearTimeout(fallbackTimeout);
      }
    };
  }, [autoFocus, editor]);
};
