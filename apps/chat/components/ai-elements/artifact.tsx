"use client";

import { XIcon } from "lucide-react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { LucideIcon } from "lucide-react";
/* oxlint-enable sort-imports */
import React from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentProps, HTMLAttributes } from "react";
/* oxlint-enable sort-imports */

import { Button } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

type ArtifactProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Artifact: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ArtifactProps). */

const Artifact = ({
  className,
  ...props
}: ArtifactProps): React.JSX.Element => (
  <div
    className={cn(
      "bg-background flex flex-col overflow-hidden rounded-lg border shadow-sm",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Artifact's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type ArtifactHeaderProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ArtifactHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ArtifactHeaderProps). */

const ArtifactHeader = ({
  className,
  ...props
}: ArtifactHeaderProps): React.JSX.Element => (
  <div
    className={cn(
      "bg-muted/50 flex items-center justify-between border-b px-4 py-3",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactHeader's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ArtifactCloseProps = ComponentProps<typeof Button>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ArtifactClose: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ArtifactClose = ({
  className,
  children,
  size = "sm",
  variant = "ghost",
  ...props
}: ArtifactCloseProps): React.JSX.Element => (
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ArtifactTitleProps = HTMLAttributes<HTMLParagraphElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ArtifactTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ArtifactTitleProps). */

const ArtifactTitle = ({
  className,
  ...props
}: ArtifactTitleProps): React.JSX.Element => (
  <p
    className={cn("text-foreground text-sm font-medium", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactTitle's native p attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ArtifactDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ArtifactDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ArtifactDescriptionProps). */

const ArtifactDescription = ({
  className,
  ...props
}: ArtifactDescriptionProps): React.JSX.Element => (
  <p
    className={cn("text-muted-foreground text-sm", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactDescription's native p attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ArtifactActionsProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ArtifactActions: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ArtifactActionsProps). */

const ArtifactActions = ({
  className,
  ...props
}: ArtifactActionsProps): React.JSX.Element => (
  <div
    className={cn("flex items-center gap-1", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactActions's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ArtifactActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
  icon?: LucideIcon;
};

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- ArtifactAction: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including label). */

const ArtifactAction = ({
  tooltip,
  label,
  icon: Icon,
  children,
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: ArtifactActionProps): React.JSX.Element => {
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
      {Icon ? (
        <Icon
          // oxlint-disable-next-line react/forbid-component-props -- Icon accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-4"
        />
      ) : (
        children
      )}
      {/* oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value. */}
      <span className="sr-only">{label || tooltip}</span>
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
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

type ArtifactContentProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ArtifactContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ArtifactContentProps). */

const ArtifactContent = ({
  className,
  ...props
}: ArtifactContentProps): React.JSX.Element => (
  <div
    className={cn("flex-1 overflow-auto p-4", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ArtifactContent's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
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
