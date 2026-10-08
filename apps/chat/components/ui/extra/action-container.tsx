"use client";

import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";

type ActionContainerProps = ReactComponentProps<"div">;

/* oxlint-disable react/react-in-jsx-scope -- ActionContainer uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const ActionContainer = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ActionContainerProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
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

type ActionContainerLinkProps = ReactComponentProps<typeof InternalLink>;
/* oxlint-disable no-magic-numbers, react/no-multi-comp -- ActionContainerLink: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- ActionContainerLink uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const ActionContainerLink = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    tabIndex,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, tabIndex from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ActionContainerLinkProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <InternalLink
    // oxlint-disable-next-line react/forbid-component-props -- InternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("absolute inset-0 z-10", className)}
    tabIndex={tabIndex ?? -1}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ActionContainerLink's InternalLink prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable no-magic-numbers, react/no-multi-comp */

type ActionContainerTopProps = ReactComponentProps<"div">;
/* oxlint-disable react/no-multi-comp -- ActionContainerTop: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- ActionContainerTop uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const ActionContainerTop = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ActionContainerTopProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <div
    className={cn("z-20", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ActionContainerTop's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ActionContainer, ActionContainerLink, ActionContainerTop); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

export { ActionContainer, ActionContainerLink, ActionContainerTop };
/* oxlint-enable import/no-named-export */
