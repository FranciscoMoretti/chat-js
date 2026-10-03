"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

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
/* oxlint-enable sort-imports */
/* oxlint-disable import/group-exports, import/no-named-export -- ActionsProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ActionsProps = ComponentProps<"div">;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Actions: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: ActionsProps). */

export const Actions = ({
  className,
  children,
  ...props
}: ActionsProps): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export -- ActionProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- Action: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including label). */

export const Action = ({
  tooltip,
  children,
  label,
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: ActionProps) => {
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
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
