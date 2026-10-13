"use client";

import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import {
  Close as SheetPrimitiveClose,
  Content as SheetPrimitiveContent,
  Description as SheetPrimitiveDescription,
  Overlay as SheetPrimitiveOverlay,
  Portal as SheetPrimitivePortal,
  Root as SheetPrimitiveRoot,
  Title as SheetPrimitiveTitle,
  Trigger as SheetPrimitiveTrigger,
} from "@radix-ui/react-dialog";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = (
  props: Readonly<
    Omit<ReactComponentProps<typeof SheetPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => <SheetPrimitiveRoot data-slot="sheet" {...props} />;

const SheetTrigger = (
  props: ReactComponentProps<typeof SheetPrimitiveTrigger>
): ReactJSX.Element => (
  <SheetPrimitiveTrigger data-slot="sheet-trigger" {...props} />
);

const SheetClose = (
  props: ReactComponentProps<typeof SheetPrimitiveClose>
): ReactJSX.Element => (
  <SheetPrimitiveClose data-slot="sheet-close" {...props} />
);

const SheetPortal = (
  props: ReactComponentProps<typeof SheetPrimitivePortal>
): ReactJSX.Element => (
  <SheetPrimitivePortal data-slot="sheet-portal" {...props} />
);

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

const SheetContent = ({
  className,
  children,
  side = "right",
  ...props
}: ReactComponentProps<typeof SheetPrimitiveContent> & {
  readonly side?: "top" | "right" | "bottom" | "left";
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
