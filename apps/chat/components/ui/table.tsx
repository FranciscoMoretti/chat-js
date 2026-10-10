import type {
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
  TdHTMLAttributes as ReactTdHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

/* oxlint-disable react/react-in-jsx-scope -- Table uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Table = reactForwardRef<
  HTMLTableElement,
  ReactHTMLAttributes<HTMLTableElement>
>(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    /* oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases. */
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
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
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    /* oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases. */
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
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
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    /* oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases. */
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
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
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    /* oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. Native props preserve CSSProperties, children and React open string aliases. */
    { className, ...props },
    /* oxlint-enable typescript/prefer-readonly-parameter-types */ /* oxlint-disable typescript/prefer-readonly-parameter-types -- The primitive receives this original ref and assigns its current DOM element; retain native ref writer identity and its DOM type. */
    ref
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
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
