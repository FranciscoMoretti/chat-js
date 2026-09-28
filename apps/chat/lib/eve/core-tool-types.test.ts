import { beforeEach, expect, expectTypeOf, test, vi } from "vitest";

import type research from "../../agent/tools/deepResearch";
import documents, { documentTools } from "../../agent/tools/documents";
import { testToolContext } from "../../tests/helpers/eve-tool-context";
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
    NativeToolUI<typeof documentTools.createTextDocument>["input"]
  >().toEqualTypeOf<{ content: string; fileIds: string[]; title: string }>();
  expectTypeOf<
    NativeToolUI<typeof documentTools.editTextDocument>["input"]
  >().toEqualTypeOf<{
    content: string;
    documentId: string;
    expectedRevisionId: string;
    fileIds: string[];
    title: string;
  }>();
  expectTypeOf<
    NativeToolUI<typeof documentTools.readDocument>["input"]
  >().toEqualTypeOf<{ documentId: string }>();
  expectTypeOf<
    NativeToolUI<typeof documentTools.readDocument>["output"]["content"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    NativeToolUI<typeof documentTools.createTextDocument>["output"]["status"]
  >().toEqualTypeOf<"success">();
  expectTypeOf<
    NativeToolUI<typeof documentTools.editTextDocument>["output"]["revisionId"]
  >().toEqualTypeOf<string>();
});

test("document output is validated before crossing the native result boundary", async () => {
  mocks.execute.mockResolvedValue({ revisionId: "invalid", status: "success" });
  await expect(
    documentTools.createTextDocument.execute(
      { content: "text", fileIds: [], title: "Title" },
      testToolContext()
    )
  ).rejects.toThrow();
});

test("document flags filter concrete definitions without mutating the registry", async () => {
  const resolve = documents.events["step.started"];
  if (!resolve) {
    throw new Error("Missing document resolver");
  }
  const context = {
    channel: {},
    messages: [],
    model: null,
    session: { auth: { current: null, initiator: null }, id: "test" },
  };
  mocks.documents.types.code = false;
  const tools = await resolve({}, context);
  expect(Object.keys(tools).toSorted()).toEqual([
    "createSheetDocument",
    "createTextDocument",
    "editSheetDocument",
    "editTextDocument",
    "readDocument",
  ]);
  expect(documentTools.createCodeDocument).toBeDefined();
  mocks.documents.enabled = false;
  expect(await resolve({}, context)).toEqual({});
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
