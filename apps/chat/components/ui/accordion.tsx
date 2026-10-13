"use client";

import {
  Content as AccordionPrimitiveContent,
  Header as AccordionPrimitiveHeader,
  Item as AccordionPrimitiveItem,
  Root as AccordionPrimitiveRoot,
  Trigger as AccordionPrimitiveTrigger,
} from "@radix-ui/react-accordion";
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

const Accordion = AccordionPrimitiveRoot;

const AccordionItem = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveItem>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveItem>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <AccordionPrimitiveItem
      className={cn("border-b", className)}
      ref={ref}
      {...props}
    />
  )
);

AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveTrigger>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveTrigger>
>(
  (
    { className, children, ...props },

    ref
  ): ReactJSX.Element => (
    <AccordionPrimitiveHeader className="flex">
      <AccordionPrimitiveTrigger
        className={cn(
          "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
      </AccordionPrimitiveTrigger>
    </AccordionPrimitiveHeader>
  )
);

AccordionTrigger.displayName = AccordionPrimitiveTrigger.displayName;

const AccordionContent = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveContent>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveContent>
>(
  (
    { className, children, ...props },

    ref
  ): ReactJSX.Element => (
    <AccordionPrimitiveContent
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm transition-all"
      ref={ref}
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitiveContent>
  )
);

AccordionContent.displayName = AccordionPrimitiveContent.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
