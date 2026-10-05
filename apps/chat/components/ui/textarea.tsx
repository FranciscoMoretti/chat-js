import { forwardRef as reactForwardRef } from "react";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";

const Textarea = reactForwardRef<
  HTMLTextAreaElement,
  ReactComponentProps<"textarea">
>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- forwardRef supplies the native textarea ref: projecting ref.current fails the textarea JSX receiver. Props preserve React/CSS scalar string & {} aliases, which remain flagged even with recursively readonly data and unchanged callable/constructor signatures.
  ({ className, ...props }, ref): ReactJSX.Element => (
    <textarea
      className={cn(
        "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
