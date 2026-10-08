"use client";

import {
  Indicator as ProgressPrimitiveIndicator,
  Root as ProgressPrimitiveRoot,
} from "@radix-ui/react-progress";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import React from "react";

import { cn } from "@/lib/utils";

const Progress = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    value,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, value from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof ProgressPrimitiveRoot>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const indicatorStyle = React.useMemo(
    (): { readonly transform: string } => ({
      // oxlint-disable-next-line no-magic-numbers, typescript/strict-boolean-expressions, typescript/prefer-nullish-coalescing -- Percentage math uses 100 as full progress and 0 as the missing/NaN fallback; preserve the existing zero branch for all falsy numeric values.
      transform: `translateX(-${100 - (value || 0)}%)`,
    }),
    [value]
  );
  return (
    <ProgressPrimitiveRoot
      // oxlint-disable-next-line react/forbid-component-props -- Radix ProgressPrimitiveRoot accepts className for its track styling.
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      data-slot="progress"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Progress's ProgressPrimitiveRoot prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <ProgressPrimitiveIndicator
        // oxlint-disable-next-line react/forbid-component-props -- Radix ProgressPrimitiveIndicator accepts className for its fill styling.
        className="bg-primary h-full w-full flex-1 transition-all"
        data-slot="progress-indicator"

        // oxlint-disable-next-line react/forbid-component-props -- Radix ProgressPrimitiveIndicator accepts the transform style.
        style={indicatorStyle}
      />
    </ProgressPrimitiveRoot>
  );
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Progress); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

export { Progress };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
