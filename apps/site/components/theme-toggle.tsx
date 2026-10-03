"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import React from "react";

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- ThemeToggle: This callback closes over current render state; preserving its timing and dependencies needs more than mechanical memoization. */
/* oxlint-disable react/forbid-component-props -- ThemeToggle: className/style are the deliberate styling interface of these UI/layout primitives. */
export const ThemeToggle = (): React.JSX.Element => {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      aria-label="Toggle theme"
      className="text-foreground/75 hover:bg-secondary hover:text-foreground rounded-md p-2 transition-colors"
      onClick={(): void =>
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
      type="button"
    >
      <Sun className="hidden h-5 w-5 dark:block" />
      <Moon className="block h-5 w-5 dark:hidden" />
    </button>
  );
};
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
