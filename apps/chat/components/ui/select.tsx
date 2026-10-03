"use client";

/* oxlint-disable import/no-namespace -- @radix-ui/react-select import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as SelectPrimitive from "@radix-ui/react-select";
/* oxlint-enable import/no-namespace */
import { Check, ChevronDown, ChevronUp } from "lucide-react";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SelectTrigger: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref): React.JSX.Element => (
  <SelectPrimitive.Trigger
    className={cn(
      "border-input bg-background ring-offset-background focus:ring-ring data-[placeholder]:text-muted-foreground flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    ref={ref}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SelectScrollUpButton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const SelectScrollUpButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref): React.JSX.Element => (
  <SelectPrimitive.ScrollUpButton
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    ref={ref}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SelectScrollDownButton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const SelectScrollDownButton = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref): React.JSX.Element => (
  <SelectPrimitive.ScrollDownButton
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    ref={ref}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SelectContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, position = "popper", ...props }). */

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(
  (
    { className, children, position = "popper", ...props },
    ref
  ): React.JSX.Element => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
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
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
SelectContent.displayName = SelectPrimitive.Content.displayName;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SelectLabel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref): React.JSX.Element => (
  <SelectPrimitive.Label
    className={cn("py-1.5 pr-2 pl-8 text-sm font-semibold", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
SelectLabel.displayName = SelectPrimitive.Label.displayName;
/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SelectItem: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref): React.JSX.Element => (
  <SelectPrimitive.Item
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
SelectItem.displayName = SelectPrimitive.Item.displayName;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SelectSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref): React.JSX.Element => (
  <SelectPrimitive.Separator
    className={cn("bg-muted -mx-1 my-1 h-px", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

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
