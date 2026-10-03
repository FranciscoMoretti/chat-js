"use client";
/* oxlint-disable import/no-namespace -- @radix-ui/react-label import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as LabelPrimitive from "@radix-ui/react-label";
/* oxlint-enable import/no-namespace */
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Label: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const Label = ({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>): React.JSX.Element => (
  <LabelPrimitive.Root
    className={cn(
      "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className
    )}
    data-slot="label"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-named-export, import/prefer-default-export -- label.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration. */

export { Label };
/* oxlint-enable import/no-named-export, import/prefer-default-export */
