"use client";
import { useMemo, useOptimistic, useTransition } from "react";

/** Publish to the composer immediately and let React own asynchronous preference failures. */
export const useOptimisticModelSelection = <T>(
  value: T,
  onChange: (next: T) => void | Promise<void>
) => {
  // A branch switch supersedes any picker update still waiting for persistence.
  const controlled = useMemo(() => ({ value }), [value]);
  const [pending, setPending] = useOptimistic<{
    from: typeof controlled;
    next: T;
  } | null>(null);
  const selection = pending?.from === controlled ? pending.next : value;
  const [, startTransition] = useTransition();
  const change = (next: T) => {
    try {
      const completion = onChange(next);
      startTransition(async () => {
        setPending({ from: controlled, next });
        await completion;
      });
    } catch (error) {
      startTransition(() => {
        throw error;
      });
    }
  };
  return { selection, change };
};
