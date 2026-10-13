"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ComponentProps } from "react";
import React from "react";
import { cn } from "@/lib/utils";

type ActionsProps = ComponentProps<"div">;

const Actions = ({
  className,
  children,
  ...props
}: ActionsProps): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

const Action = ({
  tooltip,
  children,
  label,
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: ActionProps): React.JSX.Element => {
  const button = (
    <Button
      className={cn(
        "text-muted-foreground hover:text-foreground relative size-9 p-1.5",
        className
      )}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children}
      <span className="sr-only">
        {typeof label === "string" && label !== "" ? label : tooltip}
      </span>
    </Button>
  );

  if (typeof tooltip === "string" && tooltip !== "") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};
export { Action, Actions };
export type { ActionProps, ActionsProps };
