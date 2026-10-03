"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { usePathname } from "next/navigation";
import React from "react";

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";
import { settingsItems } from "@/settings-items";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, react/forbid-component-props, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- SettingsNav: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including orientation === "vertical" ? "w-56 flex-col" : "flex-row"); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including item). */

export const SettingsNav = ({
  orientation = "vertical",
}: {
  orientation?: "horizontal" | "vertical";
}) => {
  const pathname = usePathname();

  const navItems = settingsItems.filter(
    (item) => !item.isVisible || item.isVisible()
  );

  return (
    <nav
      className={cn(
        "flex gap-1 sm:overflow-auto sm:pb-2",
        orientation === "vertical" ? "w-56 flex-col" : "flex-row"
      )}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(href);

        return (
          <InternalLink
            className={cn(
              "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2.5 transition-colors",
              isActive && "bg-muted text-foreground"
            )}
            href={href}
            key={href}
          >
            <Icon className="size-4" />
            {label}
          </InternalLink>
        );
      })}
    </nav>
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, react/forbid-component-props, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
