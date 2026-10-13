import type { ComponentProps, JSX as ReactJSX } from "react";

import { PanelLeft } from "lucide-react";

import React from "react";

import type { SidebarTrigger } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Button } from "./ui/button";

export const SidebarToggle = ({
  className,
  onClick,
  ...props
}: ComponentProps<typeof SidebarTrigger>): ReactJSX.Element => {
  const { toggleSidebar } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          className={className}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented) {
              toggleSidebar();
            }
          }}
          size="icon"
          variant="ghost"
        >
          <PanelLeft size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start">Toggle Sidebar</TooltipContent>
    </Tooltip>
  );
};
