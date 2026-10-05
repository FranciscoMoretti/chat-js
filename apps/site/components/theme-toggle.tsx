"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

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
      <Sun
        // oxlint-disable-next-line react/forbid-component-props -- Sun accepts className in its styling contract; preserve this caller's layout and appearance.
        className="hidden h-5 w-5 dark:block"
      />
      <Moon
        // oxlint-disable-next-line react/forbid-component-props -- Moon accepts className in its styling contract; preserve this caller's layout and appearance.
        className="block h-5 w-5 dark:hidden"
      />
    </button>
  );
};
