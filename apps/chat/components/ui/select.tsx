"use client";

import {
  Root as SelectPrimitiveRoot,
  Group as SelectPrimitiveGroup,
  Value as SelectPrimitiveValue,
  Trigger as SelectPrimitiveTrigger,
  Icon as SelectPrimitiveIcon,
  ScrollUpButton as SelectPrimitiveScrollUpButton,
  ScrollDownButton as SelectPrimitiveScrollDownButton,
  Content as SelectPrimitiveContent,
  Portal as SelectPrimitivePortal,
  Viewport as SelectPrimitiveViewport,
  Label as SelectPrimitiveLabel,
  Item as SelectPrimitiveItem,
  ItemIndicator as SelectPrimitiveItemIndicator,
  ItemText as SelectPrimitiveItemText,
  Separator as SelectPrimitiveSeparator,
} from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { forwardRef as reactForwardRef } from "react";
import type {
  ComponentRef as ReactComponentRef,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitiveRoot;

const SelectGroup = SelectPrimitiveGroup;

const SelectValue = SelectPrimitiveValue;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SelectTrigger: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

const SelectTrigger = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveTrigger>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveTrigger>
>(({ className, children, ...props }, ref): ReactJSX.Element => (
  <SelectPrimitiveTrigger
    className={cn(
      "border-input bg-background ring-offset-background focus:ring-ring data-[placeholder]:text-muted-foreground flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectTrigger's SelectPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    {children}
    <SelectPrimitiveIcon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitiveIcon>
  </SelectPrimitiveTrigger>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
SelectTrigger.displayName = SelectPrimitiveTrigger.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SelectScrollUpButton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const SelectScrollUpButton = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveScrollUpButton>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveScrollUpButton>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <SelectPrimitiveScrollUpButton
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectScrollUpButton's SelectPrimitiveScrollUpButton prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitiveScrollUpButton>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
SelectScrollUpButton.displayName = SelectPrimitiveScrollUpButton.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SelectScrollDownButton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const SelectScrollDownButton = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveScrollDownButton>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveScrollDownButton>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <SelectPrimitiveScrollDownButton
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectScrollDownButton's SelectPrimitiveScrollDownButton prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitiveScrollDownButton>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
SelectScrollDownButton.displayName =
  SelectPrimitiveScrollDownButton.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SelectContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, position = "popper", ...props }). */

const SelectContent = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveContent>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveContent>
>(
  (
    { className, children, position = "popper", ...props },
    ref
  ): ReactJSX.Element => (
    <SelectPrimitivePortal>
      <SelectPrimitiveContent
        className={cn(
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in relative z-50 max-h-[--radix-select-content-available-height] min-w-[8rem] origin-[--radix-select-content-transform-origin] overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        ref={ref}
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectContent's SelectPrimitiveContent prop contract, preserving caller options, children and callbacks.
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitiveViewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitiveViewport>
        <SelectScrollDownButton />
      </SelectPrimitiveContent>
    </SelectPrimitivePortal>
  )
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
SelectContent.displayName = SelectPrimitiveContent.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SelectLabel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const SelectLabel = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveLabel>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveLabel>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <SelectPrimitiveLabel
    className={cn("py-1.5 pr-2 pl-8 text-sm font-semibold", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectLabel's SelectPrimitiveLabel prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
SelectLabel.displayName = SelectPrimitiveLabel.displayName;
/* oxlint-disable react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- SelectItem: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

const SelectItem = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveItem>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveItem>
>(({ className, children, ...props }, ref): ReactJSX.Element => (
  <SelectPrimitiveItem
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectItem's SelectPrimitiveItem prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitiveItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitiveItemIndicator>
    </span>

    <SelectPrimitiveItemText>{children}</SelectPrimitiveItemText>
  </SelectPrimitiveItem>
));
/* oxlint-enable react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
SelectItem.displayName = SelectPrimitiveItem.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SelectSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const SelectSeparator = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveSeparator>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveSeparator>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <SelectPrimitiveSeparator
    className={cn("bg-muted -mx-1 my-1 h-px", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectSeparator's SelectPrimitiveSeparator prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
SelectSeparator.displayName = SelectPrimitiveSeparator.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
