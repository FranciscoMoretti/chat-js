"use client";
import { useState } from "react";
import { SpreadsheetGrid } from "@/chatjs/ui/spreadsheet/grid";
import { Button } from "@/components/ui/button";
import type { SpreadsheetSheet } from "./load";

export type SpreadsheetState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly sheets: readonly SpreadsheetSheet[] };
export const SpreadsheetPreview = ({
  state,
}: {
  readonly state: SpreadsheetState;
}) => {
  const [selected, setSelected] = useState(0);
  if (state.status === "loading") {
    return (
      <output className="text-muted-foreground block p-8 text-sm">
        Loading spreadsheet…
      </output>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-destructive p-8 text-sm">
        {state.message}
      </p>
    );
  }
  const sheet = state.sheets[selected] ?? state.sheets[0];
  if (state.sheets.length === 0) {
    return (
      <p className="text-muted-foreground p-8 text-sm">
        No worksheets in this file.
      </p>
    );
  }
  return (
    <div className="min-w-0 space-y-3">
      {state.sheets.length > 1 && (
        <fieldset
          aria-label="Worksheets"
          className="flex gap-1 overflow-x-auto"
        >
          {state.sheets.map((entry, index) => (
            <Button
              key={entry.name}
              size="sm"
              variant={selected === index ? "secondary" : "ghost"}
              aria-pressed={selected === index}
              onClick={() => {
                setSelected(index);
              }}
            >
              {entry.name}
            </Button>
          ))}
        </fieldset>
      )}
      <div className="h-[min(55vh,36rem)] overflow-hidden rounded-md border">
        <SpreadsheetGrid content={sheet.content} isReadonly />
      </div>
      <p className="text-muted-foreground text-xs">
        Read-only · Cell values only.{" "}
        {sheet.truncated
          ? "Showing up to 5,000 rows and 200 columns. Download for the full spreadsheet."
          : "Download to edit or see workbook formatting."}
      </p>
    </div>
  );
};
