"use client";

import "react-data-grid/lib/styles.css";
import React, { memo, useMemo, useState } from "react";
import { parse, unparse } from "papaparse";
import type { CellClickArgs, CellMouseEvent } from "react-data-grid";
import DataGrid, { textEditor } from "react-data-grid";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

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

const PureSpreadsheetEditor = ({
  content,
  saveContent,
  status: _status,
  isCurrentVersion: _isCurrentVersion,
  isReadonly,
}: ReadonlyNativeSurface<SheetEditorProps>): React.JSX.Element => {
  const { resolvedTheme } = useTheme();

  const parseData = useMemo(() => {
    if (!content) {
      return Array.from({ length: MIN_ROWS }, () =>
        Array.from({ length: MIN_COLS }, (): string => "")
      );
    }
    const result = parse<string[]>(content, { skipEmptyLines: true });

    const paddedData = result.data.map(
      (row: ReadonlyNativeSurface<string[]>): string[] => {
        const paddedRow = [...row];
        while (paddedRow.length < MIN_COLS) {
          paddedRow.push("");
        }
        return paddedRow;
      }
    );

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
      renderCell: ({ rowIdx }: Readonly<{ rowIdx: number }>): number =>
        rowIdx + 1,
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
      parseData.map(
        (row: ReadonlyNativeSurface<string[]>, rowIndex: number) => {
          const rowData: Record<string, string | number> = {
            id: rowIndex,
            rowNumber: rowIndex + 1,
          };

          for (const [colIndex, col] of columns.slice(1).entries()) {
            rowData[col.key] = row[colIndex] || "";
          }

          return rowData;
        }
      ),
    [parseData, columns]
  );

  const [localRows, setLocalRows] =
    useState<ReadonlyNativeSurface<Record<string, string | number>[]>>(
      initialRows
    );

  const [previousRows, setPreviousRows] = useState(initialRows);
  if (previousRows !== initialRows) {
    setPreviousRows(initialRows);
    setLocalRows(initialRows);
  }

  const handleRowsChange = (
    newRows: ReadonlyNativeSurface<Record<string, string | number>[]>
  ): void => {
    if (isReadonly === true) {
      return;
    }

    setLocalRows(newRows);

    const updatedData = newRows.map(
      (row: ReadonlyNativeSurface<Record<string, string | number>>) =>
        columns
          .slice(1)
          .map((col: ReadonlyNativeSurface<(typeof columns)[number]>) => {
            const value = row[col.key];
            if (typeof value === "number") {
              return value === 0 || Number.isNaN(value) ? "" : value;
            }
            return value ?? "";
          })
    );

    const newCsvContent = unparse(updatedData);
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
      onCellClick={(
        args: ReadonlyNativeSurface<
          CellClickArgs<Record<string, string | number>>
        >,
        event: Readonly<Pick<CellMouseEvent, "preventGridDefault">>
      ): void => {
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

const areEqual = (
  prevProps: ReadonlyNativeSurface<SheetEditorProps>,
  nextProps: ReadonlyNativeSurface<SheetEditorProps>
): boolean =>
  prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
  prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
  !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
  prevProps.content === nextProps.content &&
  prevProps.saveContent === nextProps.saveContent &&
  prevProps.isReadonly === nextProps.isReadonly;

export const SpreadsheetEditor = memo(PureSpreadsheetEditor, areEqual);
