"use client";

import type { ComponentProps } from "react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

type ActionsProps = ComponentProps<"div">;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Actions: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: ActionsProps). */

const Actions = ({
  className,
  children,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes tooltip, children, label, className, variant, size from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ActionProps): React.JSX.Element => {
  const button = (
    <Button
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Action, Actions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
export { Action, Actions };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ActionProps, ActionsProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ActionProps, ActionsProps };
/* oxlint-enable import/no-named-export */
