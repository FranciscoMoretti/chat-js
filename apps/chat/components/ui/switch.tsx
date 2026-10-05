"use client";

import {
  Root as SwitchPrimitivesRoot,
  Thumb as SwitchPrimitivesThumb,
} from "@radix-ui/react-switch";
import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Switch: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- Switch uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Switch = reactForwardRef<
  ReactComponentRef<typeof SwitchPrimitivesRoot>,
  ReactComponentPropsWithoutRef<typeof SwitchPrimitivesRoot>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <SwitchPrimitivesRoot
    // oxlint-disable-next-line react/forbid-component-props -- SwitchPrimitivesRoot accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "peer focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=unchecked]:bg-input inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Switch's SwitchPrimitivesRoot prop contract, preserving caller options, children and callbacks.
    {...props}
    ref={ref}
  >
    <SwitchPrimitivesThumb
      // oxlint-disable-next-line react/forbid-component-props -- SwitchPrimitivesThumb accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "bg-background pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitivesRoot>
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Switch.displayName = SwitchPrimitivesRoot.displayName;

export { Switch };
