"use client";

/* oxlint-disable import/no-namespace -- @radix-ui/react-dropdown-menu import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
/* oxlint-enable import/no-namespace */
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- DropdownMenu: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenu = ({
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.Root
>): React.JSX.Element => (
  <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuPortal: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuPortal = ({
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.Portal
>): React.JSX.Element => (
  <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuTrigger: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuTrigger = ({
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.Trigger
>): React.JSX.Element => (
  <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuContent = ({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.Content
>): React.JSX.Element => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
        className
      )}
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);
/* oxlint-enable no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuGroup: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuGroup = ({
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.Group
>): React.JSX.Element => (
  <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuItem: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuItem = ({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}): React.JSX.Element => (
  <DropdownMenuPrimitive.Item
    className={cn(
      "data-[variant=destructive]:*:[svg]:!text-destructive focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-inset={inset}
    data-slot="dropdown-menu-item"
    data-variant={variant}
    {...props}
  />
);
/* oxlint-enable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/forbid-component-props, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuCheckboxItem: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuCheckboxItem = ({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.CheckboxItem
>): React.JSX.Element => (
  <DropdownMenuPrimitive.CheckboxItem
    checked={checked}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-slot="dropdown-menu-checkbox-item"
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CheckIcon className="size-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
);
/* oxlint-enable react/forbid-component-props, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuRadioGroup: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuRadioGroup = ({
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.RadioGroup
>): React.JSX.Element => (
  <DropdownMenuPrimitive.RadioGroup
    data-slot="dropdown-menu-radio-group"
    {...props}
  />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/forbid-component-props, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuRadioItem: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuRadioItem = ({
  className,
  children,
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.RadioItem
>): React.JSX.Element => (
  <DropdownMenuPrimitive.RadioItem
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-slot="dropdown-menu-radio-item"
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CircleIcon className="size-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
);
/* oxlint-enable react/forbid-component-props, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuLabel: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuLabel = ({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}): React.JSX.Element => (
  <DropdownMenuPrimitive.Label
    className={cn(
      "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
      className
    )}
    data-inset={inset}
    data-slot="dropdown-menu-label"
    {...props}
  />
);
/* oxlint-enable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuSeparator: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuSeparator = ({
  className,
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.Separator
>): React.JSX.Element => (
  <DropdownMenuPrimitive.Separator
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    data-slot="dropdown-menu-separator"
    {...props}
  />
);
/* oxlint-enable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuShortcut: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"span">). */

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.ComponentProps<"span">): React.JSX.Element => (
  <span
    className={cn(
      "text-muted-foreground ml-auto text-xs tracking-widest",
      className
    )}
    data-slot="dropdown-menu-shortcut"
    {...props}
  />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuSub: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuSub = ({
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.Sub
>): React.JSX.Element => (
  <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuSubTrigger: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuSubTrigger = ({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}): React.JSX.Element => (
  <DropdownMenuPrimitive.SubTrigger
    className={cn(
      "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-inset={inset}
    data-slot="dropdown-menu-sub-trigger"
    {...props}
  >
    {children}
    <ChevronRightIcon className="ml-auto size-4" />
  </DropdownMenuPrimitive.SubTrigger>
);
/* oxlint-enable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DropdownMenuSubContent: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DropdownMenuSubContent = ({
  className,
  ...props
}: React.ComponentProps<
  typeof DropdownMenuPrimitive.SubContent
>): React.JSX.Element => (
  <DropdownMenuPrimitive.SubContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
      className
    )}
    data-slot="dropdown-menu-sub-content"
    {...props}
  />
);
/* oxlint-enable react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

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
