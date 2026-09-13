"use client";

import type * as React from "react";

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";

type ActionContainerProps = React.ComponentProps<"div">;

function ActionContainer({ className, ...props }: ActionContainerProps) {
  return (
    <div
      className={cn(
        "group border-border/60 bg-muted/20 hover:border-primary/25 relative rounded-xl border px-4 py-3 transition-all duration-200",
        className
      )}
      {...props}
    />
  );
}

type ActionContainerLinkProps = React.ComponentProps<typeof InternalLink>;

function ActionContainerLink({
  className,
  tabIndex,
  ...props
}: ActionContainerLinkProps) {
  return (
    <InternalLink
      className={cn("absolute inset-0 z-10", className)}
      tabIndex={tabIndex ?? -1}
      {...props}
    />
  );
}

type ActionContainerTopProps = React.ComponentProps<"div">;

function ActionContainerTop({ className, ...props }: ActionContainerTopProps) {
  return <div className={cn("z-20", className)} {...props} />;
}

export { ActionContainer, ActionContainerLink, ActionContainerTop };
