"use client";

import {
  Root as AvatarPrimitiveRoot,
  Image as AvatarPrimitiveImage,
  Fallback as AvatarPrimitiveFallback,
} from "@radix-ui/react-avatar";
import { forwardRef as reactForwardRef } from "react";
import type {
  ComponentRef as ReactComponentRef,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Avatar: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- Avatar uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Avatar = reactForwardRef<
  ReactComponentRef<typeof AvatarPrimitiveRoot>,
  ReactComponentPropsWithoutRef<typeof AvatarPrimitiveRoot>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <AvatarPrimitiveRoot
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Avatar's AvatarPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Avatar.displayName = AvatarPrimitiveRoot.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AvatarImage: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- AvatarImage uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AvatarImage = reactForwardRef<
  ReactComponentRef<typeof AvatarPrimitiveImage>,
  ReactComponentPropsWithoutRef<typeof AvatarPrimitiveImage>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <AvatarPrimitiveImage
    className={cn("aspect-square h-full w-full", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AvatarImage's AvatarPrimitiveImage prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
AvatarImage.displayName = AvatarPrimitiveImage.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AvatarFallback: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- AvatarFallback uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AvatarFallback = reactForwardRef<
  ReactComponentRef<typeof AvatarPrimitiveFallback>,
  ReactComponentPropsWithoutRef<typeof AvatarPrimitiveFallback>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <AvatarPrimitiveFallback
    className={cn(
      "bg-muted flex h-full w-full items-center justify-center rounded-full",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AvatarFallback's AvatarPrimitiveFallback prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
AvatarFallback.displayName = AvatarPrimitiveFallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };
