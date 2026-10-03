/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Textarea: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref): React.JSX.Element => (
  <textarea
    className={cn(
      "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
Textarea.displayName = "Textarea";
/* oxlint-disable import/no-named-export, import/prefer-default-export -- textarea.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration. */

export { Textarea };
/* oxlint-enable import/no-named-export, import/prefer-default-export */
