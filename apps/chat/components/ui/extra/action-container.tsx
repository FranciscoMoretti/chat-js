"use client";

import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";

type ActionContainerProps = ReactComponentProps<"div">;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ActionContainer: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ActionContainerProps). */

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type ActionContainerLinkProps = ReactComponentProps<typeof InternalLink>;
/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ActionContainerLink: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ActionContainerLink = ({
  className,
  tabIndex,
  ...props
}: ActionContainerLinkProps): ReactJSX.Element => (
  <InternalLink
    className={cn("absolute inset-0 z-10", className)}
    tabIndex={tabIndex ?? -1}
    {...props}
  />
);
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ActionContainerTopProps = ReactComponentProps<"div">;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ActionContainerTop: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ActionContainerTopProps). */

const ActionContainerTop = ({
  className,
  ...props
}: ActionContainerTopProps): ReactJSX.Element => (
  <div className={cn("z-20", className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export { ActionContainer, ActionContainerLink, ActionContainerTop };
