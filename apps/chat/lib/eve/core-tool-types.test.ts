/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../agent/tools/deepResearch"; "../../tests/helpers/eve-tool-context"; "../../tools/chatjs/read-document/tool"; "../../tools/chatjs/saved-code-execution/tool"; "../../tools/chatjs/text-documents/tool" dependency within this package instead of introducing an alias or barrel API.
 */
import { beforeEach, expect, expectTypeOf, test, vi } from "vitest";

import type research from "../../agent/tools/deepResearch";
import { testToolContext } from "../../tests/helpers/eve-tool-context";
import type { readDocument } from "../../tools/chatjs/read-document/tool";
import type { runCodeDocument } from "../../tools/chatjs/saved-code-execution/tool";
import { createTextDocument } from "../../tools/chatjs/text-documents/tool";
import type { editTextDocument } from "../../tools/chatjs/text-documents/tool";
import type { NativeToolUI } from "./tool-types";
/* oxlint-enable import/no-relative-parent-imports */

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));
vi.mock("./document-tools", () => ({ executeEveDocumentTool: mocks.execute }));
/* oxlint-disable id-length --
 * id-length (#506): vi.mock("./turn-tools") uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
vi.mock("./turn-tools", () => ({
  filterEveTools: <T>(tools: T): Partial<T> => ({ ...tools }),
}));
/* oxlint-enable id-length */

beforeEach(() => {
  vi.resetAllMocks();
});

test("document definitions retain distinct create, edit, and read contracts", () => {
  expectTypeOf<
    NativeToolUI<typeof createTextDocument>["input"]
  >().toEqualTypeOf<{ content: string; fileIds: string[]; title: string }>();
  expectTypeOf<NativeToolUI<typeof editTextDocument>["input"]>().toEqualTypeOf<{
    content: string;
    documentId: string;
    expectedRevisionId: string;
    fileIds: string[];
    title: string;
  }>();
  expectTypeOf<NativeToolUI<typeof readDocument>["input"]>().toEqualTypeOf<{
    documentId: string;
  }>();
  expectTypeOf<
    NativeToolUI<typeof readDocument>["output"]["content"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    NativeToolUI<typeof createTextDocument>["output"]["status"]
  >().toEqualTypeOf<"success">();
  expectTypeOf<
    NativeToolUI<typeof editTextDocument>["output"]["revisionId"]
  >().toEqualTypeOf<string>();
});

test("document output is validated before crossing the native result boundary", async () => {
  mocks.execute.mockResolvedValue({ revisionId: "invalid", status: "success" });
  await expect(
    createTextDocument.execute(
      { content: "text", fileIds: [], title: "Title" },
      testToolContext()
    )
  ).rejects.toThrow();
});

test("native workflow outputs retain the report revision and clarification contracts", () => {
  type Research = NativeToolUI<typeof research>;
  expectTypeOf<
    Extract<Research["output"], { format: "report" }>["revisionId"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    Extract<Research["output"], { format: "clarifying_questions" }>["answer"]
  >().toEqualTypeOf<string>();
});

test("saved-code registration retains its revision input and output contracts", () => {
  expectTypeOf<NativeToolUI<typeof runCodeDocument>["input"]>().toEqualTypeOf<{
    documentId: string;
    revisionId: string;
  }>();
  expectTypeOf<
    Extract<
      NativeToolUI<typeof runCodeDocument>["output"],
      { documentId: string }
    >["documentId"]
  >().toEqualTypeOf<string>();
});
