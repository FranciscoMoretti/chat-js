import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

const Spinner = ({
  className,
  "aria-label": label = "Loading",
  ...props
}: React.ComponentProps<"svg">) => (
  <output aria-label={label} className="inline-flex">
    <Loader2Icon
      aria-hidden="true"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  </output>
);

export { Spinner };
