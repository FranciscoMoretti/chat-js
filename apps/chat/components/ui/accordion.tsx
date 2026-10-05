"use client";

import {
  Content as AccordionPrimitiveContent,
  Header as AccordionPrimitiveHeader,
  Item as AccordionPrimitiveItem,
  Root as AccordionPrimitiveRoot,
  Trigger as AccordionPrimitiveTrigger,
} from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitiveRoot;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AccordionItem: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- AccordionItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AccordionItem = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveItem>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveItem>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <AccordionPrimitiveItem
    // oxlint-disable-next-line react/forbid-component-props -- AccordionPrimitiveItem accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("border-b", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AccordionItem's AccordionPrimitiveItem prop contract, preserving caller options, children and callbacks.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
AccordionItem.displayName = "AccordionItem";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AccordionTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- AccordionTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AccordionTrigger = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveTrigger>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveTrigger>
>(({ className, children, ...props }, ref): ReactJSX.Element => (
  <AccordionPrimitiveHeader
    // oxlint-disable-next-line react/forbid-component-props -- AccordionPrimitiveHeader accepts className in its styling contract; preserve this caller's layout and appearance.
    className="flex"
  >
    <AccordionPrimitiveTrigger
      // oxlint-disable-next-line react/forbid-component-props -- AccordionPrimitiveTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AccordionTrigger's AccordionPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children}
      <ChevronDown
        // oxlint-disable-next-line react/forbid-component-props -- ChevronDown accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-4 w-4 shrink-0 transition-transform duration-200"
      />
    </AccordionPrimitiveTrigger>
  </AccordionPrimitiveHeader>
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
AccordionTrigger.displayName = AccordionPrimitiveTrigger.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AccordionContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- AccordionContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AccordionContent = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveContent>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveContent>
>(({ className, children, ...props }, ref): ReactJSX.Element => (
  <AccordionPrimitiveContent
    // oxlint-disable-next-line react/forbid-component-props -- AccordionPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
    className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm transition-all"
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AccordionContent's AccordionPrimitiveContent prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <div className={cn("pt-0 pb-4", className)}>{children}</div>
  </AccordionPrimitiveContent>
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

AccordionContent.displayName = AccordionPrimitiveContent.displayName;

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
