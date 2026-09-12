"use client";

import { Cpu, Plug, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { InternalLink } from "@/components/internal-link";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";

type SettingsNavItem = {
  href: "/settings" | "/settings/models" | "/settings/connectors";
  label: string;
  icon: LucideIcon;
};

const getNavItems = (): SettingsNavItem[] => {
  const items: SettingsNavItem[] = [
    {
      href: "/settings",
      icon: Settings,
      label: "General",
    },
    {
      href: "/settings/models",
      icon: Cpu,
      label: "Models",
    },
  ];

  if (config.ai.tools.mcp.enabled) {
    items.push({
      href: "/settings/connectors",
      icon: Plug,
      label: "Connectors",
    });
  }

  return items;
};

export const SettingsNav = ({
  orientation = "vertical",
}: {
  orientation?: "horizontal" | "vertical";
}) => {
  const pathname = usePathname();

  const navItems = useMemo(() => getNavItems(), []);

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
