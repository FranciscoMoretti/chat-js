"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
/* oxlint-disable eslint/sort-imports -- the react import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import React from "react";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- ThemeToggle: Consumers use this named API so adding another export will not require changing existing imports. */
/* oxlint-disable import/no-named-export -- ThemeToggle: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- ThemeToggle: This callback closes over current render state; preserving its timing and dependencies needs more than mechanical memoization. */
/* oxlint-disable eslint/no-ternary -- ThemeToggle: The expression selects a render/state value locally; changing component boundaries or closure ownership is outside this styling restriction. */
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
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
