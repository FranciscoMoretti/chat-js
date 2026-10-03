"use client";

import type { LexicalEditor } from "lexical";
import { useEffect } from "react";

const FALLBACK_FOCUS_TIMEOUT_MS = 120;

const isTypingSurface = (element: Element | null): boolean =>
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
