import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
  TdHTMLAttributes as ReactTdHTMLAttributes,
  ThHTMLAttributes as ReactThHTMLAttributes,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Table: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- Table uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Table = reactForwardRef<
  HTMLTableElement,
  ReactHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <div className="relative w-full overflow-auto">
    <table
      className={cn("w-full caption-bottom text-sm", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Table's native table attributes, preserving caller events and accessibility props.
      {...props}
    />
  </div>
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Table.displayName = "Table";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TableHeader uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableHeader = reactForwardRef<
  HTMLTableSectionElement,
  ReactHTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <thead
    className={cn("[&_tr]:border-b", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableHeader's native thead attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableHeader.displayName = "TableHeader";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableBody: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TableBody uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableBody = reactForwardRef<
  HTMLTableSectionElement,
  ReactHTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <tbody
    className={cn("[&_tr:last-child]:border-0", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableBody's native tbody attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableBody.displayName = "TableBody";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TableFooter uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableFooter = reactForwardRef<
  HTMLTableSectionElement,
  ReactHTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <tfoot
    className={cn(
      "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableFooter's native tfoot attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableFooter.displayName = "TableFooter";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableRow: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TableRow uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableRow = reactForwardRef<
  HTMLTableRowElement,
  ReactHTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <tr
    className={cn(
      "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableRow's native tr attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableRow.displayName = "TableRow";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableHead: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TableHead uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableHead = reactForwardRef<
  HTMLTableCellElement,
  ReactThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <th
    className={cn(
      "text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0",
      className
    )}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableHead's native th attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableHead.displayName = "TableHead";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableCell: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TableCell uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableCell = reactForwardRef<
  HTMLTableCellElement,
  ReactTdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <td
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableCell's native td attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableCell.displayName = "TableCell";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableCaption: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- TableCaption uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableCaption = reactForwardRef<
  HTMLTableCaptionElement,
  ReactHTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <caption
    className={cn("text-muted-foreground mt-4 text-sm", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableCaption's native caption attributes, preserving caller events and accessibility props.
    {...props}
  />
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableCaption.displayName = "TableCaption";

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
/* oxlint-enable import/no-named-export */
