import type { LanguageModelV3StreamPart } from "@ai-sdk/provider";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";
import type { DocumentToolResult } from "../documents/types";
import type { DeepResearchRuntimeConfig } from "./configuration";

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  generate: vi.fn(),
  consume: vi.fn(),
}));
vi.mock("ai", async (original) => ({
  ...(await original<typeof import("ai")>()),
  streamText: mocks.stream,
  generateText: mocks.generate,
}));
vi.mock("../web-search", () => ({
  tavilyWebSearch: vi.fn(),
  firecrawlWebSearch: vi.fn(),
}));
vi.mock("./supervisor-agent", () => ({
  runSupervisor: vi.fn().mockResolvedValue(["Source findings"]),
}));
vi.mock("@/lib/ai/providers", () => {
  throw new Error("Research must use its runtime model resolver");
});
vi.mock("@/lib/db/queries", () => {
  throw new Error("Research must not import legacy persistence");
});

import { runDeepResearchPipeline } from "./pipeline";

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
  search_api: "none",
  search_api_max_queries: 1,
  status_update_model: "test",
  status_update_model_max_tokens: 100,
  summarization_model: "test",
  summarization_model_max_tokens: 100,
};
const input = {
  requestId: "request",
  messageId: "message",
  toolCallId: "research",
  messages: [],
};
const document = {
  status: "success" as const,
  documentId: "document",
  revisionId: "revision",
  result: "Saved",
  date: "2026-09-10",
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
      usage: Promise.resolve({ inputTokens: 4, outputTokens: 5 }),
      get toolResults() {
        return tools.createTextDocument
          .execute({ title: "Report", content: "# Findings" })
          .then((output) => [{ output }]);
      },
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
      saveReport,
      costAccumulator,
      getLanguageModel: () => Promise.resolve(new MockLanguageModelV3()),
      getModelContextWindow: () => Promise.resolve(10_000),
    }
  );
  expect(saveReport).toHaveBeenCalledExactlyOnceWith({
    title: "Report",
    content: "# Findings",
  });
  expect(result).toMatchObject({
    type: "report",
    data: { documentId: "document", revisionId: "revision" },
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
      saveReport: () =>
        Promise.resolve({ status: "error", error: "Save failed" }),
      publishReportStream,
      costAccumulator: { addAPICost: vi.fn(), addLLMCost: vi.fn() },
      getLanguageModel: () => Promise.resolve(new MockLanguageModelV3()),
      getModelContextWindow: () => Promise.resolve(10_000),
    }
  );
  expect(result).toEqual({
    type: "report",
    data: { status: "error", error: "Save failed" },
  });
  expect(publishReportStream).toHaveBeenCalledOnce();
  expect(mocks.consume).not.toHaveBeenCalled();
});

it("executes the report saver from an actual AI SDK tool-call stream", async () => {
  const sdk = await vi.importActual<typeof import("ai")>("ai");
  mocks.stream.mockImplementation(sdk.streamText);
  const saveReport = vi.fn().mockResolvedValue(document);
  const model = new MockLanguageModelV3({
    doStream: () =>
      Promise.resolve({
        stream: new ReadableStream<LanguageModelV3StreamPart>({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.enqueue({
              type: "tool-call",
              toolCallId: "save-report",
              toolName: "createTextDocument",
              input: JSON.stringify({
                title: "Streamed report",
                content: "# Streamed findings",
              }),
            });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "tool-calls", raw: "tool_calls" },
              usage: {
                inputTokens: {
                  total: 4,
                  noCache: 4,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 5, text: 5, reasoning: 0 },
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
      saveReport,
      costAccumulator: { addAPICost: vi.fn(), addLLMCost: vi.fn() },
      getLanguageModel: () => Promise.resolve(model),
      getModelContextWindow: () => Promise.resolve(10_000),
    }
  );
  expect(saveReport).toHaveBeenCalledExactlyOnceWith({
    title: "Streamed report",
    content: "# Streamed findings",
  });
  expect(result).toMatchObject({
    type: "report",
    data: { documentId: "document", revisionId: "revision" },
  });
});
