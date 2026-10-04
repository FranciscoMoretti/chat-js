"use client";

import {
  Root as AlertDialogPrimitiveRoot,
  Trigger as AlertDialogPrimitiveTrigger,
  Portal as AlertDialogPrimitivePortal,
  Overlay as AlertDialogPrimitiveOverlay,
  Content as AlertDialogPrimitiveContent,
  Title as AlertDialogPrimitiveTitle,
  Description as AlertDialogPrimitiveDescription,
  Action as AlertDialogPrimitiveAction,
  Cancel as AlertDialogPrimitiveCancel,
} from "@radix-ui/react-alert-dialog";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AlertDialog: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const AlertDialog = ({
  ...props
}: ReactComponentProps<typeof AlertDialogPrimitiveRoot>): ReactJSX.Element => (
  <AlertDialogPrimitiveRoot data-slot="alert-dialog" {...props} />
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const AlertDialogTrigger = ({
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveTrigger
>): ReactJSX.Element => (
  <AlertDialogPrimitiveTrigger data-slot="alert-dialog-trigger" {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogPortal: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const AlertDialogPortal = ({
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitivePortal
>): ReactJSX.Element => (
  <AlertDialogPrimitivePortal data-slot="alert-dialog-portal" {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogOverlay: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogAction: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogCancel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

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
