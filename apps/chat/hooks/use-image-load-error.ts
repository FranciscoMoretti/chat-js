"use client";

import { useState } from "react";
/* oxlint-disable import/no-named-export, import/prefer-default-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/no-null -- useImageLoadError: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including url); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const useImageLoadError = (url: string | undefined) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return {
    handleImageError: () => setFailedUrl(url ?? null),
    imageUnavailable: Boolean(url && failedUrl === url),
  };
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/no-null */
