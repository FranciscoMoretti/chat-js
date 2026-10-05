"use client";

import { usePathname } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */
import type { SettingsItem } from "@/components/settings/settings-item";
import { cn } from "@/lib/utils";
import { settingsItems } from "@/settings-items";

type ReadonlyNavItem = Readonly<
  Pick<SettingsItem, "href" | "label" | "isVisible">
> & {
  readonly icon: (props: {
    readonly className: string;
  }) => ReturnType<SettingsItem["icon"]>;
};

export const SettingsNav = ({
  orientation = "vertical",
}: {
  readonly orientation?: "horizontal" | "vertical";
}): ReactJSX.Element => {
  const pathname = usePathname();

  const navItems = settingsItems.filter(
    (item: ReadonlyNavItem) => !item.isVisible || item.isVisible()
  );

  return (
    <nav
      className={cn(
        "flex gap-1 sm:overflow-auto sm:pb-2",
        orientation === "vertical" ? "w-56 flex-col" : "flex-row"
      )}
    >
      {navItems.map(({ href, label, icon: Icon }: ReadonlyNavItem) => {
        const isActive =
          href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(href);

        return (
          <InternalLink
            // oxlint-disable-next-line react/forbid-component-props -- InternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
            className={cn(
              "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2.5 transition-colors",
              isActive && "bg-muted text-foreground"
            )}
            href={href}
            key={href}
          >
            <Icon
              // oxlint-disable-next-line react/forbid-component-props -- Icon accepts className in its styling contract; preserve this caller's layout and appearance.
              className="size-4"
            />
            {label}
          </InternalLink>
        );
      })}
    </nav>
  );
};
