"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export const ThemeChrome = () => {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme === undefined) {
      return;
    }
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute(
        "content",
        resolvedTheme === "dark" ? "#0c0c0c" : "#f8f7f4"
      );
    }
  }, [resolvedTheme]);
  return null;
};
