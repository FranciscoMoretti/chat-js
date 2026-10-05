"use client";

import { Root as LabelPrimitiveRoot } from "@radix-ui/react-label";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Label: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- Label uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Label = ({
  className,
  ...props
}: ReactComponentProps<typeof LabelPrimitiveRoot>): ReactJSX.Element => (
  <LabelPrimitiveRoot
    // oxlint-disable-next-line react/forbid-component-props -- LabelPrimitiveRoot accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className
    )}
    data-slot="label"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Label's LabelPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Label); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { Label };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
