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

/* oxlint-disable react/react-in-jsx-scope -- Switch uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Switch = reactForwardRef<
  ReactComponentRef<typeof SwitchPrimitivesRoot>,
  ReactComponentPropsWithoutRef<typeof SwitchPrimitivesRoot>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases.
    { className, ...props },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve forwardRef's native writable current object and callback ref contract.
    ref
  ): ReactJSX.Element => (
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
  )
);
/* oxlint-enable react/react-in-jsx-scope */

Switch.displayName = SwitchPrimitivesRoot.displayName;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Switch); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Switch };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
