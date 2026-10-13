"use client";

import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
import {
  Root as SwitchPrimitivesRoot,
  Thumb as SwitchPrimitivesThumb,
} from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

const Switch = reactForwardRef<
  ReactComponentRef<typeof SwitchPrimitivesRoot>,
  ReactComponentPropsWithoutRef<typeof SwitchPrimitivesRoot>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <SwitchPrimitivesRoot
      className={cn(
        "peer focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=unchecked]:bg-input inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitivesThumb
        className={cn(
          "bg-background pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitivesRoot>
  )
);

Switch.displayName = SwitchPrimitivesRoot.displayName;

export { Switch };
