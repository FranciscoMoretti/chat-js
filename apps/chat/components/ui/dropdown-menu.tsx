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

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- DropdownMenu: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenu uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenu = (
  props: ReactComponentProps<typeof DropdownMenuPrimitiveRoot>
): ReactJSX.Element => (
  <DropdownMenuPrimitiveRoot
    data-slot="dropdown-menu"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenu's DropdownMenuPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuPortal: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuPortal uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuPortal = (
  props: ReactComponentProps<typeof DropdownMenuPrimitivePortal>
): ReactJSX.Element => (
  <DropdownMenuPrimitivePortal
    data-slot="dropdown-menu-portal"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuPortal's DropdownMenuPrimitivePortal prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuTrigger = (
  props: ReactComponentProps<typeof DropdownMenuPrimitiveTrigger>
): ReactJSX.Element => (
  <DropdownMenuPrimitiveTrigger
    data-slot="dropdown-menu-trigger"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuTrigger's DropdownMenuPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuContent = ({
  className,
  sideOffset = 4,
  ...props
}: ReactComponentProps<
  typeof DropdownMenuPrimitiveContent
>): ReactJSX.Element => (
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
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuGroup: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuGroup uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuGroup = (
  props: ReactComponentProps<typeof DropdownMenuPrimitiveGroup>
): ReactJSX.Element => (
  <DropdownMenuPrimitiveGroup
    data-slot="dropdown-menu-group"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuGroup's DropdownMenuPrimitiveGroup prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuItem = ({
  className,
  inset,
  variant = "default",
  ...props
}: ReactComponentProps<typeof DropdownMenuPrimitiveItem> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}): ReactJSX.Element => (
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuCheckboxItem: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuCheckboxItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuCheckboxItem = ({
  className,
  children,
  checked,
  ...props
}: ReactComponentProps<
  typeof DropdownMenuPrimitiveCheckboxItem
>): ReactJSX.Element => (
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
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuRadioGroup: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuRadioGroup uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuRadioGroup = (
  props: ReactComponentProps<typeof DropdownMenuPrimitiveRadioGroup>
): ReactJSX.Element => (
  <DropdownMenuPrimitiveRadioGroup
    data-slot="dropdown-menu-radio-group"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuRadioGroup's DropdownMenuPrimitiveRadioGroup prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuRadioItem: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuRadioItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuRadioItem = ({
  className,
  children,
  ...props
}: ReactComponentProps<
  typeof DropdownMenuPrimitiveRadioItem
>): ReactJSX.Element => (
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
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuLabel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuLabel uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuLabel = ({
  className,
  inset,
  ...props
}: ReactComponentProps<typeof DropdownMenuPrimitiveLabel> & {
  inset?: boolean;
}): ReactJSX.Element => (
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuSeparator uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuSeparator = ({
  className,
  ...props
}: ReactComponentProps<
  typeof DropdownMenuPrimitiveSeparator
>): ReactJSX.Element => (
  <DropdownMenuPrimitiveSeparator
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuPrimitiveSeparator accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    data-slot="dropdown-menu-separator"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuSeparator's DropdownMenuPrimitiveSeparator prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuShortcut: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"span">). */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuShortcut uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuShortcut = ({
  className,
  ...props
}: ReactComponentProps<"span">): ReactJSX.Element => (
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuSub: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuSub uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuSub = (
  props: ReactComponentProps<typeof DropdownMenuPrimitiveSub>
): ReactJSX.Element => (
  <DropdownMenuPrimitiveSub
    data-slot="dropdown-menu-sub"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DropdownMenuSub's DropdownMenuPrimitiveSub prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuSubTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuSubTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuSubTrigger = ({
  className,
  inset,
  children,
  ...props
}: ReactComponentProps<typeof DropdownMenuPrimitiveSubTrigger> & {
  inset?: boolean;
}): ReactJSX.Element => (
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuSubContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- DropdownMenuSubContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DropdownMenuSubContent = ({
  className,
  ...props
}: ReactComponentProps<
  typeof DropdownMenuPrimitiveSubContent
>): ReactJSX.Element => (
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
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

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
