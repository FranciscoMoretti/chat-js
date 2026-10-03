"use client";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";

type ActionContainerProps = React.ComponentProps<"div">;
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- ActionContainer: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ActionContainerProps). */

const ActionContainer = ({
  className,
  ...props
}: ActionContainerProps): React.JSX.Element => (
  <div
    className={cn(
      "group border-border/60 bg-muted/20 hover:border-primary/25 relative rounded-xl border px-4 py-3 transition-all duration-200",
      className
    )}
    {...props}
  />
);
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */

type ActionContainerLinkProps = React.ComponentProps<typeof InternalLink>;
/* oxlint-disable no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ActionContainerLink: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ActionContainerLink = ({
  className,
  tabIndex,
  ...props
}: ActionContainerLinkProps): React.JSX.Element => (
  <InternalLink
    className={cn("absolute inset-0 z-10", className)}
    tabIndex={tabIndex ?? -1}
    {...props}
  />
);
/* oxlint-enable no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ActionContainerTopProps = React.ComponentProps<"div">;
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ActionContainerTop: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ActionContainerTopProps). */

const ActionContainerTop = ({
  className,
  ...props
}: ActionContainerTopProps): React.JSX.Element => (
  <div className={cn("z-20", className)} {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export { ActionContainer, ActionContainerLink, ActionContainerTop };
