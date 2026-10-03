import React from "react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
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
      <Shimmer as="h3" className={cn("text-sm font-medium", className)}>
        {title}
      </Shimmer>
    );
  }

  return <h3 className={cn("text-sm font-medium", className)}>{title}</h3>;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
