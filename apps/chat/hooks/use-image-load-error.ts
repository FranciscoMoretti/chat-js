"use client";

import { useState } from "react";

export const useImageLoadError = (url: string | undefined) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return {
    handleImageError: () => setFailedUrl(url ?? null),
    imageUnavailable: Boolean(url && failedUrl === url),
  };
};
