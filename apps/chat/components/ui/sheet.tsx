"use client";

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
import { XIcon } from "lucide-react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Sheet: typescript/prefer-readonly-parameter-types: Radix Dialog root props preserve its existing modal state and callback contracts. */

/* oxlint-disable react/react-in-jsx-scope -- Sheet uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Sheet = (
  props: ReactComponentProps<typeof SheetPrimitiveRoot>
): ReactJSX.Element => (
  <SheetPrimitiveRoot
    data-slot="sheet"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Sheet's SheetPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SheetTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SheetTrigger = (
  props: ReactComponentProps<typeof SheetPrimitiveTrigger>
): ReactJSX.Element => (
  <SheetPrimitiveTrigger
    data-slot="sheet-trigger"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SheetTrigger's SheetPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetClose: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SheetClose uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SheetClose = (
  props: ReactComponentProps<typeof SheetPrimitiveClose>
): ReactJSX.Element => (
  <SheetPrimitiveClose
    data-slot="sheet-close"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SheetClose's SheetPrimitiveClose prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetPortal: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SheetPortal uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SheetPortal = (
  props: ReactComponentProps<typeof SheetPrimitivePortal>
): ReactJSX.Element => (
  <SheetPrimitivePortal
    data-slot="sheet-portal"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SheetPortal's SheetPrimitivePortal prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetOverlay: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SheetOverlay uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SheetOverlay = ({
  className,
  ...props
}: ReactComponentProps<typeof SheetPrimitiveOverlay>): ReactJSX.Element => (
  <SheetPrimitiveOverlay
    // oxlint-disable-next-line react/forbid-component-props -- SheetPrimitiveOverlay accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in fixed inset-0 z-50 bg-black/50",
      className
    )}
    data-slot="sheet-overlay"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SheetOverlay's SheetPrimitiveOverlay prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-disable react/jsx-no-literals -- SheetContent renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetContent: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SheetContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
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
      // oxlint-disable-next-line react/forbid-component-props -- SheetPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
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
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SheetContent's SheetPrimitiveContent prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children}
      <SheetPrimitiveClose
        // oxlint-disable-next-line react/forbid-component-props -- SheetPrimitiveClose accepts className in its styling contract; preserve this caller's layout and appearance.
        className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
      >
        <XIcon
          // oxlint-disable-next-line react/forbid-component-props -- XIcon accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-4"
        />
        <span className="sr-only">Close</span>
      </SheetPrimitiveClose>
    </SheetPrimitiveContent>
  </SheetPortal>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- SheetHeader uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SheetHeader = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("flex flex-col gap-1.5 p-4", className)}
    data-slot="sheet-header"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SheetHeader's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- SheetFooter uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SheetFooter = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    data-slot="sheet-footer"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SheetFooter's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SheetTitle uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SheetTitle = ({
  className,
  ...props
}: ReactComponentProps<typeof SheetPrimitiveTitle>): ReactJSX.Element => (
  <SheetPrimitiveTitle
    // oxlint-disable-next-line react/forbid-component-props -- SheetPrimitiveTitle accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("text-foreground font-semibold", className)}
    data-slot="sheet-title"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SheetTitle's SheetPrimitiveTitle prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SheetDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SheetDescription uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SheetDescription = ({
  className,
  ...props
}: ReactComponentProps<typeof SheetPrimitiveDescription>): ReactJSX.Element => (
  <SheetPrimitiveDescription
    // oxlint-disable-next-line react/forbid-component-props -- SheetPrimitiveDescription accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("text-muted-foreground text-sm", className)}
    data-slot="sheet-description"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SheetDescription's SheetPrimitiveDescription prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
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
/* oxlint-enable import/no-named-export */
