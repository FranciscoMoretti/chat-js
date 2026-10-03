import { Loader2Icon } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Spinner: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { Spinner };
