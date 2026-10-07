"use client";

import {
  Arrow as TooltipPrimitiveArrow,
  Content as TooltipPrimitiveContent,
  Portal as TooltipPrimitivePortal,
  Provider as TooltipPrimitiveProvider,
  Root as TooltipPrimitiveRoot,
  Trigger as TooltipPrimitiveTrigger,
} from "@radix-ui/react-tooltip";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { cn } from "@/lib/utils";
/* oxlint-disable no-magic-numbers -- TooltipProvider: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0). */

/* oxlint-disable react/react-in-jsx-scope -- TooltipProvider uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TooltipProvider = ({
  delayDuration = 0,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes delayDuration from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: Readonly<
  Omit<ReactComponentProps<typeof TooltipPrimitiveProvider>, "children">
> & { readonly children: ReadonlyReactNode }): ReactJSX.Element => (
  <TooltipPrimitiveProvider
    data-slot="tooltip-provider"
    delayDuration={delayDuration}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TooltipProvider's TooltipPrimitiveProvider prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable react/no-multi-comp -- Tooltip: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- Tooltip uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Tooltip = (
  props: Readonly<
    Omit<ReactComponentProps<typeof TooltipPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <TooltipProvider>
    <TooltipPrimitiveRoot
      data-slot="tooltip"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Tooltip's TooltipPrimitiveRoot prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  </TooltipProvider>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- TooltipTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- TooltipTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TooltipTrigger = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TooltipTrigger forwards TooltipPrimitiveTrigger's Ref<HTMLButtonElement> | undefined contract, including writable current objects, native event callbacks and CSSProperties.
  props: ReactComponentProps<typeof TooltipPrimitiveTrigger>
): ReactJSX.Element => (
  <TooltipPrimitiveTrigger
    data-slot="tooltip-trigger"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TooltipTrigger's TooltipPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable no-magic-numbers, react/no-multi-comp -- TooltipContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- TooltipContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TooltipContent forwards TooltipPrimitiveContent's Ref<HTMLDivElement> | undefined contract, including writable current objects, native event callbacks and CSSProperties.
const TooltipContent = ({
  className,
  sideOffset = 0,
  children,
  variant = "primary",
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, sideOffset, children, variant from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ReactComponentProps<typeof TooltipPrimitiveContent> & {
  variant?: "base" | "primary";
}): ReactJSX.Element => (
  <TooltipPrimitivePortal>
    <TooltipPrimitiveContent
      // oxlint-disable-next-line react/forbid-component-props -- TooltipPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 animate-in data-[state=closed]:animate-out z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "base" && "bg-popover text-popover-foreground",
        className
      )}
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TooltipContent's TooltipPrimitiveContent prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children}
      <TooltipPrimitiveArrow
        // oxlint-disable-next-line react/forbid-component-props -- TooltipPrimitiveArrow accepts className in its styling contract; preserve this caller's layout and appearance.
        className={cn(
          "z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]",
          variant === "primary" && "bg-primary fill-primary",
          variant === "base" && "bg-popover fill-popover"
        )}
      />
    </TooltipPrimitiveContent>
  </TooltipPrimitivePortal>
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Tooltip, TooltipContent, TooltipProvider, TooltipTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable no-magic-numbers, react/no-multi-comp */

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
/* oxlint-enable import/no-named-export */
