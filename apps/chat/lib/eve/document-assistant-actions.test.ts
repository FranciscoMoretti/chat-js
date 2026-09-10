import { beforeEach, expect, it, vi } from "vitest";
import { documentAssistantActions } from "./document-assistant-actions";

const documents = vi.hoisted(() => ({
  enabled: true,
  types: { text: true, code: true, sheet: true },
}));
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: {
        documents,
        text: { polish: "polish-model" },
        code: { edits: "code-model" },
        sheet: { format: "format-model", analyze: "analysis-model" },
      },
    },
  },
}));

beforeEach(() => {
  documents.enabled = true;
  documents.types.code = true;
  documents.types.sheet = true;
});

it("does not offer spreadsheet analysis without its code-document destination", () => {
  expect(documentAssistantActions("sheet")).toHaveLength(2);
  documents.types.code = false;
  expect(
    documentAssistantActions("sheet").map((action) => action.label)
  ).toEqual(["Format and clean data"]);
  expect(documentAssistantActions("code")).toEqual([]);
});

it("hides actions when their source type or documents are disabled", () => {
  documents.types.sheet = false;
  expect(documentAssistantActions("sheet")).toEqual([]);
  documents.enabled = false;
  expect(documentAssistantActions("text")).toEqual([]);
});
