import type {
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
  TdHTMLAttributes as ReactTdHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

const Table = reactForwardRef<
  HTMLTableElement,
  ReactHTMLAttributes<HTMLTableElement>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <div className="relative w-full overflow-auto">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        ref={ref}
        {...props}
      />
    </div>
  )
);

Table.displayName = "Table";

const TableBody = reactForwardRef<
  HTMLTableSectionElement,
  ReactHTMLAttributes<HTMLTableSectionElement>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      ref={ref}
      {...props}
    />
  )
);

TableBody.displayName = "TableBody";

const TableRow = reactForwardRef<
  HTMLTableRowElement,
  ReactHTMLAttributes<HTMLTableRowElement>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <tr
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

TableRow.displayName = "TableRow";

const TableCell = reactForwardRef<
  HTMLTableCellElement,
  ReactTdHTMLAttributes<HTMLTableCellElement>
>(
  (
    { className, ...props },

    ref
  ): ReactJSX.Element => (
    <td
      className={cn(
        "p-4 align-middle [&:has([role=checkbox])]:pr-0",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

TableCell.displayName = "TableCell";

export { Table, TableBody, TableCell, TableRow };
