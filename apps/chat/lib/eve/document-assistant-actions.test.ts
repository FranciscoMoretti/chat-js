import { beforeEach, expect, it, vi } from "vitest";

import { documentAssistantActions } from "./document-assistant-actions";

const kinds = vi.hoisted(() => new Set(["code", "sheet", "text"]));
vi.mock("@/tools/chatjs/installed-features", () => ({
  installedDocumentKinds: kinds,
}));
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: {
        code: { edits: "code-model" },
        sheet: { analyze: "analysis-model", format: "format-model" },
        text: { polish: "polish-model" },
      },
    },
  },
}));

beforeEach(() => {
  kinds.clear();
  for (const kind of ["code", "sheet", "text"]) {
    kinds.add(kind);
  }
});

it("does not offer spreadsheet analysis without its code-document destination", () => {
  expect(documentAssistantActions("sheet")).toHaveLength(2);
  kinds.delete("code");
  expect(
    documentAssistantActions("sheet").map((action) => action.label)
  ).toEqual(["Format and clean data"]);
  expect(documentAssistantActions("code")).toEqual([]);
});

it("hides actions when their source implementation is absent", () => {
  kinds.delete("sheet");
  expect(documentAssistantActions("sheet")).toEqual([]);
  kinds.clear();
  expect(documentAssistantActions("text")).toEqual([]);
});
