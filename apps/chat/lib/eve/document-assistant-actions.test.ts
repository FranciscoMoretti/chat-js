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

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("does not offer spreadsheet analysis without its code-document destination") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("does not offer spreadsheet analysis without its code-document destination") accepts action; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("does not offer spreadsheet analysis without its code-document destination", () => {
  expect(documentAssistantActions("sheet")).toHaveLength(2);
  kinds.delete("code");
  expect(
    documentAssistantActions("sheet").map((action) => action.label)
  ).toEqual(["Format and clean data"]);
  expect(documentAssistantActions("code")).toEqual([]);
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

it("hides actions when their source implementation is absent", () => {
  kinds.delete("sheet");
  expect(documentAssistantActions("sheet")).toEqual([]);
  kinds.clear();
  expect(documentAssistantActions("text")).toEqual([]);
});
