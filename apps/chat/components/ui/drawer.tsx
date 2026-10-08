"use client";

import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

/* oxlint-disable react/react-in-jsx-scope -- Drawer uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Drawer = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    shouldScaleBackground = true,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes shouldScaleBackground from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof DrawerPrimitive.Root>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Drawer's DrawerPrimitive.Root prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */

Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

/* oxlint-disable react/react-in-jsx-scope -- DrawerOverlay uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DrawerOverlay = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Overlay>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <DrawerPrimitive.Overlay
      // oxlint-disable-next-line react/forbid-component-props -- DrawerPrimitive.Overlay accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("fixed inset-0 z-50 bg-black/80", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DrawerOverlay's DrawerPrimitive.Overlay prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

/* oxlint-disable react/react-in-jsx-scope -- DrawerContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DrawerContent = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Content>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, children, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        // oxlint-disable-next-line react/forbid-component-props -- DrawerPrimitive.Content accepts className in its styling contract; preserve this caller's layout and appearance.
        className={cn(
          "bg-background fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border",
          className
        )}
        ref={ref}
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DrawerContent's DrawerPrimitive.Content prop contract, preserving caller options, children and callbacks.
        {...props}
      >
        <div className="bg-muted mx-auto mt-4 h-2 w-[100px] rounded-full" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
);
/* oxlint-enable react/react-in-jsx-scope */

DrawerContent.displayName = "DrawerContent";
/* oxlint-disable react/no-multi-comp -- DrawerHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- DrawerHeader uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DrawerHeader = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactHTMLAttributes<HTMLDivElement>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DrawerHeader's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */
DrawerHeader.displayName = "DrawerHeader";
/* oxlint-disable react/no-multi-comp -- DrawerFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- DrawerFooter uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DrawerFooter = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactHTMLAttributes<HTMLDivElement>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DrawerFooter's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */
DrawerFooter.displayName = "DrawerFooter";

/* oxlint-disable react/react-in-jsx-scope -- DrawerTitle uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DrawerTitle = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Title>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <DrawerPrimitive.Title
      // oxlint-disable-next-line react/forbid-component-props -- DrawerPrimitive.Title accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "text-lg leading-none font-semibold tracking-tight",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DrawerTitle's DrawerPrimitive.Title prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

/* oxlint-disable react/react-in-jsx-scope -- DrawerDescription uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const DrawerDescription = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Description>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <DrawerPrimitive.Description
      // oxlint-disable-next-line react/forbid-component-props -- DrawerPrimitive.Description accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("text-muted-foreground text-sm", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward DrawerDescription's DrawerPrimitive.Description prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerPortal, DrawerTitle, DrawerTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
/* oxlint-enable import/no-named-export */
