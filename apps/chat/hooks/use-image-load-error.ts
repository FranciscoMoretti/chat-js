"use client";

import { useState } from "react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useImageLoadError); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable typescript/strict-boolean-expressions, unicorn/no-null -- useImageLoadError: ;   typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including url); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const useImageLoadError = (
  url: string | undefined
): {
  handleImageError: () => void;
  imageUnavailable: boolean;
} => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return {
    handleImageError: () => setFailedUrl(url ?? null),
    imageUnavailable: Boolean(url && failedUrl === url),
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/strict-boolean-expressions, unicorn/no-null */
