"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
// oxlint-disable-next-line sort-imports -- Preserve Button-before-Tooltip order: pinned SWC/Node 24 cold loads keep crypto.randomUUID before ReactDOM hooks (dev) and checkDCE (prod); sorting reverses them.
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";
import React from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ArtifactProps = HTMLAttributes<HTMLDivElement>;

const Artifact = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ArtifactProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(
      "bg-background flex flex-col overflow-hidden rounded-lg border shadow-sm",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Artifact's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);

type ArtifactHeaderProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp -- ArtifactHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ArtifactHeader = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ArtifactHeaderProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(
      "bg-muted/50 flex items-center justify-between border-b px-4 py-3",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactHeader's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type ArtifactCloseProps = ComponentProps<typeof Button>;
/* oxlint-disable react/jsx-no-literals -- ArtifactClose renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable react/no-multi-comp -- ArtifactClose: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ArtifactClose = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    size = "sm",
    variant = "ghost",
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children, size, variant from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ArtifactCloseProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <Button
    // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "text-muted-foreground hover:text-foreground size-8 p-0",
      className
    )}
    size={size}
    type="button"
    variant={variant}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactClose's Button prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    {children ?? (
      <XIcon
        // oxlint-disable-next-line react/forbid-component-props -- XIcon accepts className in its styling contract; preserve this caller's layout and appearance.
        className="size-4"
      />
    )}
    <span className="sr-only">Close</span>
  </Button>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/no-multi-comp */

type ArtifactTitleProps = HTMLAttributes<HTMLParagraphElement>;

/* oxlint-disable react/no-multi-comp -- ArtifactTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ArtifactTitle = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ArtifactTitleProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <p
    className={cn("text-foreground text-sm font-medium", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactTitle's native p attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type ArtifactDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

/* oxlint-disable react/no-multi-comp -- ArtifactDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ArtifactDescription = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ArtifactDescriptionProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <p
    className={cn("text-muted-foreground text-sm", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactDescription's native p attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type ArtifactActionsProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp -- ArtifactActions: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ArtifactActions = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ArtifactActionsProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn("flex items-center gap-1", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactActions's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type ArtifactActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
  icon?: LucideIcon;
};

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp -- ArtifactAction: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including label). */

// oxlint-disable-next-line max-lines-per-function -- Keep the optional tooltip around the same button so icon, child, label and forwarded native props retain their existing identity.
const ArtifactAction = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    tooltip,
    label,
    icon: Icon,
    children,
    className,
    size = "sm",
    variant = "ghost",
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes tooltip, label, icon, children, className, size, variant from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ArtifactActionProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  let accessibleLabel = tooltip;
  if (typeof label === "string" && label !== "") {
    accessibleLabel = label;
  }

  const button = (
    <Button
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "text-muted-foreground hover:text-foreground size-8 p-0",
        className
      )}
      size={size}
      type="button"
      variant={variant}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactAction's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        Icon ? (
          <Icon
            // oxlint-disable-next-line react/forbid-component-props -- Icon accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-4"
          />
        ) : (
          children
        )
      }
      <span className="sr-only">{accessibleLabel}</span>
    </Button>
  );

  if (typeof tooltip === "string" && tooltip !== "") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp */

type ArtifactContentProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp -- ArtifactContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ArtifactContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ArtifactContentProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn("flex-1 overflow-auto p-4", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactContent's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Artifact, ArtifactAction, ArtifactActions, ArtifactClose, ArtifactContent, ArtifactDescription, ArtifactHeader, ArtifactTitle); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp */
export {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ArtifactActionProps, ArtifactActionsProps, ArtifactCloseProps, ArtifactContentProps, ArtifactDescriptionProps, ArtifactHeaderProps, ArtifactProps, ArtifactTitleProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type {
  ArtifactActionProps,
  ArtifactActionsProps,
  ArtifactCloseProps,
  ArtifactContentProps,
  ArtifactDescriptionProps,
  ArtifactHeaderProps,
  ArtifactProps,
  ArtifactTitleProps,
};
/* oxlint-enable import/no-named-export */
