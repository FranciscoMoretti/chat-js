"use client";

import {
  CheckboxItem as DropdownMenuPrimitiveCheckboxItem,
  Content as DropdownMenuPrimitiveContent,
  Group as DropdownMenuPrimitiveGroup,
  Item as DropdownMenuPrimitiveItem,
  ItemIndicator as DropdownMenuPrimitiveItemIndicator,
  Label as DropdownMenuPrimitiveLabel,
  Portal as DropdownMenuPrimitivePortal,
  RadioGroup as DropdownMenuPrimitiveRadioGroup,
  RadioItem as DropdownMenuPrimitiveRadioItem,
  Root as DropdownMenuPrimitiveRoot,
  Separator as DropdownMenuPrimitiveSeparator,
  Sub as DropdownMenuPrimitiveSub,
  SubContent as DropdownMenuPrimitiveSubContent,
  SubTrigger as DropdownMenuPrimitiveSubTrigger,
  Trigger as DropdownMenuPrimitiveTrigger,
} from "@radix-ui/react-dropdown-menu";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
/* oxlint-enable sort-imports */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { cn } from "@/lib/utils";

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenu uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenu = (
  props: Readonly<
    Omit<ReactComponentProps<typeof DropdownMenuPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <DropdownMenuPrimitiveRoot
    data-slot="dropdown-menu"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenu's DropdownMenuPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */

/* oxlint-disable react/no-multi-comp -- DropdownMenuPortal: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuPortal uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuPortal = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  props: ReactComponentProps<typeof DropdownMenuPrimitivePortal>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitivePortal
    data-slot="dropdown-menu-portal"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuPortal's DropdownMenuPrimitivePortal prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuTrigger = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  props: ReactComponentProps<typeof DropdownMenuPrimitiveTrigger>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveTrigger
    data-slot="dropdown-menu-trigger"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuTrigger's DropdownMenuPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable no-magic-numbers, react/no-multi-comp -- DropdownMenuContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DropdownMenuContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    sideOffset = 4,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, sideOffset from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DropdownMenuPrimitiveContent>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitivePortal>
    <DropdownMenuPrimitiveContent
      // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
        className
      )}
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuContent's DropdownMenuPrimitiveContent prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  </DropdownMenuPrimitivePortal>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable no-magic-numbers, react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuGroup: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuGroup uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuGroup = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  props: ReactComponentProps<typeof DropdownMenuPrimitiveGroup>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveGroup
    data-slot="dropdown-menu-group"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuGroup's DropdownMenuPrimitiveGroup prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DropdownMenuItem = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    inset,
    variant = "default",
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, inset, variant from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DropdownMenuPrimitiveItem> & {
    readonly inset?: boolean;
    readonly variant?: "default" | "destructive";
  }
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveItem
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuPrimitiveItem accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "data-[variant=destructive]:*:[svg]:!text-destructive focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-inset={inset}
    data-slot="dropdown-menu-item"
    data-variant={variant}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuItem's DropdownMenuPrimitiveItem prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp -- DropdownMenuCheckboxItem: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuCheckboxItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DropdownMenuCheckboxItem = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    checked,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children, checked from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DropdownMenuPrimitiveCheckboxItem>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveCheckboxItem
    checked={checked}
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuPrimitiveCheckboxItem accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-slot="dropdown-menu-checkbox-item"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuCheckboxItem's DropdownMenuPrimitiveCheckboxItem prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitiveItemIndicator>
        <CheckIcon
          // oxlint-disable-next-line react/forbid-component-props -- CheckIcon accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-4"
        />
      </DropdownMenuPrimitiveItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitiveCheckboxItem>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuRadioGroup: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuRadioGroup uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuRadioGroup = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  props: ReactComponentProps<typeof DropdownMenuPrimitiveRadioGroup>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveRadioGroup
    data-slot="dropdown-menu-radio-group"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuRadioGroup's DropdownMenuPrimitiveRadioGroup prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp -- DropdownMenuRadioItem: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuRadioItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DropdownMenuRadioItem = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DropdownMenuPrimitiveRadioItem>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveRadioItem
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuPrimitiveRadioItem accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-slot="dropdown-menu-radio-item"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuRadioItem's DropdownMenuPrimitiveRadioItem prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitiveItemIndicator>
        <CircleIcon
          // oxlint-disable-next-line react/forbid-component-props -- CircleIcon accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-2 fill-current"
        />
      </DropdownMenuPrimitiveItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitiveRadioItem>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuLabel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuLabel uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DropdownMenuLabel = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    inset,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, inset from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DropdownMenuPrimitiveLabel> & {
    readonly inset?: boolean;
  }
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveLabel
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuPrimitiveLabel accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
      className
    )}
    data-inset={inset}
    data-slot="dropdown-menu-label"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuLabel's DropdownMenuPrimitiveLabel prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuSeparator uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DropdownMenuSeparator = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DropdownMenuPrimitiveSeparator>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveSeparator
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuPrimitiveSeparator accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    data-slot="dropdown-menu-separator"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuSeparator's DropdownMenuPrimitiveSeparator prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuShortcut: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuShortcut uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DropdownMenuShortcut = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"span">
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <span
    className={cn(
      "text-muted-foreground ml-auto text-xs tracking-widest",
      className
    )}
    data-slot="dropdown-menu-shortcut"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuShortcut's native span attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuSub: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuSub uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuSub = (
  props: Readonly<
    Omit<ReactComponentProps<typeof DropdownMenuPrimitiveSub>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <DropdownMenuPrimitiveSub
    data-slot="dropdown-menu-sub"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuSub's DropdownMenuPrimitiveSub prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuSubTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuSubTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DropdownMenuSubTrigger = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    inset,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, inset, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DropdownMenuPrimitiveSubTrigger> & {
    readonly inset?: boolean;
  }
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveSubTrigger
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuPrimitiveSubTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-inset={inset}
    data-slot="dropdown-menu-sub-trigger"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuSubTrigger's DropdownMenuPrimitiveSubTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    {children}
    <ChevronRightIcon
      // oxlint-disable-next-line react/forbid-component-props -- ChevronRightIcon accepts className in its styling contract; preserve this caller's layout and appearance.
      className="ml-auto size-4"
    />
  </DropdownMenuPrimitiveSubTrigger>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DropdownMenuSubContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuSubContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DropdownMenuSubContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DropdownMenuPrimitiveSubContent>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DropdownMenuPrimitiveSubContent
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuPrimitiveSubContent accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
      className
    )}
    data-slot="dropdown-menu-sub-content"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuSubContent's DropdownMenuPrimitiveSubContent prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
/* oxlint-enable import/no-named-export */

/* oxlint-disable max-lines -- Parameter-scoped native readonly boundaries expand this existing primitive family after formatting; its runtime implementation and composition remain unchanged. */
