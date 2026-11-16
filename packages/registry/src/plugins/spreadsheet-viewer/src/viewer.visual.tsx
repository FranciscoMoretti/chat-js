import React from "react";
import { expect, test } from "vitest";
import { captureChatStory, flush } from "../../../tools/_shared/visual";
import { SpreadsheetPreview } from "./preview";
import { parseSpreadsheet, loadSpreadsheet, spreadsheetFormat } from "./load";
import { SpreadsheetViewerAction } from "./viewer-action";

test("spreadsheet preview covers loading, unavailable, empty, sheets and limits", async () => {
  const response = await fetch(
    new URL("../fixtures/budget.xlsx", import.meta.url)
  );
  const sheets = await parseSpreadsheet(await response.blob(), "xlsx");
  expect(sheets.map((sheet) => sheet.name)).toEqual(["Budget", "Notes"]);
  expect(sheets[0]?.content).toContain("Hosting,120");
  expect(sheets[0]?.content).toContain("Total,120");
  await captureChatStory("spreadsheet-viewer", [
    {
      label: "Loading",
      ui: <SpreadsheetPreview state={{ status: "loading" }} />,
    },
    {
      label: "Unavailable",
      ui: (
        <SpreadsheetPreview
          state={{
            status: "error",
            message: "This file is unavailable or you no longer have access.",
          }}
        />
      ),
    },
    {
      label: "Empty",
      ui: <SpreadsheetPreview state={{ status: "ready", sheets: [] }} />,
    },
    {
      label: "XLSX worksheets",
      ui: <SpreadsheetPreview state={{ status: "ready", sheets }} />,
      settle: async (section) => {
        expect(section.textContent).toContain("Hosting");
        const notes = [...section.querySelectorAll("button")].find(
          (button) => button.textContent === "Notes"
        );
        if (!notes) {
          throw new Error("Worksheet selector missing");
        }
        await flush(() => {
          notes.click();
        });
        expect(section.textContent).toContain("Launch plan");
        expect(section.querySelector("input")).toBeNull();
      },
    },
    {
      label: "Limited preview",
      ui: (
        <SpreadsheetPreview
          state={{
            status: "ready",
            sheets: [
              {
                name: "Sheet 1",
                content: "Item,Cost\nHosting,120",
                truncated: true,
              },
            ],
          }}
        />
      ),
    },
  ]);
});

test("CSV and TSV parse literally, reject corrupt workbooks, and fetch only on opening", async () => {
  const artifact = {
    name: "budget.csv",
    mediaType: "text/csv",
    url: "data:text/csv,Item%2CCost%0AHosting%2C120",
  };
  expect(
    spreadsheetFormat({
      ...artifact,
      name: "legacy.xls",
      mediaType: "application/vnd.ms-excel",
    })
  ).toBeNull();
  const csv = await loadSpreadsheet(artifact, new AbortController().signal);
  const tsv = await parseSpreadsheet(
    new Blob(["Item\tCost\nHosting\t120"]),
    "tsv"
  );
  expect(csv[0]?.content).toContain("Hosting,120");
  expect(tsv[0]?.content).toContain("Hosting,120");
  await expect(
    parseSpreadsheet(new Blob(["not a workbook"]), "xlsx")
  ).rejects.toThrow();
  const limits = await parseSpreadsheet(
    new Blob([Array.from({ length: 5002 }, (_, i) => `${i},test`).join("\n")]),
    "csv"
  );
  expect(limits[0]?.truncated).toBe(true);
  await captureChatStory("spreadsheet-file-action", [
    {
      label: "Optional file action",
      ui: <SpreadsheetViewerAction artifact={artifact} />,
    },
  ]);
});
