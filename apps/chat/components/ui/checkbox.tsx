"use client";

import {
  Indicator as CheckboxPrimitiveIndicator,
  Root as CheckboxPrimitiveRoot,
} from "@radix-ui/react-checkbox";
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

const Checkbox = reactForwardRef<
  ReactComponentRef<typeof CheckboxPrimitiveRoot>,
  ReactComponentPropsWithoutRef<typeof CheckboxPrimitiveRoot>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <CheckboxPrimitiveRoot
      className={cn(
        "peer border-primary ring-offset-background focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    >
      <CheckboxPrimitiveIndicator
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className="h-4 w-4" />
      </CheckboxPrimitiveIndicator>
    </CheckboxPrimitiveRoot>
  )
);

Checkbox.displayName = CheckboxPrimitiveRoot.displayName;

export { Checkbox };
