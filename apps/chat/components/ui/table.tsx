import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
  TdHTMLAttributes as ReactTdHTMLAttributes,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

/* oxlint-disable react/react-in-jsx-scope -- Table uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Table = reactForwardRef<
  HTMLTableElement,
  ReactHTMLAttributes<HTMLTableElement>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases.
    { className, ...props },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve forwardRef's native writable current object and callback ref contract.
    ref
  ): ReactJSX.Element => (
    <div className="relative w-full overflow-auto">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        ref={ref}
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Table's native table attributes, preserving caller events and accessibility props.
        {...props}
      />
    </div>
  )
);
/* oxlint-enable react/react-in-jsx-scope */

Table.displayName = "Table";

/* oxlint-disable react/react-in-jsx-scope -- TableBody uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableBody = reactForwardRef<
  HTMLTableSectionElement,
  ReactHTMLAttributes<HTMLTableSectionElement>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases.
    { className, ...props },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve forwardRef's native writable current object and callback ref contract.
    ref
  ): ReactJSX.Element => (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableBody's native tbody attributes, preserving caller events and accessibility props.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

TableBody.displayName = "TableBody";

/* oxlint-disable react/react-in-jsx-scope -- TableRow uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableRow = reactForwardRef<
  HTMLTableRowElement,
  ReactHTMLAttributes<HTMLTableRowElement>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases.
    { className, ...props },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve forwardRef's native writable current object and callback ref contract.
    ref
  ): ReactJSX.Element => (
    <tr
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableRow's native tr attributes, preserving caller events and accessibility props.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

TableRow.displayName = "TableRow";

/* oxlint-disable react/react-in-jsx-scope -- TableCell uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const TableCell = reactForwardRef<
  HTMLTableCellElement,
  ReactTdHTMLAttributes<HTMLTableCellElement>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases.
    { className, ...props },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Preserve forwardRef's native writable current object and callback ref contract.
    ref
  ): ReactJSX.Element => (
    <td
      className={cn(
        "p-4 align-middle [&:has([role=checkbox])]:pr-0",
        className
      )}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward TableCell's native td attributes, preserving caller events and accessibility props.
      {...props}
    />
  )
);
/* oxlint-enable react/react-in-jsx-scope */

TableCell.displayName = "TableCell";

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Table, TableBody, TableCell, TableRow); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Table, TableBody, TableCell, TableRow };
/* oxlint-enable import/no-named-export */
