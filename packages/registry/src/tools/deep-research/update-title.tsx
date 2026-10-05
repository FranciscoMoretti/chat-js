import React from "react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (UpdateTitle); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const UpdateTitle = ({
  title,
  isRunning,
  className,
}: {
  title: string;
  isRunning: boolean;
  className?: string;
}) => {
  if (isRunning) {
    return (
      <Shimmer
        as="h3"
        // oxlint-disable-next-line react/forbid-component-props -- Shimmer accepts className in its styling contract; preserve this caller's layout and appearance.
        className={cn("text-sm font-medium", className)}
      >
        {title}
      </Shimmer>
    );
  }

  return <h3 className={cn("text-sm font-medium", className)}>{title}</h3>;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
