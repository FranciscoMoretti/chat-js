"use client";

import { useEffect, useState } from "react";
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-magic-numbers, no-ternary, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useDebouncedSearch: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 250); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including normalized ? 250 : 0); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-magic-numbers, no-ternary, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
