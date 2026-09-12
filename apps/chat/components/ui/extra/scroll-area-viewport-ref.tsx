"use client";

/**
 * This is a tweak around the ScrollArea component that allows you to pass a ref to the viewport.
 * Undo after this PR is merged: https://github.com/shadcn-ui/ui/pull/8925/files
 */

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type * as React from "react";

import { cn } from "@/lib/utils";

import { ScrollBar } from "../scroll-area";

export const ScrollArea = ({
  className,
  children,
  viewportRef,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  viewportRef?: React.Ref<
    React.ComponentRef<typeof ScrollAreaPrimitive.Viewport>
  >;
}) => (
  <ScrollAreaPrimitive.Root
    className={cn("relative", className)}
    data-slot="scroll-area"
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
      data-slot="scroll-area-viewport"
      ref={viewportRef}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
);
