"use client";

import type {
  ComponentProps as ReactComponentProps,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
} from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: ReactComponentProps<typeof DrawerPrimitive.Root>): ReactJSX.Element => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);

Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Overlay>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <DrawerPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-black/80", className)}
      ref={ref}
      {...props}
    />
  )
);

DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Content>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(
  (
    { className, children, ...props },

    ref
  ): ReactJSX.Element => (
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
  )
);

DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
  className,
  ...props
}: ReactHTMLAttributes<HTMLDivElement>): ReactJSX.Element => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: ReactHTMLAttributes<HTMLDivElement>): ReactJSX.Element => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Title>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <DrawerPrimitive.Title
      className={cn(
        "text-lg leading-none font-semibold tracking-tight",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = reactForwardRef<
  ReactComponentRef<typeof DrawerPrimitive.Description>,
  ReactComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <DrawerPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      ref={ref}
      {...props}
    />
  )
);

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
