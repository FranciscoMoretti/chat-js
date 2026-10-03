"use client";

/* oxlint-disable import/no-namespace -- @radix-ui/react-checkbox import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
/* oxlint-enable import/no-namespace */
import { Check } from "lucide-react";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Checkbox: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref): React.JSX.Element => (
  <CheckboxPrimitive.Root
    className={cn(
      "peer border-primary ring-offset-background focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
/* oxlint-enable react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
