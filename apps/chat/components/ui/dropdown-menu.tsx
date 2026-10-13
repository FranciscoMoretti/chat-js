"use client";

import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
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
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { cn } from "@/lib/utils";

const DEFAULT_SIDE_OFFSET = 4;

const DropdownMenu = (
  props: Readonly<
    Omit<ReactComponentProps<typeof DropdownMenuPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <DropdownMenuPrimitiveRoot data-slot="dropdown-menu" {...props} />
);

const DropdownMenuPortal = (
  props: ReactComponentProps<typeof DropdownMenuPrimitivePortal>
): ReactJSX.Element => (
  <DropdownMenuPrimitivePortal data-slot="dropdown-menu-portal" {...props} />
);

const DropdownMenuTrigger = (
  props: ReactComponentProps<typeof DropdownMenuPrimitiveTrigger>
): ReactJSX.Element => (
  <DropdownMenuPrimitiveTrigger data-slot="dropdown-menu-trigger" {...props} />
);

const DropdownMenuContent = ({
  className,
  sideOffset = DEFAULT_SIDE_OFFSET,
  ...props
}: ReactComponentProps<
  typeof DropdownMenuPrimitiveContent
>): ReactJSX.Element => (
  <DropdownMenuPrimitivePortal>
    <DropdownMenuPrimitiveContent
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
        className
      )}
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      {...props}
    />
  </DropdownMenuPrimitivePortal>
);

const DropdownMenuGroup = (
  props: ReactComponentProps<typeof DropdownMenuPrimitiveGroup>
): ReactJSX.Element => (
  <DropdownMenuPrimitiveGroup data-slot="dropdown-menu-group" {...props} />
);

const DropdownMenuItem = ({
  className,
  inset,
  variant = "default",
  ...props
}: ReactComponentProps<typeof DropdownMenuPrimitiveItem> & {
  readonly inset?: boolean;
  readonly variant?: "default" | "destructive";
}): ReactJSX.Element => (
  <DropdownMenuPrimitiveItem
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
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-slot="dropdown-menu-checkbox-item"
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitiveItemIndicator>
        <CheckIcon className="size-4" />
      </DropdownMenuPrimitiveItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitiveCheckboxItem>
);

const DropdownMenuRadioGroup = (
  props: ReactComponentProps<typeof DropdownMenuPrimitiveRadioGroup>
): ReactJSX.Element => (
  <DropdownMenuPrimitiveRadioGroup
    data-slot="dropdown-menu-radio-group"
    {...props}
  />
);

const DropdownMenuRadioItem = ({
  className,
  children,
  ...props
}: ReactComponentProps<
  typeof DropdownMenuPrimitiveRadioItem
>): ReactJSX.Element => (
  <DropdownMenuPrimitiveRadioItem
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-slot="dropdown-menu-radio-item"
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitiveItemIndicator>
        <CircleIcon className="size-2 fill-current" />
      </DropdownMenuPrimitiveItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitiveRadioItem>
);

const DropdownMenuLabel = ({
  className,
  inset,
  ...props
}: ReactComponentProps<typeof DropdownMenuPrimitiveLabel> & {
  readonly inset?: boolean;
}): ReactJSX.Element => (
  <DropdownMenuPrimitiveLabel
    className={cn(
      "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
      className
    )}
    data-inset={inset}
    data-slot="dropdown-menu-label"
    {...props}
  />
);

const DropdownMenuSeparator = ({
  className,
  ...props
}: ReactComponentProps<
  typeof DropdownMenuPrimitiveSeparator
>): ReactJSX.Element => (
  <DropdownMenuPrimitiveSeparator
    className={cn("bg-border -mx-1 my-1 h-px", className)}
    data-slot="dropdown-menu-separator"
    {...props}
  />
);

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
    {...props}
  />
);

const DropdownMenuSub = (
  props: Readonly<
    Omit<ReactComponentProps<typeof DropdownMenuPrimitiveSub>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <DropdownMenuPrimitiveSub data-slot="dropdown-menu-sub" {...props} />
);

const DropdownMenuSubTrigger = ({
  className,
  inset,
  children,
  ...props
}: ReactComponentProps<typeof DropdownMenuPrimitiveSubTrigger> & {
  readonly inset?: boolean;
}): ReactJSX.Element => (
  <DropdownMenuPrimitiveSubTrigger
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
  </DropdownMenuPrimitiveSubTrigger>
);

const DropdownMenuSubContent = ({
  className,
  ...props
}: ReactComponentProps<
  typeof DropdownMenuPrimitiveSubContent
>): ReactJSX.Element => (
  <DropdownMenuPrimitiveSubContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
      className
    )}
    data-slot="dropdown-menu-sub-content"
    {...props}
  />
);

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
