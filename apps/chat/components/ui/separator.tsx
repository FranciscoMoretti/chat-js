"use client";

/* oxlint-disable import/no-namespace -- @radix-ui/react-separator import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as SeparatorPrimitive from "@radix-ui/react-separator";
/* oxlint-enable import/no-namespace */
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Separator: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const Separator = ({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>): React.JSX.Element => (
  <SeparatorPrimitive.Root
    className={cn(
      "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
      className
    )}
    data-slot="separator"
    decorative={decorative}
    orientation={orientation}
    {...props}
  />
);
/* oxlint-enable react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */

export { Separator };
