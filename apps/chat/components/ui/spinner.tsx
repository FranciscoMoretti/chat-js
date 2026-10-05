import { Loader2Icon } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Spinner: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const Spinner = ({
  className,
  "aria-label": label = "Loading",
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, "aria-label" from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: React.ComponentProps<"svg">): React.JSX.Element => (
  <output aria-label={label} className="inline-flex">
    <Loader2Icon
      aria-hidden="true"
      // oxlint-disable-next-line react/forbid-component-props -- Loader2Icon accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("size-4 animate-spin", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Spinner's Loader2Icon prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  </output>
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Spinner); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { Spinner };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
