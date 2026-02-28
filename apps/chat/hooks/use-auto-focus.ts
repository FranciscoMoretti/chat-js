"use client";

import type { LexicalEditor } from "lexical";
import { useEffect } from "react";

const FALLBACK_FOCUS_TIMEOUT_MS = 120;

function isTypingSurface(element: Element | null): boolean {
  return (
    (element instanceof HTMLInputElement &&
      !element.readOnly &&
      !element.disabled &&
      element.type !== "hidden") ||
    (element instanceof HTMLTextAreaElement &&
      !element.readOnly &&
      !element.disabled) ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

export function useAutoFocus({
  autoFocus,
  editor,
}: {
  autoFocus: boolean;
  editor: LexicalEditor | null;
}) {
  useEffect(() => {
    if (!(autoFocus && editor)) {
      return;
    }

    let fallbackTimeout: number | null = null;

    const raf = window.requestAnimationFrame(() => {
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

    return () => {
      window.cancelAnimationFrame(raf);
      if (fallbackTimeout !== null) {
        window.clearTimeout(fallbackTimeout);
      }
    };
  }, [autoFocus, editor]);
}
