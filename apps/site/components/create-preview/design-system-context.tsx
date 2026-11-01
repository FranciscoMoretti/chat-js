"use client";

import { createContext, useContext } from "react";
import type { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params";

// The native provider owns the iframe's query subscription. Its presentation
// must use the same resolved state, including updates received during hydration.
export const PreviewDesignSystemContext = createContext<ReturnType<
  typeof useDesignSystemSearchParams
> | null>(null);

export const usePreviewDesignSystem = () => {
  const context = useContext(PreviewDesignSystemContext);
  if (context === null) {
    throw new Error("Chat preview requires the native DesignSystemProvider");
  }
  return context;
};
