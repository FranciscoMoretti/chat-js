"use client";

import {
  Root as CheckboxPrimitiveRoot,
  Indicator as CheckboxPrimitiveIndicator,
} from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { forwardRef as reactForwardRef } from "react";
import type {
  ComponentRef as ReactComponentRef,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Checkbox: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const Checkbox = reactForwardRef<
  ReactComponentRef<typeof CheckboxPrimitiveRoot>,
  ReactComponentPropsWithoutRef<typeof CheckboxPrimitiveRoot>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <CheckboxPrimitiveRoot
    className={cn(
      "peer border-primary ring-offset-background focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Checkbox's CheckboxPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <CheckboxPrimitiveIndicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitiveIndicator>
  </CheckboxPrimitiveRoot>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Checkbox.displayName = CheckboxPrimitiveRoot.displayName;

export { Checkbox };
