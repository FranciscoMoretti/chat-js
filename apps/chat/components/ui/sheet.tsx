"use client";

import {
  Root as SheetPrimitiveRoot,
  Trigger as SheetPrimitiveTrigger,
  Close as SheetPrimitiveClose,
  Portal as SheetPrimitivePortal,
  Overlay as SheetPrimitiveOverlay,
  Content as SheetPrimitiveContent,
  Title as SheetPrimitiveTitle,
  Description as SheetPrimitiveDescription,
} from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Sheet: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ...props }: React.ComponentProps<typeof SheetPrimitive.Root>). */

const Sheet = ({
  ...props
}: ReactComponentProps<typeof SheetPrimitiveRoot>): ReactJSX.Element => (
  <SheetPrimitiveRoot data-slot="sheet" {...props} />
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SheetTrigger = ({
  ...props
}: ReactComponentProps<typeof SheetPrimitiveTrigger>): ReactJSX.Element => (
  <SheetPrimitiveTrigger data-slot="sheet-trigger" {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetClose: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SheetClose = ({
  ...props
}: ReactComponentProps<typeof SheetPrimitiveClose>): ReactJSX.Element => (
  <SheetPrimitiveClose data-slot="sheet-close" {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetPortal: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SheetPortal = ({
  ...props
}: ReactComponentProps<typeof SheetPrimitivePortal>): ReactJSX.Element => (
  <SheetPrimitivePortal data-slot="sheet-portal" {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetOverlay: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SheetOverlay = ({
  className,
  ...props
}: ReactComponentProps<typeof SheetPrimitiveOverlay>): ReactJSX.Element => (
  <SheetPrimitiveOverlay
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in fixed inset-0 z-50 bg-black/50",
      className
    )}
    data-slot="sheet-overlay"
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetContent: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SheetContent = ({
  className,
  children,
  side = "right",
  ...props
}: ReactComponentProps<typeof SheetPrimitiveContent> & {
  side?: "top" | "right" | "bottom" | "left";
}): ReactJSX.Element => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitiveContent
      className={cn(
        "bg-background data-[state=closed]:animate-out data-[state=open]:animate-in fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
        side === "right" &&
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
        side === "left" &&
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        side === "top" &&
          "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
        side === "bottom" &&
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
        className
      )}
      data-slot="sheet-content"
      {...props}
    >
      {children}
      <SheetPrimitiveClose className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
        <XIcon className="size-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitiveClose>
    </SheetPrimitiveContent>
  </SheetPortal>
);
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const SheetHeader = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("flex flex-col gap-1.5 p-4", className)}
    data-slot="sheet-header"
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const SheetFooter = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    data-slot="sheet-footer"
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SheetTitle = ({
  className,
  ...props
}: ReactComponentProps<typeof SheetPrimitiveTitle>): ReactJSX.Element => (
  <SheetPrimitiveTitle
    className={cn("text-foreground font-semibold", className)}
    data-slot="sheet-title"
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const SheetDescription = ({
  className,
  ...props
}: ReactComponentProps<typeof SheetPrimitiveDescription>): ReactJSX.Element => (
  <SheetPrimitiveDescription
    className={cn("text-muted-foreground text-sm", className)}
    data-slot="sheet-description"
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
