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

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AlertDialog: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialog uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialog = ({
  ...props
}: ReactComponentProps<typeof AlertDialogPrimitiveRoot>): ReactJSX.Element => (
  <AlertDialogPrimitiveRoot
    data-slot="alert-dialog"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialog's AlertDialogPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialogTrigger = ({
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveTrigger
>): ReactJSX.Element => (
  <AlertDialogPrimitiveTrigger
    data-slot="alert-dialog-trigger"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogTrigger's AlertDialogPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogPortal: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogPortal uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialogPortal = ({
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitivePortal
>): ReactJSX.Element => (
  <AlertDialogPrimitivePortal
    data-slot="alert-dialog-portal"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogPortal's AlertDialogPrimitivePortal prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogOverlay: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogOverlay uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialogOverlay = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveOverlay
>): ReactJSX.Element => (
  <AlertDialogPrimitiveOverlay
    // oxlint-disable-next-line react/forbid-component-props -- AlertDialogPrimitiveOverlay accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in fixed inset-0 z-50 bg-black/50",
      className
    )}
    data-slot="alert-dialog-overlay"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogOverlay's AlertDialogPrimitiveOverlay prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialogContent = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveContent
>): ReactJSX.Element => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitiveContent
      // oxlint-disable-next-line react/forbid-component-props -- AlertDialogPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 bg-background data-[state=closed]:animate-out data-[state=open]:animate-in fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
        className
      )}
      data-slot="alert-dialog-content"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogContent's AlertDialogPrimitiveContent prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  </AlertDialogPortal>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogHeader uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialogHeader = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
    data-slot="alert-dialog-header"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogHeader's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogFooter uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
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
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogFooter's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogTitle uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialogTitle = ({
  className,
  ...props
}: ReactComponentProps<typeof AlertDialogPrimitiveTitle>): ReactJSX.Element => (
  <AlertDialogPrimitiveTitle
    // oxlint-disable-next-line react/forbid-component-props -- AlertDialogPrimitiveTitle accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("text-lg font-semibold", className)}
    data-slot="alert-dialog-title"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogTitle's AlertDialogPrimitiveTitle prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogDescription uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialogDescription = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveDescription
>): ReactJSX.Element => (
  <AlertDialogPrimitiveDescription
    // oxlint-disable-next-line react/forbid-component-props -- AlertDialogPrimitiveDescription accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("text-muted-foreground text-sm", className)}
    data-slot="alert-dialog-description"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogDescription's AlertDialogPrimitiveDescription prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogAction: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogAction uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialogAction = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveAction
>): ReactJSX.Element => (
  <AlertDialogPrimitiveAction
    // oxlint-disable-next-line react/forbid-component-props -- AlertDialogPrimitiveAction accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(buttonVariants(), className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogAction's AlertDialogPrimitiveAction prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AlertDialogCancel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- AlertDialogCancel uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDialogCancel = ({
  className,
  ...props
}: ReactComponentProps<
  typeof AlertDialogPrimitiveCancel
>): ReactJSX.Element => (
  <AlertDialogPrimitiveCancel
    // oxlint-disable-next-line react/forbid-component-props -- AlertDialogPrimitiveCancel accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(buttonVariants({ variant: "outline" }), className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDialogCancel's AlertDialogPrimitiveCancel prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
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
