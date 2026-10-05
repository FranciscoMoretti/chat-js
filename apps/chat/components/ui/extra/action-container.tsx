"use client";

import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";

type ActionContainerProps = ReactComponentProps<"div">;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ActionContainer: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ActionContainerProps). */

/* oxlint-disable react/react-in-jsx-scope -- ActionContainer uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const ActionContainer = ({
  className,
  ...props
}: ActionContainerProps): ReactJSX.Element => (
  <div
    className={cn(
      "group border-border/60 bg-muted/20 hover:border-primary/25 relative rounded-xl border px-4 py-3 transition-all duration-200",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ActionContainer's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type ActionContainerLinkProps = ReactComponentProps<typeof InternalLink>;
/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ActionContainerLink: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- ActionContainerLink uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const ActionContainerLink = ({
  className,
  tabIndex,
  ...props
}: ActionContainerLinkProps): ReactJSX.Element => (
  <InternalLink
    className={cn("absolute inset-0 z-10", className)}
    tabIndex={tabIndex ?? -1}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ActionContainerLink's InternalLink prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ActionContainerTopProps = ReactComponentProps<"div">;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ActionContainerTop: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ActionContainerTopProps). */

/* oxlint-disable react/react-in-jsx-scope -- ActionContainerTop uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const ActionContainerTop = ({
  className,
  ...props
}: ActionContainerTopProps): ReactJSX.Element => (
  <div
    className={cn("z-20", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ActionContainerTop's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export { ActionContainer, ActionContainerLink, ActionContainerTop };
