"use client";

import {
  Action as AlertDialogPrimitiveAction,
  Cancel as AlertDialogPrimitiveCancel,
  Content as AlertDialogPrimitiveContent,
  Description as AlertDialogPrimitiveDescription,
  Overlay as AlertDialogPrimitiveOverlay,
  Portal as AlertDialogPrimitivePortal,
  Root as AlertDialogPrimitiveRoot,
  Title as AlertDialogPrimitiveTitle,
  Trigger as AlertDialogPrimitiveTrigger,
} from "@radix-ui/react-alert-dialog";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AlertDialog = (
  props: Readonly<
    Omit<ReactComponentProps<typeof AlertDialogPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <AlertDialogPrimitiveRoot data-slot="alert-dialog" {...props} />
);

const AlertDialogTrigger = (
  props: ReactComponentProps<typeof AlertDialogPrimitiveTrigger>
): ReactJSX.Element => (
  <AlertDialogPrimitiveTrigger data-slot="alert-dialog-trigger" {...props} />
);

const AlertDialogPortal = (
  props: ReactComponentProps<typeof AlertDialogPrimitivePortal>
): ReactJSX.Element => (
  <AlertDialogPrimitivePortal data-slot="alert-dialog-portal" {...props} />
);

const AlertDialogOverlay = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveOverlay
>): ReactJSX.Element => (
  <AlertDialogPrimitiveOverlay
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in fixed inset-0 z-50 bg-black/50",
      className
    )}
    data-slot="alert-dialog-overlay"
    {...props}
  />
);

const AlertDialogContent = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveContent
>): ReactJSX.Element => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitiveContent
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 bg-background data-[state=closed]:animate-out data-[state=open]:animate-in fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
        className
      )}
      data-slot="alert-dialog-content"
      {...props}
    />
  </AlertDialogPortal>
);

const AlertDialogHeader = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
    data-slot="alert-dialog-header"
    {...props}
  />
);

const AlertDialogFooter = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className
    )}
    data-slot="alert-dialog-footer"
    {...props}
  />
);

const AlertDialogTitle = ({
  className,
  ...props
}: ReactComponentProps<typeof AlertDialogPrimitiveTitle>): ReactJSX.Element => (
  <AlertDialogPrimitiveTitle
    className={cn("text-lg font-semibold", className)}
    data-slot="alert-dialog-title"
    {...props}
  />
);

const AlertDialogDescription = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveDescription
>): ReactJSX.Element => (
  <AlertDialogPrimitiveDescription
    className={cn("text-muted-foreground text-sm", className)}
    data-slot="alert-dialog-description"
    {...props}
  />
);

const AlertDialogAction = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveAction
>): ReactJSX.Element => (
  <AlertDialogPrimitiveAction
    className={cn(buttonVariants(), className)}
    {...props}
  />
);

const AlertDialogCancel = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveCancel
>): ReactJSX.Element => (
  <AlertDialogPrimitiveCancel
    className={cn(buttonVariants({ variant: "outline" }), className)}
    {...props}
  />
);

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
