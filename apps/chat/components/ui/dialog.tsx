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
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = (
  props: Readonly<
    Omit<ReactComponentProps<typeof DialogPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => <DialogPrimitiveRoot data-slot="dialog" {...props} />;

const DialogTrigger = (
  props: ReactComponentProps<typeof DialogPrimitiveTrigger>
): ReactJSX.Element => (
  <DialogPrimitiveTrigger data-slot="dialog-trigger" {...props} />
);

const DialogPortal = (
  props: ReactComponentProps<typeof DialogPrimitivePortal>
): ReactJSX.Element => (
  <DialogPrimitivePortal data-slot="dialog-portal" {...props} />
);

const DialogClose = (
  props: ReactComponentProps<typeof DialogPrimitiveClose>
): ReactJSX.Element => (
  <DialogPrimitiveClose data-slot="dialog-close" {...props} />
);

const DialogOverlay = ({
  className,
  ...props
}: ReactComponentProps<typeof DialogPrimitiveOverlay>): ReactJSX.Element => (
  <DialogPrimitiveOverlay
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in fixed inset-0 z-50 bg-black/50",
      className
    )}
    data-slot="dialog-overlay"
    {...props}
  />
);

const DialogContent = ({
  className,
  children,
  showCloseButton = true,
  ...props
}: ReactComponentProps<typeof DialogPrimitiveContent> & {
  readonly showCloseButton?: boolean;
}): ReactJSX.Element => (
  <DialogPortal data-slot="dialog-portal">
    <DialogOverlay />
    <DialogPrimitiveContent
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 bg-background data-[state=closed]:animate-out data-[state=open]:animate-in fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
        className
      )}
      data-slot="dialog-content"
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitiveClose
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

const DialogHeader = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
    data-slot="dialog-header"
    {...props}
  />
);

const DialogFooter = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className
    )}
    data-slot="dialog-footer"
    {...props}
  />
);

const DialogTitle = ({
  className,
  ...props
}: ReactComponentProps<typeof DialogPrimitiveTitle>): ReactJSX.Element => (
  <DialogPrimitiveTitle
    className={cn("text-lg leading-none font-semibold", className)}
    data-slot="dialog-title"
    {...props}
  />
);

const DialogDescription = ({
  className,
  ...props
}: ReactComponentProps<
  typeof DialogPrimitiveDescription
>): ReactJSX.Element => (
  <DialogPrimitiveDescription
    className={cn("text-muted-foreground text-sm", className)}
    data-slot="dialog-description"
    {...props}
  />
);

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
