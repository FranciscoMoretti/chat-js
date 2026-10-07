"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ThemeToggle); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable sort-imports */

export const ThemeToggle = (): React.JSX.Element => {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      aria-label="Toggle theme"
      className="text-foreground/75 hover:bg-secondary hover:text-foreground rounded-md p-2 transition-colors"
      onClick={(): void =>
        // oxlint-disable-next-line no-ternary -- Keep setTheme argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
