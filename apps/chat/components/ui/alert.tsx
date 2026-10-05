import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "[&>svg]:text-foreground relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg+div]:translate-y-[-3px] [&>svg~*]:pl-7",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
  }
);
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Alert: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, variant, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- Alert uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Alert = reactForwardRef<
  HTMLDivElement,
  ReactHTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref): ReactJSX.Element => (
  <div
    className={cn(alertVariants({ variant }), className)}
    ref={ref}
    role="alert"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Alert's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Alert.displayName = "Alert";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AlertTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- AlertTitle uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertTitle = reactForwardRef<
  HTMLParagraphElement,
  ReactHTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <>
    {/* oxlint-disable-next-line jsx-a11y/heading-has-content -- Shared primitive forwards heading children through props. */}
    <h5
      className={cn("mb-1 leading-none font-medium tracking-tight", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertTitle's native h5 attributes, preserving caller events and accessibility props.
      {...props}
    />
  </>
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
AlertTitle.displayName = "AlertTitle";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- AlertDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- AlertDescription uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const AlertDescription = reactForwardRef<
  HTMLParagraphElement,
  ReactHTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <div
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward AlertDescription's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription, AlertTitle };
