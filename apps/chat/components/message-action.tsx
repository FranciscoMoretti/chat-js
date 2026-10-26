"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** A named message action shared by the toolbar and installed feedback controls. */
export const MessageAction = ({
  tooltip,
  children,
  ...props
}: ComponentProps<typeof Button> & { readonly tooltip: string }) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          aria-label={tooltip}
          size="icon-sm"
          type="button"
          variant="ghost"
          {...props}
        />
      }
    >
      {children}
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
);
