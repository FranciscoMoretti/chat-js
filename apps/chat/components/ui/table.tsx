import { forwardRef as reactForwardRef } from "react";
import type {
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
  ThHTMLAttributes as ReactThHTMLAttributes,
  TdHTMLAttributes as ReactTdHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Table: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const Table = reactForwardRef<
  HTMLTableElement,
  ReactHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <div className="relative w-full overflow-auto">
    <table
      className={cn("w-full caption-bottom text-sm", className)}
      ref={ref}
      {...props}
    />
  </div>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
Table.displayName = "Table";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableHeader = reactForwardRef<
  HTMLTableSectionElement,
  ReactHTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <thead className={cn("[&_tr]:border-b", className)} ref={ref} {...props} />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableHeader.displayName = "TableHeader";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableBody: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableBody = reactForwardRef<
  HTMLTableSectionElement,
  ReactHTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <tbody
    className={cn("[&_tr:last-child]:border-0", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableBody.displayName = "TableBody";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

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
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableFooter.displayName = "TableFooter";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableRow: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

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
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableRow.displayName = "TableRow";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableHead: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

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
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableHead.displayName = "TableHead";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableCell: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableCell = reactForwardRef<
  HTMLTableCellElement,
  ReactTdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <td
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
TableCell.displayName = "TableCell";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- TableCaption: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }). */

const TableCaption = reactForwardRef<
  HTMLTableCaptionElement,
  ReactHTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref): ReactJSX.Element => (
  <caption
    className={cn("text-muted-foreground mt-4 text-sm", className)}
    ref={ref}
    {...props}
  />
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
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
