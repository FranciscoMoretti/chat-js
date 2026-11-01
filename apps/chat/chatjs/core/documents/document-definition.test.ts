import { expect, it } from "vitest";
import { z } from "zod";
import { composeDocuments } from "@/chatjs/core/documents/document-definition";
import { isDocumentResult } from "@/chatjs/core/documents/contracts";

const diagram = {
  kind: "diagram",
  contentSchema: z.string().startsWith("graph "),
  createTool: "drawDiagram",
  editTool: "reviseDiagram",
};

it("adds a fourth kind with arbitrary operation names and its own validation", () => {
  const documents = composeDocuments([diagram]);
  expect(documents.operations.get("drawDiagram")).toEqual({
    kind: "diagram",
    edit: false,
  });
  expect(documents.operations.get("reviseDiagram")).toEqual({
    kind: "diagram",
    edit: true,
  });
  expect(
    documents.require("diagram").contentSchema.parse("graph A --> B")
  ).toBe("graph A --> B");
  expect(() =>
    documents.require("diagram").contentSchema.parse("bad")
  ).toThrow();
  expect(() => documents.require("unknown")).toThrow("unavailable");
});
it("rejects conflicting kinds, operation names and the core read operation", () => {
  expect(() => composeDocuments([diagram, diagram])).toThrow(
    "Duplicate document kind"
  );
  expect(() =>
    composeDocuments([diagram, { ...diagram, kind: "other" }])
  ).toThrow("operation");
  expect(() =>
    composeDocuments([{ ...diagram, editTool: "readDocument" }])
  ).toThrow("reserved");
});
it("recognizes historical receipts independently of installed kinds", () => {
  const removed = composeDocuments([]);
  expect(removed.find("diagram")).toBeUndefined();
  expect(
    isDocumentResult({
      documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
      revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
      kind: "diagram",
      title: "Flow",
      date: "2026-01-01",
      status: "success",
      result: "Document saved.",
    })
  ).toBe(true);
  expect(isDocumentResult({ kind: "diagram", content: "untrusted" })).toBe(
    false
  );
  expect(composeDocuments([diagram]).find("diagram")).toBe(diagram);
});
