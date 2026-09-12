import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const MainChatPanel = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn("flex h-full min-h-0 min-w-0 flex-1 flex-col", className)}
    {...props}
  />
);
