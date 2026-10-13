"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
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

const Artifact = ({
  className,
  ...props
}: ArtifactProps): React.JSX.Element => (
  <div
    className={cn(
      "bg-background flex flex-col overflow-hidden rounded-lg border shadow-sm",
      className
    )}
    {...props}
  />
);

type ArtifactHeaderProps = HTMLAttributes<HTMLDivElement>;

const ArtifactHeader = ({
  className,
  ...props
}: ArtifactHeaderProps): React.JSX.Element => (
  <div
    className={cn(
      "bg-muted/50 flex items-center justify-between border-b px-4 py-3",
      className
    )}
    {...props}
  />
);

type ArtifactCloseProps = ComponentProps<typeof Button>;

const ArtifactClose = ({
  className,
  children,
  size = "sm",
  variant = "ghost",
  ...props
}: ArtifactCloseProps): React.JSX.Element => (
  <Button
    className={cn(
      "text-muted-foreground hover:text-foreground size-8 p-0",
      className
    )}
    size={size}
    type="button"
    variant={variant}
    {...props}
  >
    {children ?? <XIcon className="size-4" />}
    <span className="sr-only">Close</span>
  </Button>
);

type ArtifactTitleProps = HTMLAttributes<HTMLParagraphElement>;

const ArtifactTitle = ({
  className,
  ...props
}: ArtifactTitleProps): React.JSX.Element => (
  <p
    className={cn("text-foreground text-sm font-medium", className)}
    {...props}
  />
);

type ArtifactDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

const ArtifactDescription = ({
  className,
  ...props
}: ArtifactDescriptionProps): React.JSX.Element => (
  <p className={cn("text-muted-foreground text-sm", className)} {...props} />
);

type ArtifactActionsProps = HTMLAttributes<HTMLDivElement>;

const ArtifactActions = ({
  className,
  ...props
}: ArtifactActionsProps): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

type ArtifactActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
  icon?: LucideIcon;
};

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
  let accessibleLabel = tooltip;
  if (typeof label === "string" && label !== "") {
    accessibleLabel = label;
  }

  const button = (
    <Button
      className={cn(
        "text-muted-foreground hover:text-foreground size-8 p-0",
        className
      )}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {Icon ? <Icon className="size-4" /> : children}
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

type ArtifactContentProps = HTMLAttributes<HTMLDivElement>;

const ArtifactContent = ({
  className,
  ...props
}: ArtifactContentProps): React.JSX.Element => (
  <div className={cn("flex-1 overflow-auto p-4", className)} {...props} />
);
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
