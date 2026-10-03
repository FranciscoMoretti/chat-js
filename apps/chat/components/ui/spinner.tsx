import { Loader2Icon } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

/* oxlint-disable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Spinner: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const Spinner = ({
  className,
  "aria-label": label = "Loading",
  ...props
}: React.ComponentProps<"svg">): React.JSX.Element => (
  <output aria-label={label} className="inline-flex">
    <Loader2Icon
      aria-hidden="true"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  </output>
);
/* oxlint-enable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-named-export, import/prefer-default-export -- spinner.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration. */

export { Spinner };
/* oxlint-enable import/no-named-export, import/prefer-default-export */
