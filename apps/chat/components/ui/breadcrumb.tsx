import { Slot } from "@radix-ui/react-slot";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { ChevronRight, MoreHorizontal } from "lucide-react";
/* oxlint-enable sort-imports */
import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  JSX as ReactJSX,
  ReactNode as ReactReactNode,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Breadcrumb: typescript/prefer-readonly-parameter-types: React nav props preserve the existing forwarded ref and native event callback contracts. */

/* oxlint-disable react/react-in-jsx-scope -- Breadcrumb uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Breadcrumb = reactForwardRef<
  HTMLElement,
  ReactComponentPropsWithoutRef<"nav"> & {
    separator?: ReactReactNode;
  }
>((props, ref): ReactJSX.Element => (
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
      // oxlint-disable-next-line react/forbid-component-props -- Comp accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-disable react/jsx-no-literals -- BreadcrumbEllipsis renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
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
    <MoreHorizontal
      // oxlint-disable-next-line react/forbid-component-props -- MoreHorizontal accepts className in its styling contract; preserve this caller's layout and appearance.
      className="h-4 w-4"
    />
    <span className="sr-only">More</span>
  </span>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
/* oxlint-enable import/no-named-export */
