"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";

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

export const useAutoFocus = (
  autoFocus: boolean
): RefObject<HTMLTextAreaElement | null> => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect((): (() => void) | undefined => {
    const input = ref.current;
    if (!autoFocus || !input) {
      return undefined;
    }

    let fallbackTimeout: number | null = null;

    const raf = globalThis.requestAnimationFrame(() => {
      const active = document.activeElement;
      const isUserTypingElsewhere = isTypingSurface(active);

      if (!isUserTypingElsewhere) {
        input.focus();
        // Minimal fallback for hydration/layout races where focus is stolen.
        fallbackTimeout = window.setTimeout(() => {
          const currentActive = document.activeElement;
          const canSafelyStealFocus = !isTypingSurface(currentActive);

          if (canSafelyStealFocus) {
            input.focus();
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
  }, [autoFocus]);
  return ref;
};
