"use client";

import { PanelLeft } from "lucide-react";
import Image from "next/image";

import { InternalLink } from "@/components/internal-link";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { useSidebar } from "@/components/ui/sidebar";
import { config } from "@/lib/config";

export const SidebarTopRow = () => {
  const { isMobile, openMobile, setOpenMobile, state, toggleSidebar } =
    useSidebar();
  const isExpanded = isMobile ? openMobile : state === "expanded";

  return (
    <div className="flex w-full items-center justify-between gap-2">
      {isExpanded ? (
        <InternalLink
          className="flex flex-row items-center gap-2"
          href="/"
          onNavigate={() => {
            setOpenMobile(false);
          }}
        >
          <span className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md p-1 text-lg font-semibold">
            <Image
              alt={config.appName}
              className="h-5 w-5"
              height={20}
              src="/icon.svg"
              width={20}
            />
            {config.appName}
          </span>
        </InternalLink>
      ) : (
        <button
          aria-label="Expand sidebar"
          className="group-hover/sidebar:bg-muted relative flex size-8 items-center justify-center rounded-md transition-colors"
          onClick={toggleSidebar}
          type="button"
        >
          <Image
            alt={config.appName}
            className="h-5 w-5 transition-opacity duration-150 group-hover/sidebar:opacity-0"
            height={20}
            src="/icon.svg"
            width={20}
          />
          <PanelLeft className="absolute size-4 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100" />
        </button>
      )}

      {isExpanded && <SidebarToggle className="md:h-fit md:px-2" />}
    </div>
  );
};
