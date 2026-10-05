"use client";

import {
  Indicator as ProgressPrimitiveIndicator,
  Root as ProgressPrimitiveRoot,
} from "@radix-ui/react-progress";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- Progress: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 100); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including value). */

/* oxlint-disable react/react-in-jsx-scope -- Progress uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
/* oxlint-disable react/forbid-component-props -- ProgressPrimitiveRoot, ProgressPrimitiveIndicator accept the supplied styling props; preserve this composition's layout and appearance. */
const Progress = ({
  className,
  value,
  ...props
}: ReactComponentProps<typeof ProgressPrimitiveRoot>): ReactJSX.Element => (
  <ProgressPrimitiveRoot
    className={cn(
      "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
      className
    )}
    data-slot="progress"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Progress's ProgressPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <ProgressPrimitiveIndicator
      className="bg-primary h-full w-full flex-1 transition-all"
      data-slot="progress-indicator"

      // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitiveRoot>
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Progress); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

export { Progress };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
