import { beforeEach, expect, expectTypeOf, test, vi } from "vitest";

import type research from "../../agent/tools/deepResearch";
import { testToolContext } from "../../tests/helpers/eve-tool-context";
import type { readDocument } from "../../tools/chatjs/read-document/tool";
import { createTextDocument } from "../../tools/chatjs/text-documents/tool";
import type { editTextDocument } from "../../tools/chatjs/text-documents/tool";
import type { NativeToolUI } from "./tool-types";

const mocks = vi.hoisted(() => ({
  documents: { enabled: true, types: { code: true, sheet: true, text: true } },
  execute: vi.fn(),
  execution: { enabled: true },
}));
vi.mock("../config", () => ({
  config: {
    ai: {
      tools: { codeExecution: mocks.execution, documents: mocks.documents },
    },
  },
}));
vi.mock("./document-tools", () => ({ executeEveDocumentTool: mocks.execute }));
vi.mock("./document-execution", () => ({ executeEveCodeDocument: vi.fn() }));
vi.mock("./turn-tools", () => ({
  filterEveTools: <T>(tools: T): Partial<T> => ({ ...tools }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.documents.enabled = true;
  mocks.documents.types = { code: true, sheet: true, text: true };
  mocks.execution.enabled = true;
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
