"use client";

import { useTheme } from "next-themes";
import { parse, unparse } from "papaparse";
import React, { memo, useMemo, useState } from "react";
import DataGrid, { textEditor } from "react-data-grid";

import { cn } from "@/lib/utils";

import "react-data-grid/lib/styles.css";

interface SheetEditorProps {
  content: string;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  isReadonly?: boolean;
  saveContent: (content: string, isCurrentVersion: boolean) => void;
  status: string;
}

const MIN_ROWS = 50;
const MIN_COLS = 26;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const generateCsv = (data: (string | number)[][]): string => unparse(data);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */

/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const PureSpreadsheetEditor = ({
  content,
  saveContent,
  status: _status,
  isCurrentVersion: _isCurrentVersion,
  isReadonly,
}: SheetEditorProps) => {
  const { resolvedTheme } = useTheme();

  const parseData = useMemo(() => {
    if (!content) {
      return Array.from({ length: MIN_ROWS }, () =>
        Array.from({ length: MIN_COLS }, (): string => "")
      );
    }
    const result = parse<string[]>(content, { skipEmptyLines: true });

    // oxlint-disable-next-line oxc/no-map-spread -- #541: Pad an independent row so the parsed CSV data remains unchanged.
    const paddedData = result.data.map((row) => {
      const paddedRow = [...row];
      while (paddedRow.length < MIN_COLS) {
        paddedRow.push("");
      }
      return paddedRow;
    });

    while (paddedData.length < MIN_ROWS) {
      paddedData.push(Array.from({ length: MIN_COLS }, (): string => ""));
    }

    return paddedData;
  }, [content]);

  const columns = useMemo(() => {
    const rowNumberColumn = {
      cellClass: "border-t border-r bg-background text-foreground",
      frozen: true,
      headerCellClass: "border-t border-r bg-muted text-foreground",
      key: "rowNumber",
      name: "",
      renderCell: ({ rowIdx }: { rowIdx: number }): number => rowIdx + 1,
      width: 50,
    };

    const dataColumns = Array.from({ length: MIN_COLS }, (_, i) => ({
      cellClass: cn("bg-background text-foreground border-t", {
        "border-l": i !== 0,
      }),
      headerCellClass: cn("bg-muted text-foreground border-t", {
        "border-l": i !== 0,
      }),
      key: i.toString(),
      name: String.fromCodePoint(65 + i),
      renderEditCell: isReadonly === true ? undefined : textEditor,
      width: 120,
    }));

    return [rowNumberColumn, ...dataColumns];
  }, [isReadonly]);

  const initialRows = useMemo(
    () =>
      parseData.map((row, rowIndex) => {
        const rowData: Record<string, string | number> = {
          id: rowIndex,
          rowNumber: rowIndex + 1,
        };

        for (const [colIndex, col] of columns.slice(1).entries()) {
          rowData[col.key] = row[colIndex] || "";
        }

        return rowData;
      }),
    [parseData, columns]
  );

  const [localRows, setLocalRows] = useState(initialRows);

  const [previousRows, setPreviousRows] = useState(initialRows);
  if (previousRows !== initialRows) {
    setPreviousRows(initialRows);
    setLocalRows(initialRows);
  }

  const handleRowsChange = (
    newRows: Record<string, string | number>[]
  ): void => {
    if (isReadonly === true) {
      return;
    }

    setLocalRows(newRows);

    const updatedData = newRows.map((row) =>
      columns.slice(1).map((col) => row[col.key] || "")
    );

    const newCsvContent = generateCsv(updatedData);
    saveContent(newCsvContent, true);
  };

  return (
    <DataGrid
      className={resolvedTheme === "dark" ? "rdg-dark" : "rdg-light"}
      columns={columns}
      defaultColumnOptions={{
        resizable: true,
        sortable: true,
      }}
      enableVirtualization
      onCellClick={(args, event): void => {
        if (args.column.key !== "rowNumber" && !(isReadonly === true)) {
          event.preventGridDefault();
          args.selectCell(true);
        }
      }}
      onRowsChange={isReadonly === true ? undefined : handleRowsChange}
      rows={localRows}
      style={{ height: "100%" }}
    />
  );
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */

/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const areEqual = (
  prevProps: SheetEditorProps,
  nextProps: SheetEditorProps
): boolean =>
  prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
  prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
  !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
  prevProps.content === nextProps.content &&
  prevProps.saveContent === nextProps.saveContent &&
  prevProps.isReadonly === nextProps.isReadonly;
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export const SpreadsheetEditor = memo(PureSpreadsheetEditor, areEqual);
