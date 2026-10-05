"use client";

import {
  Fallback as AvatarPrimitiveFallback,
  Image as AvatarPrimitiveImage,
  Root as AvatarPrimitiveRoot,
} from "@radix-ui/react-avatar";
import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

/* oxlint-disable react/react-in-jsx-scope -- Avatar uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Avatar = reactForwardRef<
  ReactComponentRef<typeof AvatarPrimitiveRoot>,
  ReactComponentPropsWithoutRef<typeof AvatarPrimitiveRoot>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases.
    { className, ...props },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve forwardRef's native writable current object and callback ref contract.
    ref
  ): ReactJSX.Element => (
    <AvatarPrimitiveRoot
      // oxlint-disable-next-line react/forbid-component-props -- AvatarPrimitiveRoot accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Avatar's AvatarPrimitiveRoot prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

Avatar.displayName = AvatarPrimitiveRoot.displayName;

/* oxlint-disable react/react-in-jsx-scope -- AvatarImage uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AvatarImage = reactForwardRef<
  ReactComponentRef<typeof AvatarPrimitiveImage>,
  ReactComponentPropsWithoutRef<typeof AvatarPrimitiveImage>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases.
    { className, ...props },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve forwardRef's native writable current object and callback ref contract.
    ref
  ): ReactJSX.Element => (
    <AvatarPrimitiveImage
      // oxlint-disable-next-line react/forbid-component-props -- AvatarPrimitiveImage accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("aspect-square h-full w-full", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AvatarImage's AvatarPrimitiveImage prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

AvatarImage.displayName = AvatarPrimitiveImage.displayName;

/* oxlint-disable react/react-in-jsx-scope -- AvatarFallback uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AvatarFallback = reactForwardRef<
  ReactComponentRef<typeof AvatarPrimitiveFallback>,
  ReactComponentPropsWithoutRef<typeof AvatarPrimitiveFallback>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases.
    { className, ...props },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve forwardRef's native writable current object and callback ref contract.
    ref
  ): ReactJSX.Element => (
    <AvatarPrimitiveFallback
      // oxlint-disable-next-line react/forbid-component-props -- AvatarPrimitiveFallback accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "bg-muted flex h-full w-full items-center justify-center rounded-full",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AvatarFallback's AvatarPrimitiveFallback prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

AvatarFallback.displayName = AvatarPrimitiveFallback.displayName;

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Avatar, AvatarFallback, AvatarImage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Avatar, AvatarFallback, AvatarImage };
/* oxlint-enable import/no-named-export */
