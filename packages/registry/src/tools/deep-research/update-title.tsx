import React from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (UpdateTitle); the enabled import/no-default-export convention rejects the default-export alternative. */

export const UpdateTitle = ({
  title,
  isRunning,
  className,
}: Readonly<{
  title: string;
  isRunning: boolean;
  className?: string;
}>): React.JSX.Element => {
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
