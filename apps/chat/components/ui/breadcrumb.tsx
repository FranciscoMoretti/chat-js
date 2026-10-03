import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Breadcrumb: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ...props }). */

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode;
  }
>(({ ...props }, ref): React.JSX.Element => (
  <nav aria-label="breadcrumb" ref={ref} {...props} />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Breadcrumb.displayName = "Breadcrumb";
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- BreadcrumbList: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref): React.JSX.Element => (
  <ol
    className={cn(
      "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
BreadcrumbList.displayName = "BreadcrumbList";
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- BreadcrumbItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref): React.JSX.Element => (
  <li
    className={cn("inline-flex items-center gap-1.5", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
BreadcrumbItem.displayName = "BreadcrumbItem";
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- BreadcrumbLink: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { asChild, className, ...props }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including asChild). */

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean;
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      className={cn("hover:text-foreground transition-colors", className)}
      ref={ref}
      {...props}
    />
  );
});
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
BreadcrumbLink.displayName = "BreadcrumbLink";
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- BreadcrumbPage: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref): React.JSX.Element => (
  <span
    aria-current="page"
    aria-disabled="true"
    className={cn("text-foreground font-normal", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
BreadcrumbPage.displayName = "BreadcrumbPage";
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- BreadcrumbSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: React.ComponentProps<"li">): React.JSX.Element => (
  <li
    aria-hidden="true"
    className={cn("[&>svg]:h-3.5 [&>svg]:w-3.5", className)}
    role="presentation"
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- BreadcrumbEllipsis: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"span">). */

const BreadcrumbEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">): React.JSX.Element => (
  <span
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    role="presentation"
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
);
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
