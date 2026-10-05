"use client";

import { useEffect, useState } from "react";
// Typing coalesces requests; clearing remains a cancellable asynchronous update.
const typingDebounceDelayMs = 250;
const clearedSearchDelayMs = 0;

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
