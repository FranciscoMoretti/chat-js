"use client";

import { useEffect, useState } from "react";
/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useDebouncedSearch: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 250); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const useDebouncedSearch = (value: string) => {
  const normalized = value.trim();
  const [search, setSearch] = useState(normalized);
  useEffect(() => {
    const timeout = setTimeout(
      () => setSearch(normalized),
      normalized ? 250 : 0
    );
    return () => clearTimeout(timeout);
  }, [normalized]);
  return search;
};
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
