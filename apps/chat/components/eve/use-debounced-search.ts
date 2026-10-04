"use client";

import { useEffect, useState } from "react";
/* oxlint-disable no-magic-numbers -- useDebouncedSearch: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 250); */

export const useDebouncedSearch = (value: string): string => {
  const normalized = value.trim();
  const [search, setSearch] = useState(normalized);
  useEffect(() => {
    const timeout = setTimeout(
      () => setSearch(normalized),
      normalized ? 250 : 0
    );
    return (): void => clearTimeout(timeout);
  }, [normalized]);
  return search;
};
/* oxlint-enable no-magic-numbers */
