import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

/* oxlint-disable react/react-in-jsx-scope -- Textarea uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Textarea = reactForwardRef<
  HTMLTextAreaElement,
  ReactComponentProps<"textarea">
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    /* oxlint-disable-next-line oxc/no-rest-spread-properties -- forwardRef supplies the native textarea ref: projecting ref.current fails the textarea JSX receiver. Props preserve React/CSS scalar string & {} aliases, which remain flagged even with recursively readonly data and unchanged callable/constructor signatures. Rest/spread: Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. */
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): ReactJSX.Element => (
    <textarea
      className={cn(
        "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Textarea's native textarea attributes, preserving caller events and accessibility props.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */
Textarea.displayName = "Textarea";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Textarea); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Textarea };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
