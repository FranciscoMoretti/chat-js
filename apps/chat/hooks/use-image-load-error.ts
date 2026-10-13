"use client";

import { useState } from "react";

export const useImageLoadError = (
  url: string | undefined
): {
  handleImageError: () => void;
  imageUnavailable: boolean;
} => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return {
    handleImageError: () => {
      setFailedUrl(url ?? null);
    },
    imageUnavailable:
      typeof url === "string" && url !== "" && failedUrl === url,
  };
};
