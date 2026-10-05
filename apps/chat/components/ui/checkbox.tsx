"use client";

import {
  Indicator as CheckboxPrimitiveIndicator,
  Root as CheckboxPrimitiveRoot,
} from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

/* oxlint-disable react/react-in-jsx-scope -- Checkbox uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Checkbox = reactForwardRef<
  ReactComponentRef<typeof CheckboxPrimitiveRoot>,
  ReactComponentPropsWithoutRef<typeof CheckboxPrimitiveRoot>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases.
    { className, ...props },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve forwardRef's native writable current object and callback ref contract.
    ref
  ): ReactJSX.Element => (
    <CheckboxPrimitiveRoot
      // oxlint-disable-next-line react/forbid-component-props -- CheckboxPrimitiveRoot accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "peer border-primary ring-offset-background focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Checkbox's CheckboxPrimitiveRoot prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <CheckboxPrimitiveIndicator
        // oxlint-disable-next-line react/forbid-component-props -- CheckboxPrimitiveIndicator accepts className in its styling contract; preserve this caller's layout and appearance.
        className={cn("flex items-center justify-center text-current")}
      >
        <Check
          // oxlint-disable-next-line react/forbid-component-props -- Check accepts className in its styling contract; preserve this caller's layout and appearance.
          className="h-4 w-4"
        />
      </CheckboxPrimitiveIndicator>
    </CheckboxPrimitiveRoot>
  )
);
/* oxlint-enable react/react-in-jsx-scope */

Checkbox.displayName = CheckboxPrimitiveRoot.displayName;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Checkbox); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Checkbox };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
