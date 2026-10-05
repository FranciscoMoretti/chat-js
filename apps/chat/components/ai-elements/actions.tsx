"use client";

import React from "react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ActionsProps = ComponentProps<"div">;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Actions: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: ActionsProps). */

const Actions = ({
  className,
  children,
  ...props
}: ActionsProps): React.JSX.Element => (
  <div
    className={cn("flex items-center gap-1", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Actions's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    {children}
  </div>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- Action: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types */

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
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Action's Button prop contract, preserving caller options, children and callbacks.
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
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
export { Action, Actions };
export type { ActionProps, ActionsProps };
