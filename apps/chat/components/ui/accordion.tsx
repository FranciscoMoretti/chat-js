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

/* oxlint-disable react/react-in-jsx-scope -- AccordionItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AccordionItem = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveItem>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveItem>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <AccordionPrimitiveItem
      // oxlint-disable-next-line react/forbid-component-props -- AccordionPrimitiveItem accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("border-b", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AccordionItem's AccordionPrimitiveItem prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

AccordionItem.displayName = "AccordionItem";

/* oxlint-disable react/react-in-jsx-scope -- AccordionTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AccordionTrigger = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveTrigger>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveTrigger>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, children, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
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
  )
);
/* oxlint-enable react/react-in-jsx-scope */

AccordionTrigger.displayName = AccordionPrimitiveTrigger.displayName;

/* oxlint-disable react/react-in-jsx-scope -- AccordionContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AccordionContent = reactForwardRef<
  ReactComponentRef<typeof AccordionPrimitiveContent>,
  ReactComponentPropsWithoutRef<typeof AccordionPrimitiveContent>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, children, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <AccordionPrimitiveContent
      // oxlint-disable-next-line react/forbid-component-props -- AccordionPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm transition-all"
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AccordionContent's AccordionPrimitiveContent prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitiveContent>
  )
);
/* oxlint-enable react/react-in-jsx-scope */

AccordionContent.displayName = AccordionPrimitiveContent.displayName;

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Accordion, AccordionContent, AccordionItem, AccordionTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
/* oxlint-enable import/no-named-export */
