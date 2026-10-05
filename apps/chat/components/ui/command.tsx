"use client";

import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Command: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- Command uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Command = ({
  className,
  ...props
}: ReactComponentProps<typeof CommandPrimitive>): ReactJSX.Element => (
  <CommandPrimitive
    // oxlint-disable-next-line react/forbid-component-props -- CommandPrimitive accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
      className
    )}
    data-slot="command"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Command's CommandPrimitive prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CommandDialog: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- CommandDialog uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CommandDialog = ({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = true,
  ...props
}: ReactComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
}): ReactJSX.Element => (
  <Dialog
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CommandDialog's Dialog prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <DialogHeader
      // oxlint-disable-next-line react/forbid-component-props -- DialogHeader accepts className in its styling contract; preserve this caller's layout and appearance.
      className="sr-only"
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
    <DialogContent
      // oxlint-disable-next-line react/forbid-component-props -- DialogContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("overflow-hidden p-0", className)}
      showCloseButton={showCloseButton}
    >
      <Command
        // oxlint-disable-next-line react/forbid-component-props -- Command accepts className in its styling contract; preserve this caller's layout and appearance.
        className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
      >
        {children}
      </Command>
    </DialogContent>
  </Dialog>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CommandInput: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- CommandInput uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CommandInput = ({
  className,
  containerClassName,
  ...props
}: ReactComponentProps<typeof CommandPrimitive.Input> & {
  containerClassName?: string;
}): ReactJSX.Element => (
  <div
    className={cn("flex items-center gap-2 px-3", containerClassName)}
    data-slot="command-input-wrapper"
  >
    <SearchIcon
      // oxlint-disable-next-line react/forbid-component-props -- SearchIcon accepts className in its styling contract; preserve this caller's layout and appearance.
      className="size-4 shrink-0 opacity-50"
    />
    <CommandPrimitive.Input
      // oxlint-disable-next-line react/forbid-component-props -- CommandPrimitive.Input accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      data-slot="command-input"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CommandInput's CommandPrimitive.Input prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  </div>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CommandList: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- CommandList uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CommandList = ({
  className,
  ...props
}: ReactComponentProps<typeof CommandPrimitive.List>): ReactJSX.Element => (
  <CommandPrimitive.List
    // oxlint-disable-next-line react/forbid-component-props -- CommandPrimitive.List accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto",
      className
    )}
    data-slot="command-list"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CommandList's CommandPrimitive.List prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CommandEmpty: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- CommandEmpty uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CommandEmpty = ({
  ...props
}: ReactComponentProps<typeof CommandPrimitive.Empty>): ReactJSX.Element => (
  <CommandPrimitive.Empty
    // oxlint-disable-next-line react/forbid-component-props -- CommandPrimitive.Empty accepts className in its styling contract; preserve this caller's layout and appearance.
    className="py-6 text-center text-sm"
    data-slot="command-empty"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CommandEmpty's CommandPrimitive.Empty prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CommandGroup: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- CommandGroup uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CommandGroup = ({
  className,
  ...props
}: ReactComponentProps<typeof CommandPrimitive.Group>): ReactJSX.Element => (
  <CommandPrimitive.Group
    // oxlint-disable-next-line react/forbid-component-props -- CommandPrimitive.Group accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
      className
    )}
    data-slot="command-group"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CommandGroup's CommandPrimitive.Group prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CommandSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- CommandSeparator uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CommandSeparator = ({
  className,
  ...props
}: ReactComponentProps<
  typeof CommandPrimitive.Separator
>): ReactJSX.Element => (
  <CommandPrimitive.Separator
    // oxlint-disable-next-line react/forbid-component-props -- CommandPrimitive.Separator accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("bg-border -mx-1 h-px", className)}
    data-slot="command-separator"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CommandSeparator's CommandPrimitive.Separator prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CommandItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- CommandItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CommandItem = ({
  className,
  ...props
}: ReactComponentProps<typeof CommandPrimitive.Item>): ReactJSX.Element => (
  <CommandPrimitive.Item
    // oxlint-disable-next-line react/forbid-component-props -- CommandPrimitive.Item accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    data-slot="command-item"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CommandItem's CommandPrimitive.Item prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CommandShortcut: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"span">). */

/* oxlint-disable react/react-in-jsx-scope -- CommandShortcut uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CommandShortcut = ({
  className,
  ...props
}: ReactComponentProps<"span">): ReactJSX.Element => (
  <span
    className={cn(
      "text-muted-foreground ml-auto text-xs tracking-widest",
      className
    )}
    data-slot="command-shortcut"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CommandShortcut's native span attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
/* oxlint-enable import/no-named-export */
