"use client";

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
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Check, ChevronDown, ChevronUp } from "lucide-react";
/* oxlint-enable sort-imports */
import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

const Select = SelectPrimitiveRoot;

const SelectGroup = SelectPrimitiveGroup;

const SelectValue = SelectPrimitiveValue;

/* oxlint-disable react/react-in-jsx-scope -- SelectTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SelectTrigger = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveTrigger>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveTrigger>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, children, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <SelectPrimitiveTrigger
      // oxlint-disable-next-line react/forbid-component-props -- SelectPrimitiveTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
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
        <ChevronDown
          // oxlint-disable-next-line react/forbid-component-props -- ChevronDown accepts className in its styling contract; preserve this caller's layout and appearance.
          className="h-4 w-4 opacity-50"
        />
      </SelectPrimitiveIcon>
    </SelectPrimitiveTrigger>
  )
);
/* oxlint-enable react/react-in-jsx-scope */

SelectTrigger.displayName = SelectPrimitiveTrigger.displayName;

/* oxlint-disable react/react-in-jsx-scope -- SelectScrollUpButton uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SelectScrollUpButton = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveScrollUpButton>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveScrollUpButton>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <SelectPrimitiveScrollUpButton
      // oxlint-disable-next-line react/forbid-component-props -- SelectPrimitiveScrollUpButton accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectScrollUpButton's SelectPrimitiveScrollUpButton prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <ChevronUp
        // oxlint-disable-next-line react/forbid-component-props -- ChevronUp accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-4 w-4"
      />
    </SelectPrimitiveScrollUpButton>
  )
);
/* oxlint-enable react/react-in-jsx-scope */

SelectScrollUpButton.displayName = SelectPrimitiveScrollUpButton.displayName;

/* oxlint-disable react/react-in-jsx-scope -- SelectScrollDownButton uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SelectScrollDownButton = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveScrollDownButton>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveScrollDownButton>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <SelectPrimitiveScrollDownButton
      // oxlint-disable-next-line react/forbid-component-props -- SelectPrimitiveScrollDownButton accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectScrollDownButton's SelectPrimitiveScrollDownButton prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <ChevronDown
        // oxlint-disable-next-line react/forbid-component-props -- ChevronDown accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-4 w-4"
      />
    </SelectPrimitiveScrollDownButton>
  )
);
/* oxlint-enable react/react-in-jsx-scope */

SelectScrollDownButton.displayName =
  SelectPrimitiveScrollDownButton.displayName;

/* oxlint-disable react/react-in-jsx-scope -- SelectContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SelectContent = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveContent>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveContent>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children, position from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, children, position = "popper", ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <SelectPrimitivePortal>
      <SelectPrimitiveContent
        // oxlint-disable-next-line react/forbid-component-props -- SelectPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
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
          // oxlint-disable-next-line react/forbid-component-props -- SelectPrimitiveViewport accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-enable react/react-in-jsx-scope */

SelectContent.displayName = SelectPrimitiveContent.displayName;

/* oxlint-disable react/react-in-jsx-scope -- SelectLabel uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SelectLabel = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveLabel>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveLabel>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <SelectPrimitiveLabel
      // oxlint-disable-next-line react/forbid-component-props -- SelectPrimitiveLabel accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("py-1.5 pr-2 pl-8 text-sm font-semibold", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectLabel's SelectPrimitiveLabel prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

SelectLabel.displayName = SelectPrimitiveLabel.displayName;
/* oxlint-disable react/jsx-max-depth -- SelectItem: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- SelectItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SelectItem = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveItem>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveItem>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, children, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <SelectPrimitiveItem
      // oxlint-disable-next-line react/forbid-component-props -- SelectPrimitiveItem accepts className in its styling contract; preserve this caller's layout and appearance.
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
          <Check
            // oxlint-disable-next-line react/forbid-component-props -- Check accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-4 w-4"
          />
        </SelectPrimitiveItemIndicator>
      </span>

      <SelectPrimitiveItemText>{children}</SelectPrimitiveItemText>
    </SelectPrimitiveItem>
  )
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-max-depth */
SelectItem.displayName = SelectPrimitiveItem.displayName;

/* oxlint-disable react/react-in-jsx-scope -- SelectSeparator uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SelectSeparator = reactForwardRef<
  ReactComponentRef<typeof SelectPrimitiveSeparator>,
  ReactComponentPropsWithoutRef<typeof SelectPrimitiveSeparator>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <SelectPrimitiveSeparator
      // oxlint-disable-next-line react/forbid-component-props -- SelectPrimitiveSeparator accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("bg-muted -mx-1 my-1 h-px", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SelectSeparator's SelectPrimitiveSeparator prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

SelectSeparator.displayName = SelectPrimitiveSeparator.displayName;

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/no-named-export */
