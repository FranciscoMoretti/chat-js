import { forwardRef as reactForwardRef } from "react";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Textarea: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const Textarea = reactForwardRef<
  HTMLTextAreaElement,
  ReactComponentProps<"textarea">
>(({ className, ...props }, ref): ReactJSX.Element => (
  <textarea
    className={cn(
      "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Textarea.displayName = "Textarea";

export { Textarea };
