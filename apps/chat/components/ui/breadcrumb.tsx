import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { forwardRef as reactForwardRef } from "react";
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ReactNode as ReactReactNode,
  JSX as ReactJSX,
  ComponentProps as ReactComponentProps,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Breadcrumb: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- Breadcrumb uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Breadcrumb = reactForwardRef<
  HTMLElement,
  ReactComponentPropsWithoutRef<"nav"> & {
    separator?: ReactReactNode;
  }
>(({ ...props }, ref): ReactJSX.Element => (
  <nav
    aria-label="breadcrumb"
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Breadcrumb's native nav attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Breadcrumb.displayName = "Breadcrumb";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- BreadcrumbList: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- BreadcrumbList uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const BreadcrumbList = reactForwardRef<
  HTMLOListElement,
  ReactComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref): ReactJSX.Element => (
  <ol
    className={cn(
      "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward BreadcrumbList's native ol attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
BreadcrumbList.displayName = "BreadcrumbList";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- BreadcrumbItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- BreadcrumbItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const BreadcrumbItem = reactForwardRef<
  HTMLLIElement,
  ReactComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref): ReactJSX.Element => (
  <li
    className={cn("inline-flex items-center gap-1.5", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward BreadcrumbItem's native li attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
BreadcrumbItem.displayName = "BreadcrumbItem";
/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- BreadcrumbLink: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { asChild, className, ...props }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including asChild). */

/* oxlint-disable react/react-in-jsx-scope -- BreadcrumbLink uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const BreadcrumbLink = reactForwardRef<
  HTMLAnchorElement,
  ReactComponentPropsWithoutRef<"a"> & {
    asChild?: boolean;
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      className={cn("hover:text-foreground transition-colors", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward BreadcrumbLink's Comp prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
});
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
BreadcrumbLink.displayName = "BreadcrumbLink";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- BreadcrumbPage: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- BreadcrumbPage uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const BreadcrumbPage = reactForwardRef<
  HTMLSpanElement,
  ReactComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref): ReactJSX.Element => (
  <span
    aria-current="page"
    aria-disabled="true"
    className={cn("text-foreground font-normal", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward BreadcrumbPage's native span attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
BreadcrumbPage.displayName = "BreadcrumbPage";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- BreadcrumbSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- BreadcrumbSeparator uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: ReactComponentProps<"li">): ReactJSX.Element => (
  <li
    aria-hidden="true"
    className={cn("[&>svg]:h-3.5 [&>svg]:w-3.5", className)}
    role="presentation"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward BreadcrumbSeparator's native li attributes, preserving caller events and accessibility props.
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- BreadcrumbEllipsis: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"span">). */

/* oxlint-disable react/react-in-jsx-scope -- BreadcrumbEllipsis uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const BreadcrumbEllipsis = ({
  className,
  ...props
}: ReactComponentProps<"span">): ReactJSX.Element => (
  <span
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    role="presentation"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward BreadcrumbEllipsis's native span attributes, preserving caller events and accessibility props.
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
