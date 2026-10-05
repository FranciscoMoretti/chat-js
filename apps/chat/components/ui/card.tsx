import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";

/* oxlint-disable react/react-in-jsx-scope -- Card uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Card = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the existing native styling, children and React open string & {} prop aliases; Readonly wrapping these aliases does not satisfy this rule.
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
): ReactJSX.Element => (
  <div
    className={cn(
      "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
      className
    )}
    data-slot="card"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Card's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */

/* oxlint-disable react/no-multi-comp -- CardHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- CardHeader uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CardHeader = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the existing native styling, children and React open string & {} prop aliases; Readonly wrapping these aliases does not satisfy this rule.
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
): ReactJSX.Element => (
  <div
    className={cn(
      "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
      className
    )}
    data-slot="card-header"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CardHeader's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- CardTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- CardTitle uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CardTitle = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the existing native styling, children and React open string & {} prop aliases; Readonly wrapping these aliases does not satisfy this rule.
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
): ReactJSX.Element => (
  <div
    className={cn("leading-none font-semibold", className)}
    data-slot="card-title"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CardTitle's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- CardDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- CardDescription uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CardDescription = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the existing native styling, children and React open string & {} prop aliases; Readonly wrapping these aliases does not satisfy this rule.
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
): ReactJSX.Element => (
  <div
    className={cn("text-muted-foreground text-sm", className)}
    data-slot="card-description"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CardDescription's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- CardAction: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- CardAction uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CardAction = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the existing native styling, children and React open string & {} prop aliases; Readonly wrapping these aliases does not satisfy this rule.
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
): ReactJSX.Element => (
  <div
    className={cn(
      "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
      className
    )}
    data-slot="card-action"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CardAction's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- CardContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- CardContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CardContent = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the existing native styling, children and React open string & {} prop aliases; Readonly wrapping these aliases does not satisfy this rule.
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
): ReactJSX.Element => (
  <div
    className={cn("px-6", className)}
    data-slot="card-content"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CardContent's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- CardFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable react/react-in-jsx-scope -- CardFooter uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const CardFooter = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the existing native styling, children and React open string & {} prop aliases; Readonly wrapping these aliases does not satisfy this rule.
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<"div">
): ReactJSX.Element => (
  <div
    className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
    data-slot="card-footer"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward CardFooter's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
/* oxlint-enable import/no-named-export */
