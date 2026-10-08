"use client";

import {
  Close as DialogPrimitiveClose,
  Content as DialogPrimitiveContent,
  Description as DialogPrimitiveDescription,
  Overlay as DialogPrimitiveOverlay,
  Portal as DialogPrimitivePortal,
  Root as DialogPrimitiveRoot,
  Title as DialogPrimitiveTitle,
  Trigger as DialogPrimitiveTrigger,
} from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { cn } from "@/lib/utils";

/* oxlint-disable react/react-in-jsx-scope -- Dialog uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Dialog = (
  props: Readonly<
    Omit<ReactComponentProps<typeof DialogPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <DialogPrimitiveRoot
    data-slot="dialog"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Dialog's DialogPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */

/* oxlint-disable react/no-multi-comp -- DialogTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DialogTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DialogTrigger = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  props: ReactComponentProps<typeof DialogPrimitiveTrigger>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DialogPrimitiveTrigger
    data-slot="dialog-trigger"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DialogTrigger's DialogPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DialogPortal: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DialogPortal uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DialogPortal = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  props: ReactComponentProps<typeof DialogPrimitivePortal>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DialogPrimitivePortal
    data-slot="dialog-portal"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DialogPortal's DialogPrimitivePortal prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DialogClose: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DialogClose uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DialogClose = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  props: ReactComponentProps<typeof DialogPrimitiveClose>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DialogPrimitiveClose
    data-slot="dialog-close"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DialogClose's DialogPrimitiveClose prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DialogOverlay: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DialogOverlay uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DialogOverlay = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DialogPrimitiveOverlay>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DialogPrimitiveOverlay
    // oxlint-disable-next-line react/forbid-component-props -- DialogPrimitiveOverlay accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in fixed inset-0 z-50 bg-black/50",
      className
    )}
    data-slot="dialog-overlay"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DialogOverlay's DialogPrimitiveOverlay prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-disable react/jsx-no-literals -- DialogContent renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp -- DialogContent: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DialogContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DialogContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    showCloseButton = true,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children, showCloseButton from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DialogPrimitiveContent> & {
    readonly showCloseButton?: boolean;
  }
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DialogPortal data-slot="dialog-portal">
    <DialogOverlay />
    <DialogPrimitiveContent
      // oxlint-disable-next-line react/forbid-component-props -- DialogPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 bg-background data-[state=closed]:animate-out data-[state=open]:animate-in fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
        className
      )}
      data-slot="dialog-content"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DialogContent's DialogPrimitiveContent prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitiveClose
          // oxlint-disable-next-line react/forbid-component-props -- DialogPrimitiveClose accepts className in its styling contract; preserve this caller's layout and appearance.
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          data-slot="dialog-close"
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitiveClose>
      )}
    </DialogPrimitiveContent>
  </DialogPortal>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DialogHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DialogHeader uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DialogHeader = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <div
    className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
    data-slot="dialog-header"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DialogHeader's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DialogFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DialogFooter uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DialogFooter = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className
    )}
    data-slot="dialog-footer"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DialogFooter's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DialogTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DialogTitle uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DialogTitle = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DialogPrimitiveTitle>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DialogPrimitiveTitle
    // oxlint-disable-next-line react/forbid-component-props -- DialogPrimitiveTitle accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("text-lg leading-none font-semibold", className)}
    data-slot="dialog-title"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DialogTitle's DialogPrimitiveTitle prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- DialogDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- DialogDescription uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const DialogDescription = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DialogPrimitiveDescription>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DialogPrimitiveDescription
    // oxlint-disable-next-line react/forbid-component-props -- DialogPrimitiveDescription accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("text-muted-foreground text-sm", className)}
    data-slot="dialog-description"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DialogDescription's DialogPrimitiveDescription prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
/* oxlint-enable import/no-named-export */
