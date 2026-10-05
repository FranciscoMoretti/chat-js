"use client";

import {
  Root as AccordionPrimitiveRoot,
  Item as AccordionPrimitiveItem,
  Trigger as AccordionPrimitiveTrigger,
  Header as AccordionPrimitiveHeader,
  Content as AccordionPrimitiveContent,
} from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { forwardRef as reactForwardRef } from "react";
import type {
  ComponentRef as ReactComponentRef,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitiveRoot;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AccordionItem: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const AccordionItem = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveItem>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveItem>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <AccordionPrimitiveItem
    className={cn("border-b", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AccordionItem's AccordionPrimitiveItem prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
AccordionItem.displayName = "AccordionItem";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AccordionTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

const AccordionTrigger = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveTrigger>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveTrigger>
>(({ className, children, ...props }, ref): ReactJSX.Element => (
  <AccordionPrimitiveHeader className="flex">
    <AccordionPrimitiveTrigger
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AccordionTrigger's AccordionPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitiveTrigger>
  </AccordionPrimitiveHeader>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
AccordionTrigger.displayName = AccordionPrimitiveTrigger.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AccordionContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

const AccordionContent = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveContent>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveContent>
>(({ className, children, ...props }, ref): ReactJSX.Element => (
  <AccordionPrimitiveContent
    className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm transition-all"
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AccordionContent's AccordionPrimitiveContent prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <div className={cn("pt-0 pb-4", className)}>{children}</div>
  </AccordionPrimitiveContent>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */

AccordionContent.displayName = AccordionPrimitiveContent.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
