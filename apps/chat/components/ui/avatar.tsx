"use client";

import {
  Fallback as AvatarPrimitiveFallback,
  Image as AvatarPrimitiveImage,
  Root as AvatarPrimitiveRoot,
} from "@radix-ui/react-avatar";
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

const Avatar = reactForwardRef<
  ReactComponentRef<typeof AvatarPrimitiveRoot>,
  ReactComponentPropsWithoutRef<typeof AvatarPrimitiveRoot>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <AvatarPrimitiveRoot
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Avatar.displayName = AvatarPrimitiveRoot.displayName;

const AvatarImage = reactForwardRef<
  ReactComponentRef<typeof AvatarPrimitiveImage>,
  ReactComponentPropsWithoutRef<typeof AvatarPrimitiveImage>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <AvatarPrimitiveImage
      className={cn("aspect-square h-full w-full", className)}
      ref={ref}
      {...props}
    />
  )
);

AvatarImage.displayName = AvatarPrimitiveImage.displayName;

const AvatarFallback = reactForwardRef<
  ReactComponentRef<typeof AvatarPrimitiveFallback>,
  ReactComponentPropsWithoutRef<typeof AvatarPrimitiveFallback>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <AvatarPrimitiveFallback
      className={cn(
        "bg-muted flex h-full w-full items-center justify-center rounded-full",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

AvatarFallback.displayName = AvatarPrimitiveFallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };
