import { beforeEach, expect, expectTypeOf, test, vi } from "vitest";
import type { NativeToolUI } from "./tool-types";
import { createTextDocument } from "@/tools/chatjs/text-documents/tool";
import type { editTextDocument } from "@/tools/chatjs/text-documents/tool";
import type { readDocument } from "@/tools/chatjs/read-document/tool";
import type research from "@/agent/tools/deepResearch";
import type { runCodeDocument } from "@/tools/chatjs/saved-code-execution/tool";
import { testToolContext } from "@/tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));
vi.mock("./document-tools", () => ({ executeEveDocumentTool: mocks.execute }));

vi.mock("./turn-tools", () => ({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of tools rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
  filterEveTools: <Tools>(tools: Tools): Partial<Tools> => ({ ...tools }),
}));

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

/* oxlint-disable oxc/no-async-await -- Await rejection from the native tool executor before completing the output-contract assertion. */
test("document output is validated before crossing the native result boundary", async () => {
  mocks.execute.mockResolvedValue({ revisionId: "invalid", status: "success" });
  await expect(
    createTextDocument.execute(
      { content: "text", fileIds: [], title: "Title" },
      testToolContext()
    )
  ).rejects.toThrow();
});
/* oxlint-enable oxc/no-async-await */
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
