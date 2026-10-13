"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
import {
  Content as SelectPrimitiveContent,
  Group as SelectPrimitiveGroup,
  Icon as SelectPrimitiveIcon,
  Item as SelectPrimitiveItem,
  ItemIndicator as SelectPrimitiveItemIndicator,
  ItemText as SelectPrimitiveItemText,
  Label as SelectPrimitiveLabel,
  Portal as SelectPrimitivePortal,
  Root as SelectPrimitiveRoot,
  ScrollDownButton as SelectPrimitiveScrollDownButton,
  ScrollUpButton as SelectPrimitiveScrollUpButton,
  Separator as SelectPrimitiveSeparator,
  Trigger as SelectPrimitiveTrigger,
  Value as SelectPrimitiveValue,
  Viewport as SelectPrimitiveViewport,
} from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

const Select = SelectPrimitiveRoot;

const SelectGroup = SelectPrimitiveGroup;

const SelectValue = SelectPrimitiveValue;

const SelectTrigger = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveTrigger>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveTrigger>
>(
  (
    { className, children, ...props },

    ref
  ): ReactJSX.Element => (
    <SelectPrimitiveTrigger
      className={cn(
        "border-input bg-background ring-offset-background focus:ring-ring data-[placeholder]:text-muted-foreground flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
      <SelectPrimitiveIcon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitiveIcon>
    </SelectPrimitiveTrigger>
  )
);

SelectTrigger.displayName = SelectPrimitiveTrigger.displayName;

const SelectScrollUpButton = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveScrollUpButton>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveScrollUpButton>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <SelectPrimitiveScrollUpButton
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      ref={ref}
      {...props}
    >
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitiveScrollUpButton>
  )
);

SelectScrollUpButton.displayName = SelectPrimitiveScrollUpButton.displayName;

const SelectScrollDownButton = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveScrollDownButton>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveScrollDownButton>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <SelectPrimitiveScrollDownButton
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      ref={ref}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitiveScrollDownButton>
  )
);

SelectScrollDownButton.displayName =
  SelectPrimitiveScrollDownButton.displayName;

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

SelectContent.displayName = SelectPrimitiveContent.displayName;

const SelectLabel = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveLabel>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveLabel>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <SelectPrimitiveLabel
      className={cn("py-1.5 pr-2 pl-8 text-sm font-semibold", className)}
      ref={ref}
      {...props}
    />
  )
);

SelectLabel.displayName = SelectPrimitiveLabel.displayName;

const SelectItem = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveItem>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveItem>
>(
  (
    { className, children, ...props },

    ref
  ): ReactJSX.Element => (
    <SelectPrimitiveItem
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitiveItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitiveItemIndicator>
      </span>

      <SelectPrimitiveItemText>{children}</SelectPrimitiveItemText>
    </SelectPrimitiveItem>
  )
);
SelectItem.displayName = SelectPrimitiveItem.displayName;

const SelectSeparator = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveSeparator>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveSeparator>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <SelectPrimitiveSeparator
      className={cn("bg-muted -mx-1 my-1 h-px", className)}
      ref={ref}
      {...props}
    />
  )
);

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
