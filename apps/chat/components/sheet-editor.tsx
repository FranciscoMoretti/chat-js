"use client";

import { useTheme } from "next-themes";
import { parse, unparse } from "papaparse";
import { memo, useEffect, useMemo, useState } from "react";
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
      return new Array(MIN_ROWS).fill(new Array(MIN_COLS).fill(""));
    }
    const result = parse<string[]>(content, { skipEmptyLines: true });

    const paddedData = result.data.map((row) => {
      const paddedRow = [...row];
      while (paddedRow.length < MIN_COLS) {
        paddedRow.push("");
      }
      return paddedRow;
    });

    while (paddedData.length < MIN_ROWS) {
      paddedData.push(new Array(MIN_COLS).fill(""));
    }

    return paddedData;
  }, [content]);

  const columns = useMemo(() => {
    const rowNumberColumn = {
      key: "rowNumber",
      name: "",
      frozen: true,
      width: 50,
      renderCell: ({ rowIdx }: { rowIdx: number }) => rowIdx + 1,
      cellClass: "border-t border-r bg-background text-foreground",
      headerCellClass: "border-t border-r bg-muted text-foreground",
    };

    const dataColumns = Array.from({ length: MIN_COLS }, (_, i) => ({
      key: i.toString(),
      name: String.fromCharCode(65 + i),
      renderEditCell: isReadonly ? undefined : textEditor,
      width: 120,
      cellClass: cn("bg-background text-foreground border-t", {
        "border-l": i !== 0,
      }),
      headerCellClass: cn("bg-muted text-foreground border-t", {
        "border-l": i !== 0,
      }),
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

        columns.slice(1).forEach((col, colIndex) => {
          rowData[col.key] = row[colIndex] || "";
        });

        return rowData;
      }),
    [parseData, columns]
  );

  const [localRows, setLocalRows] = useState(initialRows);

  useEffect(() => {
    setLocalRows(initialRows);
  }, [initialRows]);

  const generateCsv = (data: (string | number)[][]) => unparse(data);

  const handleRowsChange = (newRows: Record<string, string | number>[]) => {
    if (isReadonly) {
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
      onCellClick={(args) => {
        if (args.column.key !== "rowNumber" && !isReadonly) {
          args.selectCell(true);
        }
      }}
      onRowsChange={isReadonly ? undefined : handleRowsChange}
      rows={localRows}
      style={{ height: "100%" }}
    />
  );
};

const areEqual = (prevProps: SheetEditorProps, nextProps: SheetEditorProps) =>
  prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
  prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
  !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
  prevProps.content === nextProps.content &&
  prevProps.saveContent === nextProps.saveContent &&
  prevProps.isReadonly === nextProps.isReadonly;

export const SpreadsheetEditor = memo(PureSpreadsheetEditor, areEqual);
