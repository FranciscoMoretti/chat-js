import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the standard React input props, including native object refs. Deep readonly ref.current fails the input JSX receiver; preserving scalar string & {} aliases in type/autoComplete/role/style still triggers this rule.
const Input = ({
  className,
  type,
  ...props
}: ReactComponentProps<"input">): ReactJSX.Element => (
  <input
    className={cn(
      "border-input selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
      className
    )}
    data-slot="input"
    type={type}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Input's native input attributes, preserving caller events and accessibility props.
    {...props}
  />
);

export { Input };
