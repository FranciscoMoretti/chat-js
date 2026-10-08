import React from "react";
import { Separator } from "@/components/ui/separator";
import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

const buttonGroupVariants = cva(
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    defaultVariants: {
      orientation: "horizontal",
    },
    variants: {
      orientation: {
        horizontal:
          "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
      },
    },
  }
);

const ButtonGroup = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    orientation,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, orientation from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(buttonGroupVariants({ orientation }), className)}
    data-orientation={orientation}
    data-slot="button-group"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ButtonGroup's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);

/* oxlint-disable react/no-multi-comp -- ButtonGroupText: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ButtonGroupText = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    asChild = false,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, asChild from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: React.ComponentProps<"div"> & {
    readonly asChild?: boolean;
  }
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  // oxlint-disable-next-line no-ternary -- Keep Comp as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      // oxlint-disable-next-line react/forbid-component-props -- Comp accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ButtonGroupText's Comp prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- ButtonGroupSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ButtonGroupSeparator = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    orientation = "vertical",
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, orientation from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: React.ComponentProps<typeof Separator>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <Separator
    // oxlint-disable-next-line react/forbid-component-props -- Separator accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "bg-input relative !m-0 self-stretch data-[orientation=vertical]:h-auto",
      className
    )}
    data-slot="button-group-separator"
    orientation={orientation}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ButtonGroupSeparator's Separator prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/only-export-components -- button-group.tsx exports: react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
