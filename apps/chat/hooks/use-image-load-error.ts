"use client";

import { useState } from "react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useImageLoadError); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable unicorn/no-null -- Preserve null as the initial failed URL and missing URL sentinel. */

export const useImageLoadError = (
  url: string | undefined
): {
  handleImageError: () => void;
  imageUnavailable: boolean;
} => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return {
    handleImageError: () => setFailedUrl(url ?? null),
    imageUnavailable:
      typeof url === "string" && url !== "" && failedUrl === url,
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable unicorn/no-null */
