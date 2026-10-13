"use client";

import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";

type ActionContainerProps = ReactComponentProps<"div">;

const ActionContainer = ({
  className,
  ...props
}: ActionContainerProps): ReactJSX.Element => (
  <div
    className={cn(
      "group border-border/60 bg-muted/20 hover:border-primary/25 relative rounded-xl border px-4 py-3 transition-all duration-200",
      className
    )}
    {...props}
  />
);

type ActionContainerLinkProps = ReactComponentProps<typeof InternalLink>;
const DISABLED_LINK_TAB_INDEX = -1;

const ActionContainerLink = ({
  className,
  tabIndex,
  ...props
}: ActionContainerLinkProps): ReactJSX.Element => (
  <InternalLink
    className={cn("absolute inset-0 z-10", className)}
    tabIndex={tabIndex ?? DISABLED_LINK_TAB_INDEX}
    {...props}
  />
);

type ActionContainerTopProps = ReactComponentProps<"div">;

const ActionContainerTop = ({
  className,
  ...props
}: ActionContainerTopProps): ReactJSX.Element => (
  <div className={cn("z-20", className)} {...props} />
);

export { ActionContainer, ActionContainerLink, ActionContainerTop };
