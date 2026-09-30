"use client";

import { usePathname } from "next/navigation";

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";
import { settingsItems } from "@/settings-items";

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
