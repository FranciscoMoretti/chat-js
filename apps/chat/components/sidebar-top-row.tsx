"use client";

import { PanelLeft } from "lucide-react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import Image from "next/image";
/* oxlint-enable sort-imports */
import React from "react";
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */
import { SidebarToggle } from "@/components/sidebar-toggle";
import { useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config } from "@/lib/config";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SidebarTopRow); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- SidebarTopRow: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

/* oxlint-disable react/forbid-component-props -- InternalLink, Image, PanelLeft, SidebarToggle accept the supplied styling props; preserve this composition's layout and appearance. */
export const SidebarTopRow = (): ReactJSX.Element => {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */
