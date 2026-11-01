"use client";
import { Cpu, ChevronRightIcon } from "lucide-react";
import { SettingsLink } from "@/components/settings/settings-navigation-link";
import { SidebarLink } from "@/components/navigation-links";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { InternalLink } from "@/components/internal-link";
import { buttonVariants } from "@/components/ui/button";

export const ModelPreferencesLink = ({
  surface,
}: {
  readonly surface: "sidebar" | "settings" | "picker";
}) => {
  if (surface === "settings") {
    return (
      <SettingsLink href="/settings/models">
        <Cpu className="size-4" />
        Models
      </SettingsLink>
    );
  }
  if (surface === "sidebar") {
    return (
      <SidebarMenuItem>
        <SidebarLink
          tooltip="Models"
          aria-label="Models"
          href="/settings/models"
        >
          <Cpu className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Models</span>
        </SidebarLink>
      </SidebarMenuItem>
    );
  }
  return (
    <div className="border-t p-2">
      <InternalLink
        aria-label="Add Models"
        href="/settings/models"
        className={buttonVariants({
          className: "w-full justify-between",
          size: "sm",
          variant: "ghost",
        })}
      >
        Add Models
        <ChevronRightIcon className="h-4 w-4" />
      </InternalLink>
    </div>
  );
};
