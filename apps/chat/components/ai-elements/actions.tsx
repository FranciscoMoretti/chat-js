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
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- Action: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including label). */

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
      {/* oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value. */}
      <span className="sr-only">{label || tooltip}</span>
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
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
export { Action, Actions };
export type { ActionProps, ActionsProps };
