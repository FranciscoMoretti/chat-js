"use client";

import {
  Indicator as ProgressPrimitiveIndicator,
  Root as ProgressPrimitiveRoot,
} from "@radix-ui/react-progress";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import React from "react";

import { cn } from "@/lib/utils";

const FULL_PROGRESS = 100;
const EMPTY_PROGRESS = 0;

const Progress = ({
  className,
  value,
  ...props
}: ReactComponentProps<typeof ProgressPrimitiveRoot>): ReactJSX.Element => {
  const indicatorStyle = React.useMemo((): { readonly transform: string } => {
    let progressValue = value ?? EMPTY_PROGRESS;
    if (Number.isNaN(progressValue)) {
      progressValue = EMPTY_PROGRESS;
    }
    return { transform: `translateX(-${FULL_PROGRESS - progressValue}%)` };
  }, [value]);
  return (
    <ProgressPrimitiveRoot
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      data-slot="progress"
      {...props}
    >
      <ProgressPrimitiveIndicator
        className="bg-primary h-full w-full flex-1 transition-all"
        data-slot="progress-indicator"

        style={indicatorStyle}
      />
    </ProgressPrimitiveRoot>
  );
};

export { Progress };
