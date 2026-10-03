"use client";

import { PanelLeft } from "lucide-react";
import Image from "next/image";
import React from "react";

import { InternalLink } from "@/components/internal-link";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { useSidebar } from "@/components/ui/sidebar";
import { config } from "@/lib/config";

/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- SidebarTopRow: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

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
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
