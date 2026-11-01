"use client";
import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";

export const SettingsLink = ({
  href,
  children,
}: {
  readonly href: Route;
  readonly children: ReactNode;
}) => {
  const pathname = usePathname();
  const active =
    href === "/settings" ? pathname === href : pathname.startsWith(href);
  return (
    <InternalLink
      href={href}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2.5 transition-colors",
        active && "bg-muted text-foreground"
      )}
    >
      {children}
    </InternalLink>
  );
};
