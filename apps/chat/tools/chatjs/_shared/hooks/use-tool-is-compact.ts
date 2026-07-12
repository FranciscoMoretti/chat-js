"use client";

import { useEffect, useState } from "react";

const COMPACT_BREAKPOINT = 640;

export function useToolIsCompact(): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${COMPACT_BREAKPOINT - 1}px)`
    );

    const update = () => setIsCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return isCompact;
}
