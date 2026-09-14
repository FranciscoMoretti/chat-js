import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import type * as AI from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";

import type { DocumentToolResult } from "../documents/types";
import type { DeepResearchRuntimeConfig } from "./configuration";
import { runDeepResearchPipeline } from "./pipeline";

/* eslint-disable sort-keys -- Provider protocol fixtures follow stream field order. */

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  generate: vi.fn(),
  stream: vi.fn(),
}));
vi.mock("ai", async (original) => ({
  ...(await original<typeof AI>()),
  generateText: mocks.generate,
  streamText: mocks.stream,
}));
vi.mock("../web-search", () => ({
  firecrawlWebSearch: vi.fn(),
  tavilyWebSearch: vi.fn(),
}));
vi.mock("./supervisor-agent", () => ({
  runSupervisor: vi.fn().mockResolvedValue(["Source findings"]),
}));
vi.mock("@/lib/ai/providers", () => {
  throw new Error("Research must use its runtime model resolver");
});
vi.mock("@/lib/ai/installed-tools", () => ({ installedTools: {} }));
vi.mock("@/lib/ai/telemetry", () => ({ chatTelemetry: [] }));
vi.mock("@/lib/db/queries", () => {
  throw new Error("Research must not import legacy persistence");
});

const config: DeepResearchRuntimeConfig = {
  allow_clarification: false,
  compression_model: "test",
  compression_model_max_tokens: 100,
  final_report_model: "test",
  final_report_model_max_tokens: 100,
  max_concurrent_research_units: 1,
  max_researcher_iterations: 1,
  max_structured_output_retries: 1,
  research_model: "test",
  research_model_max_tokens: 100,
  search_api_max_queries: 1,
  search_enabled: true,
  status_update_model: "test",
  status_update_model_max_tokens: 100,
  summarization_model: "test",
  summarization_model_max_tokens: 100,
};
const input = {
  messageId: "message",
  messages: [],
  requestId: "request",
  toolCallId: "research",
};
const document = {
  date: "2026-09-10",
  documentId: "document",
  result: "Saved",
  revisionId: "revision",
  status: "success" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generate.mockResolvedValue({
    output: { research_brief: "Brief", title: "Report" },
    usage: { inputTokens: 2, outputTokens: 3 },
  });
  mocks.stream.mockImplementation(
    ({
      tools,
    }: {
      tools: {
        createTextDocument: {
          execute: (input: {
            title: string;
            content: string;
          }) => Promise<DocumentToolResult>;
        };
      };
    }) => ({
      consumeStream: mocks.consume,
      toUIMessageStream: () => new ReadableStream(),
      get toolResults() {
        return tools.createTextDocument
          .execute({ title: "Report", content: "# Findings" })
          .then((output) => [{ output }]);
      },
      usage: Promise.resolve({ inputTokens: 4, outputTokens: 5 }),
    })
  );
});

it("saves via the supplied native operation, preserves its revision, and records report cost without merging a transcript", async () => {
  const saveReport = vi.fn().mockResolvedValue(document);
  const costAccumulator = { addAPICost: vi.fn(), addLLMCost: vi.fn() };
  const result = await runDeepResearchPipeline(
    input,
    config,
    { write: vi.fn() },
    {
      costAccumulator,
      getLanguageModel: () => Promise.resolve(new MockLanguageModelV3()),
      getModelContextWindow: () => Promise.resolve(10_000),
      saveReport,
    }
  );
  expect(saveReport).toHaveBeenCalledExactlyOnceWith({
    content: "# Findings",
    title: "Report",
  });
  expect(result).toMatchObject({
    data: { documentId: "document", revisionId: "revision" },
    type: "report",
  });
  expect(mocks.consume).toHaveBeenCalledOnce();
  expect(costAccumulator.addLLMCost).toHaveBeenCalledWith(
    "test",
    { inputTokens: 4, outputTokens: 5 },
    "deep-research-final-report"
  );
});

it("preserves the legacy stream callback and reports a failed save", async () => {
  const publishReportStream = vi.fn();
  const result = await runDeepResearchPipeline(
    input,
    config,
    { write: vi.fn() },
    {
      costAccumulator: { addAPICost: vi.fn(), addLLMCost: vi.fn() },
      getLanguageModel: () => Promise.resolve(new MockLanguageModelV3()),
      getModelContextWindow: () => Promise.resolve(10_000),
      publishReportStream,
      saveReport: () =>
        Promise.resolve({ status: "error", error: "Save failed" }),
    }
  );
  expect(result).toEqual({
    data: { error: "Save failed", status: "error" },
    type: "report",
  });
  expect(publishReportStream).toHaveBeenCalledOnce();
  expect(mocks.consume).not.toHaveBeenCalled();
});

it("executes the report saver from an actual AI SDK tool-call stream", async () => {
  const sdk = await vi.importActual<typeof AI>("ai");
  mocks.stream.mockImplementation(sdk.streamText);
  const saveReport = vi.fn().mockResolvedValue(document);
  const model = new MockLanguageModelV3({
    doStream: () =>
      Promise.resolve({
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({
              input: JSON.stringify({
                title: "Streamed report",
                content: "# Streamed findings",
              }),
              toolCallId: "save-report",
              toolName: "createTextDocument",
              type: "tool-call",
            });
            controller.enqueue({
              finishReason: { raw: "tool_calls", unified: "tool-calls" },
              type: "finish",
              usage: {
                inputTokens: {
                  cacheRead: 0,
                  cacheWrite: 0,
                  noCache: 4,
                  total: 4,
                },
                outputTokens: { reasoning: 0, text: 5, total: 5 },
              },
            });
            controller.close();
          },
        }),
      }),
  });
  const result = await runDeepResearchPipeline(
    input,
    config,
    { write: vi.fn() },
    {
      costAccumulator: { addAPICost: vi.fn(), addLLMCost: vi.fn() },
      getLanguageModel: () => Promise.resolve(model),
      getModelContextWindow: () => Promise.resolve(10_000),
      saveReport,
    }
  );
  expect(saveReport).toHaveBeenCalledExactlyOnceWith({
    content: "# Streamed findings",
    title: "Streamed report",
  });
  expect(result).toMatchObject({
    data: { documentId: "document", revisionId: "revision" },
    type: "report",
  });
});
