/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Table: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref): React.JSX.Element => (
  <div className="relative w-full overflow-auto">
    <table
      className={cn("w-full caption-bottom text-sm", className)}
      ref={ref}
      {...props}
    />
  </div>
));
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
Table.displayName = "Table";
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TableHeader: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref): React.JSX.Element => (
  <thead className={cn("[&_tr]:border-b", className)} ref={ref} {...props} />
));
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
TableHeader.displayName = "TableHeader";
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TableBody: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref): React.JSX.Element => (
  <tbody
    className={cn("[&_tr:last-child]:border-0", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
TableBody.displayName = "TableBody";
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TableFooter: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref): React.JSX.Element => (
  <tfoot
    className={cn(
      "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
TableFooter.displayName = "TableFooter";
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TableRow: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref): React.JSX.Element => (
  <tr
    className={cn(
      "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
TableRow.displayName = "TableRow";
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TableHead: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref): React.JSX.Element => (
  <th
    className={cn(
      "text-muted-foreground h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0",
      className
    )}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
TableHead.displayName = "TableHead";
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TableCell: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref): React.JSX.Element => (
  <td
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
TableCell.displayName = "TableCell";
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TableCaption: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref): React.JSX.Element => (
  <caption
    className={cn("text-muted-foreground mt-4 text-sm", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
TableCaption.displayName = "TableCaption";

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
