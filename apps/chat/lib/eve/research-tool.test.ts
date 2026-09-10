import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { beforeEach, expect, it, vi } from "vitest";
import { runDeepResearchPipeline } from "../../tools/platform/deep-research/pipeline";
import { executeEveResearch } from "./research-tool";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  resolveModel: vi.fn(),
  enabled: { enabled: true },
  documents: { enabled: true, types: { text: true } },
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
          id: "openai/gpt-4.1",
          pricing: { input: "0.000001", output: "0.000002" },
        },
      ]),
  }),
}));
vi.mock("../ai/to-model-data", () => ({
  toModelData: (value: unknown) => value,
}));
const context = {
  callId: "research-call",
  abortSignal: new AbortController().signal,
  session: {
    id: "session",
    auth: {
      current: null,
      initiator: {
        principalId: "owner",
        principalType: "user",
        authenticator: "test",
        attributes: {},
      },
    },
    turn: { id: "turn", sequence: 1 },
  },
};
const document = {
  status: "success",
  documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
  revisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
  title: "Report",
  kind: "text",
  date: "2026-09-10",
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
        { role: "user", content: "Research this" },
      ]);
      stream.write({
        type: "data-researchUpdate",
        data: {
          toolCallId: input.toolCallId,
          type: "started",
          timestamp: 0,
          title: "Researching",
        },
      });
      options.costAccumulator.addAPICost("search", 5);
      options.costAccumulator.addLLMCost(
        "openai/gpt-4.1",
        { inputTokens: 100, outputTokens: 200 },
        "research"
      );
      return {
        type: "report",
        data: await options.saveReport({
          title: "Report",
          content: "# Research",
        }),
      };
    }
  );
  const outputs = await Array.fromAsync(
    executeEveResearch({}, context, [
      { role: "user", content: "Research this" },
    ])
  );
  expect(outputs[0].updates).toHaveLength(1);
  expect(outputs.at(-1)).toMatchObject({
    output: { ...document, format: "report" },
    usage: { costUsd: 0.0505 },
  });
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith(
    "createTextDocument",
    { title: "Report", content: "# Research" },
    expect.objectContaining({
      session: context.session,
      callId: context.callId,
    })
  );
});

it("returns clarification without creating a document", async () => {
  vi.mocked(runDeepResearchPipeline).mockResolvedValue({
    type: "clarifying_question",
    data: "Which topic?",
  });
  const outputs = await Array.fromAsync(executeEveResearch({}, context, []));
  expect(outputs.at(-1)?.output).toEqual({
    format: "clarifying_questions",
    answer: "Which topic?",
  });
  expect(mocks.save).not.toHaveBeenCalled();
});

it("retains incurred cost if saving the report fails", async () => {
  mocks.save.mockRejectedValue(new Error("database unavailable"));
  vi.mocked(runDeepResearchPipeline).mockImplementation(
    async (_input, _config, _stream, options) => {
      options.costAccumulator.addAPICost("search", 5);
      return {
        type: "report",
        data: await options.saveReport({ title: "Report", content: "Content" }),
      };
    }
  );
  const outputs = await Array.fromAsync(executeEveResearch({}, context, []));
  expect(outputs.at(-1)).toMatchObject({
    output: { error: expect.any(String) },
    usage: { costUsd: 0.05 },
  });
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
          model: await options.getLanguageModel("openai/gpt-4.1"),
          prompt: "Research",
          maxRetries: 0,
        })
      ).rejects.toThrow("provider reached");
      return { type: "clarifying_question", data: "Scope?" };
    }
  );
  await Array.fromAsync(executeEveResearch({}, context, []));
  expect(model.doGenerateCalls[0].providerOptions).toMatchObject({
    openai: { reasoningEffort: "high" },
  });
});
