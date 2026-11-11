import assert from "node:assert/strict";
import { test } from "node:test";
import { sceneMessages } from "./scenarios";
import { registryItems } from "../../../../packages/registry/registry-items";
import { toolDefinitionSchema } from "../../../../packages/registry/metadata";
import { previewTools } from "./preview-tools";
import { toolExamples } from "./tool-examples";
import {
  generateImageInput,
  generateImageResult,
} from "../../../chat/chatjs/tools/generate-image/schemas";
import {
  generateVideoInput,
  generateVideoResult,
} from "../../../chat/chatjs/tools/generate-video/schemas";
import {
  codeExecutionInput,
  codeExecutionResult,
} from "../../../chat/chatjs/tools/code-execution/schemas";
import {
  documentExecutionInput,
  documentExecutionResult,
} from "../../../chat/chatjs/tools/saved-code-execution/schemas";
import {
  wordCountInput,
  wordCountResult,
} from "../../../chat/chatjs/tools/word-count/schemas";
import {
  weatherInput,
  weatherResult,
} from "../../../chat/chatjs/tools/get-weather/schemas";
import {
  webSearchInput,
  webSearchResult,
} from "../../../chat/chatjs/tools/tavily-search/schemas";
import {
  retrievedInput,
  retrievedResult,
} from "../../../chat/chatjs/tools/retrieve-url/schemas";
import {
  researchInput,
  researchOutput,
} from "../../../chat/chatjs/tools/deep-research/schemas";
import {
  eveDocumentCreateInput,
  eveDocumentWriteResult,
  eveDocumentReadInput,
  eveDocumentReadResult,
} from "../../../chat/chatjs/core/documents/contracts";
import {
  createDocumentFixtures,
  createPreviewDocument,
  sampleDocuments,
} from "./preview-documents";

void test("every built-in tool has a successful example or is covered by its document creation example", () => {
  const ids = registryItems.flatMap((item) => {
    const parsed = toolDefinitionSchema.safeParse(item.meta?.chatjs);
    return parsed.success ? [parsed.data.id] : [];
  });
  const names = [...previewTools(ids)].filter(
    (name) => !name.startsWith("edit")
  );
  assert.deepEqual(
    names.filter((name) => toolExamples[name] === undefined),
    []
  );
  const parts = sceneMessages("preview-tools", false, new Set(names))
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "tool");
  assert.equal(parts.length, names.length);
  assert.ok(parts.every((part) => part.state === "completed"));
});

for (const [name, input, output] of [
  ["generateImage", generateImageInput, generateImageResult],
  ["generateVideo", generateVideoInput, generateVideoResult],
  ["codeExecution", codeExecutionInput, codeExecutionResult],
  ["runCodeDocument", documentExecutionInput, documentExecutionResult],
  ["wordCount", wordCountInput, wordCountResult],
  ["getWeather", weatherInput, weatherResult],
  ["webSearch", webSearchInput, webSearchResult],
  ["retrieveUrl", retrievedInput, retrievedResult],
  ["deepResearch", researchInput, researchOutput],
  ["createTextDocument", eveDocumentCreateInput, eveDocumentWriteResult],
  ["createCodeDocument", eveDocumentCreateInput, eveDocumentWriteResult],
  ["createSheetDocument", eveDocumentCreateInput, eveDocumentWriteResult],
  ["readDocument", eveDocumentReadInput, eveDocumentReadResult],
] as const) {
  void test(`${name} example satisfies the production renderer contract`, () => {
    const example = toolExamples[name];
    assert.ok(example);
    assert.ok(input.safeParse(example.input).success);
    assert.ok(output.safeParse(example.output).success);
  });
}

void test("document examples open their matching editor data", () => {
  const fixtures = createDocumentFixtures(() => {});
  for (const sample of Object.values(sampleDocuments)) {
    const result = fixtures.resolve("eve.document", {
      documentId: sample.documentId,
    });
    assert.deepEqual(result, createPreviewDocument(sample.kind));
  }
});

void test("selected media and execution tools preview successful results", () => {
  const parts = sceneMessages(
    "preview-tools",
    false,
    new Set(["generateImage", "generateVideo", "codeExecution"])
  )
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "tool");
  assert.equal(parts.length, 3);
  assert.deepEqual(
    parts.map((part) => part.state),
    ["completed", "completed", "completed"]
  );
});
