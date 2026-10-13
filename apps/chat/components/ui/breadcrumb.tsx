import { ChevronRight, MoreHorizontal } from "lucide-react";
import type {
  ComponentProps as ReactComponentProps,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  JSX as ReactJSX,
  ReactNode as ReactReactNode,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

const Breadcrumb = reactForwardRef<
  HTMLElement,
  ReactComponentPropsWithoutRef<"nav"> & {
    separator?: ReactReactNode;
  }
>(
  (
    props,

    ref
  ): ReactJSX.Element => <nav aria-label="breadcrumb" ref={ref} {...props} />
);

Breadcrumb.displayName = "Breadcrumb";

const BreadcrumbList = reactForwardRef<
  HTMLOListElement,
  ReactComponentPropsWithoutRef<"ol">
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <ol
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

BreadcrumbList.displayName = "BreadcrumbList";

const BreadcrumbItem = reactForwardRef<
  HTMLLIElement,
  ReactComponentPropsWithoutRef<"li">
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <li
      className={cn("inline-flex items-center gap-1.5", className)}
      ref={ref}
      {...props}
    />
  )
);

BreadcrumbItem.displayName = "BreadcrumbItem";

const BreadcrumbLink = reactForwardRef<
  HTMLAnchorElement,
  ReactComponentPropsWithoutRef<"a"> & {
    asChild?: boolean;
  }
>(
  (
    { asChild, className, ...props },

    ref
  ) => {
    const Comp = asChild === true ? Slot : "a";

    return (
      <Comp
        className={cn("hover:text-foreground transition-colors", className)}
        ref={ref}
        {...props}
      />
    );
  }
);

BreadcrumbLink.displayName = "BreadcrumbLink";

const BreadcrumbPage = reactForwardRef<
  HTMLSpanElement,
  ReactComponentPropsWithoutRef<"span">
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <span
      aria-current="page"
      aria-disabled="true"
      className={cn("text-foreground font-normal", className)}
      ref={ref}
      {...props}
    />
  )
);

BreadcrumbPage.displayName = "BreadcrumbPage";

const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: ReactComponentProps<"li">): ReactJSX.Element => (
  <li
    aria-hidden="true"
    className={cn("[&>svg]:h-3.5 [&>svg]:w-3.5", className)}
    role="presentation"
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);

BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

const BreadcrumbEllipsis = ({
  className,
  ...props
}: ReactComponentProps<"span">): ReactJSX.Element => (
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
