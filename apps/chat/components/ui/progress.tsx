"use client";
/* oxlint-disable import/no-namespace -- @radix-ui/react-progress import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as ProgressPrimitive from "@radix-ui/react-progress";
/* oxlint-enable import/no-namespace */
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- Progress: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 100); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including value). */

const Progress = ({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>): React.JSX.Element => (
  <ProgressPrimitive.Root
    className={cn(
      "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
      className
    )}
    data-slot="progress"
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="bg-primary h-full w-full flex-1 transition-all"
      data-slot="progress-indicator"

      // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
);
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

export { Progress };
