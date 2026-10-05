"use client";

import { useEffect, useState } from "react";
// Typing coalesces requests; clearing remains a cancellable asynchronous update.
const typingDebounceDelayMs = 250;
const clearedSearchDelayMs = 0;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useDebouncedSearch); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const useDebouncedSearch = (value: string): string => {
  const normalized = value.trim();
  const [search, setSearch] = useState(normalized);
  useEffect(() => {
    const timeout = setTimeout(
      () => setSearch(normalized),
      normalized ? typingDebounceDelayMs : clearedSearchDelayMs
    );
    return (): void => clearTimeout(timeout);
  }, [normalized]);
  return search;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
