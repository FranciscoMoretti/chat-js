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

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("does not offer spreadsheet analysis without its code-document destination") uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("does not offer spreadsheet analysis without its code-document destination", () => {
  expect(documentAssistantActions("sheet")).toHaveLength(2);
  kinds.delete("code");
  expect(
    documentAssistantActions("sheet").map(
      (action: { readonly label: string }) => action.label
    )
  ).toEqual(["Format and clean data"]);
  expect(documentAssistantActions("code")).toEqual([]);
});
/* oxlint-enable no-magic-numbers */

it("hides actions when their source implementation is absent", () => {
  kinds.delete("sheet");
  expect(documentAssistantActions("sheet")).toEqual([]);
  kinds.clear();
  expect(documentAssistantActions("text")).toEqual([]);
});

const documentKinds: readonly ("text" | "code" | "sheet")[] = [
  "text",
  "code",
  "sheet",
];
it.each(documentKinds)("returns fresh mutable actions for %s", (kind) => {
  const actions = documentAssistantActions(kind);
  const freshActions = documentAssistantActions(kind);
  expect(actions).toEqual(freshActions);
  expect(actions).not.toBe(freshActions);
  for (const action of actions) {
    expect(freshActions).not.toContain(action);
    action.label = "Changed by caller";
  }
  actions.length = 0;
  expect(documentAssistantActions(kind)).toEqual(freshActions);
});
