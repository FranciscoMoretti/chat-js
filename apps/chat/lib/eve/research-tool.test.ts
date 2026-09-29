import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { runDeepResearchPipeline } from "../../tools/platform/deep-research/pipeline";
import { executeEveResearch } from "./research-tool";
import { EveSessionMappingError } from "./session-mapping-error";

const mocks = await vi.hoisted(async () => {
  const { gatewayModelDefaults } = await import("../ai/gateway-model-defaults");
  return {
    documents: { enabled: true, types: { text: true } },
    enabled: { enabled: true },
    logError: vi.fn(),
    modelId: gatewayModelDefaults.workflows.chat,
    resolveModel: vi.fn(),
    save: vi.fn(),
  };
});
vi.mock("../logger", () => ({
  createModuleLogger: () => ({ error: mocks.logError }),
}));
vi.mock("../config", () => ({
  config: {
    ai: { tools: { deepResearch: mocks.enabled, documents: mocks.documents } },
  },
}));
vi.mock("../../tools/platform/deep-research/configuration", () => ({
  getDeepResearchConfig: () => ({}),
}));
vi.mock("../../tools/platform/deep-research/pipeline", () => ({
  runDeepResearchPipeline: vi.fn(),
}));
vi.mock("./document-tools", () => ({ executeEveDocumentTool: mocks.save }));
vi.mock("./model-selection", () => ({
  loadEveModelDefinition: vi.fn(),
  resolveEveModel: mocks.resolveModel,
}));
vi.mock("../ai/active-gateway", () => ({
  getActiveGateway: () => ({
    fetchModels: () =>
      Promise.resolve([
        {
          id: mocks.modelId,
          pricing: { input: "0.000001", output: "0.000002" },
        },
      ]),
  }),
}));
vi.mock("../ai/to-model-data", () => ({
  toModelData: (value: unknown) => value,
}));
const context = testToolContext({
  abortSignal: new AbortController().signal,
  callId: "research-call",
  session: {
    auth: {
      current: null,
      initiator: {
        attributes: {},
        authenticator: "test",
        principalId: "owner",
        principalType: "user",
      },
    },
    id: "session",
    turn: { id: "turn", sequence: 1 },
  },
});
const document = {
  date: "2026-09-10",
  documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
  kind: "text",
  revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
  status: "success",
  title: "Report",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled.enabled = true;
  mocks.documents.enabled = true;
  mocks.save.mockResolvedValue(document);
});

it("persists through the owning native call and includes research progress and all nested costs", async () => {
  vi.mocked(runDeepResearchPipeline).mockImplementation(
    async (input, _config, stream, options) => {
      expect(input.messages).toEqual([
        { content: "Research this", role: "user" },
      ]);
      stream.write({
        data: {
          timestamp: 0,
          title: "Researching",
          toolCallId: input.toolCallId,
          type: "started",
        },
        type: "data-researchUpdate",
      });
      options.costAccumulator.addAPICost("search", 5);
      options.costAccumulator.addLLMCost(
        mocks.modelId,
        { inputTokens: 100, outputTokens: 200 },
        "research"
      );
      return {
        data: await options.saveReport({
          content: "# Research",
          title: "Report",
        }),
        type: "report",
      };
    }
  );
  const outputs = await Array.fromAsync(
    executeEveResearch({}, context, [
      { content: "Research this", role: "user" },
    ])
  );
  expect(outputs[0].updates).toHaveLength(1);
  expect(outputs.at(-1)).toMatchObject({
    output: { ...document, format: "report" },
    usage: { costUsd: 0.0505 },
  });
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith(
    "createTextDocument",
    { content: "# Research", fileIds: [], title: "Report" },
    expect.objectContaining({
      callId: context.callId,
      session: context.session,
    })
  );
});

it("returns clarification without creating a document", async () => {
  vi.mocked(runDeepResearchPipeline).mockResolvedValue({
    data: "Which topic?",
    type: "clarifying_question",
  });
  const outputs = await Array.fromAsync(executeEveResearch({}, context, []));
  expect(outputs.at(-1)?.output).toEqual({
    answer: "Which topic?",
    format: "clarifying_questions",
  });
  expect(mocks.save).not.toHaveBeenCalled();
});

it("retains research charges and logs the original report persistence failure", async () => {
  const error = new Error("database unavailable");
  mocks.save.mockRejectedValue(error);
  vi.mocked(runDeepResearchPipeline).mockImplementation(
    async (_input, _config, _stream, options) => {
      options.costAccumulator.addAPICost("search", 5);
      return {
        data: await options.saveReport({ content: "Content", title: "Report" }),
        type: "report",
      };
    }
  );
  const outputs = await Array.fromAsync(executeEveResearch({}, context, []));
  expect(outputs.at(-1)).toMatchObject({
    status: "error",
    usage: { costUsd: 0.05 },
  });
  expect(mocks.logError).toHaveBeenCalledWith(
    expect.objectContaining({ error }),
    "Research report persistence failed"
  );
});

it("rejects disabled research before doing provider or database work", async () => {
  mocks.enabled.enabled = false;
  await expect(executeEveResearch({}, context, []).next()).rejects.toThrow(
    "enabled text documents"
  );
  expect(runDeepResearchPipeline).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("forwards configured reasoning options into the research provider request", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: () => Promise.reject(new Error("provider reached")),
  });
  mocks.resolveModel.mockResolvedValue({
    model,
    modelOptions: { providerOptions: { openai: { reasoningEffort: "high" } } },
  });
  vi.mocked(runDeepResearchPipeline).mockImplementation(
    async (_input, _config, _stream, options) => {
      await expect(
        generateText({
          maxRetries: 0,
          model: await options.getLanguageModel(mocks.modelId),
          prompt: "Research",
        })
      ).rejects.toThrow("provider reached");
      return { data: "Scope?", type: "clarifying_question" };
    }
  );
  await Array.fromAsync(executeEveResearch({}, context, []));
  expect(model.doGenerateCalls[0].providerOptions).toMatchObject({
    openai: { reasoningEffort: "high" },
  });
});

vi.mock("./research-search", () => ({
  createResearchSearchTool: () => {},
}));

it("preserves report authorization failures", async () => {
  const error = new EveSessionMappingError("owner_mismatch");
  mocks.save.mockRejectedValue(error);
  vi.mocked(runDeepResearchPipeline).mockImplementation(
    async (_input, _config, _stream, options) => ({
      data: await options.saveReport({ content: "Content", title: "Report" }),
      type: "report",
    })
  );
  await expect(
    Array.fromAsync(executeEveResearch({}, context, []))
  ).rejects.toBe(error);
  expect(mocks.logError).not.toHaveBeenCalled();
});
