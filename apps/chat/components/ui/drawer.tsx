"use client";

import { forwardRef as reactForwardRef } from "react";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
  ComponentRef as ReactComponentRef,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  HTMLAttributes as ReactHTMLAttributes,
} from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Drawer: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: ReactComponentProps<typeof DrawerPrimitive.Root>): ReactJSX.Element => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;
/* oxlint-disable typescript/prefer-readonly-parameter-types, react/no-multi-comp -- DrawerOverlay: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const DrawerOverlay = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Overlay>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <DrawerPrimitive.Overlay
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types, react/no-multi-comp */
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types, react/no-multi-comp -- DrawerContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

const DrawerContent = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Content>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref): ReactJSX.Element => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      className={cn(
        "bg-background fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border",
        className
      )}
      ref={ref}
      {...props}
    >
      <div className="bg-muted mx-auto mt-4 h-2 w-[100px] rounded-full" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types, react/no-multi-comp */
DrawerContent.displayName = "DrawerContent";
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DrawerHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DrawerHeader = ({
  className,
  ...props
}: ReactHTMLAttributes<HTMLDivElement>): ReactJSX.Element => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
DrawerHeader.displayName = "DrawerHeader";
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- DrawerFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DrawerFooter = ({
  className,
  ...props
}: ReactHTMLAttributes<HTMLDivElement>): ReactJSX.Element => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
DrawerFooter.displayName = "DrawerFooter";
/* oxlint-disable typescript/prefer-readonly-parameter-types, react/no-multi-comp -- DrawerTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const DrawerTitle = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Title>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <DrawerPrimitive.Title
    className={cn(
      "text-lg leading-none font-semibold tracking-tight",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types, react/no-multi-comp */
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types, react/no-multi-comp -- DrawerDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const DrawerDescription = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Description>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <DrawerPrimitive.Description
    className={cn("text-muted-foreground text-sm", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types, react/no-multi-comp */
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

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
