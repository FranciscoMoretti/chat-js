import type {
  AgentMessageResult,
  AgentSendOptions,
  WorkflowToolContext,
} from "eve/tools";
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import type {
  prepareResearch,
  saveResearchReport,
} from "@/tools/chatjs/deep-research/steps";
import { getDeepResearchConfig } from "@/tools/chatjs/deep-research/configuration";

import deepResearch from "@/agent/tools/deepResearch";

import { testToolContext } from "../../tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn<() => ReturnType<typeof prepareResearch>>(),
  save: vi.fn<typeof saveResearchReport>(),
  searches: vi.fn(),
}));
vi.mock("@/tools/chatjs/deep-research/search-updates", () => ({
  researchSearchUpdates: mocks.searches,
}));
vi.mock("@/tools/chatjs/deep-research/steps", () => ({
  prepareResearch: mocks.prepare,
  saveResearchReport: mocks.save,
}));
const researchStream = (context: WorkflowToolContext) => {
  const result = deepResearch.execute({}, context);
  if (!(Symbol.asyncIterator in result)) {
    throw new Error("Research must stream progress through an async iterable.");
  }
  return result;
};
const agent =
  vi.fn<
    (
      name: string,
      options: { message: string; outputSchema?: unknown; signal?: AbortSignal }
    ) => Promise<unknown>
  >();
const nativeResult = vi.fn<(data: unknown) => AgentMessageResult>();
let controller: AbortController;
let context: WorkflowToolContext;
const document: Awaited<ReturnType<typeof saveResearchReport>>["document"] = {
  date: "2026-09-28",
  documentId: "doc",
  kind: "text",
  result: "Saved",
  revisionId: "revision",
  status: "success",
  title: "Report",
};
beforeEach(() => {
  vi.resetAllMocks();
  nativeResult.mockImplementation((data) => ({
    status: "waiting",
    data,
    message: undefined,
  }));
  controller = new AbortController();
  context = {
    ...testToolContext({ abortSignal: controller.signal }),
    agent: (name) => ({
      send: vi
        .fn()
        // oxlint-disable-next-line typescript/promise-function-async -- The native send fixture returns a response before result() awaits the independently controlled child turn.
        .mockImplementation((message: string, options?: AgentSendOptions) =>
          Promise.resolve({
            result: async () =>
              nativeResult(await agent(name, { message, ...options })),
          })
        ),
    }),
    agents: {},
    ask: vi.fn(),
  };
  mocks.prepare.mockResolvedValue({
    config: {
      ...getDeepResearchConfig(),
      allow_clarification: false,
      max_concurrent_research_units: 2,
      max_researcher_iterations: 2,
      search_api_max_queries: 3,
    },
    date: "Sep 28, 2026",
    messages: "Research this",
    timestamp: 0,
  });
  mocks.save.mockResolvedValue({ document, completedAt: 100 });
  mocks.searches.mockResolvedValue([]);
});

it("lets the supervisor request follow-up after receiving findings and synthesizes all rounds", async () => {
  agent
    .mockResolvedValueOnce({
      research_brief: "Compare evidence",
      title: "Report",
    })
    .mockResolvedValueOnce({ complete: false, topics: ["Initial topic"] })
    .mockResolvedValueOnce({ findings: "Raw source https://example.test/one" })
    .mockResolvedValueOnce({ findings: "First findings" })
    .mockResolvedValueOnce({ complete: false, topics: ["Missing evidence"] })
    .mockResolvedValueOnce({ findings: "Additional sources" })
    .mockResolvedValueOnce({ findings: "Follow-up findings" })
    .mockResolvedValueOnce({ complete: true, topics: [] })
    .mockResolvedValueOnce({ content: "# Both findings", title: "Report" });
  const outputs = await Array.fromAsync(researchStream(context));

  expect(agent.mock.calls.map(([name]: readonly unknown[]) => name)).toEqual([
    "researchPlanner",
    "researchPlanner",
    "researcher",
    "researchCompressor",
    "researchPlanner",
    "researcher",
    "researchCompressor",
    "researchPlanner",
    "researchWriter",
  ]);
  expect(agent.mock.calls[4][1].message).toContain("First findings");
  expect(agent.mock.calls[7][1].message).toContain("Follow-up findings");
  expect(agent.mock.calls[8][1].message).toContain(
    "First findings\nFollow-up findings"
  );
  expect(outputs.at(-1)).toMatchObject({
    output: { ...document, format: "report" },
    usage: { costUsd: 0 },
  });
  expect(outputs[0].updates).toContainEqual(
    expect.objectContaining({ type: "started" })
  );
  expect(outputs.at(-1)?.updates).toContainEqual(
    expect.objectContaining({ type: "completed", timestamp: 100 })
  );
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith(context, {
    content: "# Both findings",
    title: "Report",
  });
});

it("bounds adaptive decisions even when the supervisor never finishes", async () => {
  agent.mockImplementation(
    // oxlint-disable-next-line typescript/promise-function-async -- This Promise-only agent fixture keeps supervisor decisions unfinished while returning valid writer/researcher outputs; a constant result loses role validation, and eslint/require-await rejects an immediate async factory.
    (name: string): ReturnType<typeof agent> => {
      if (name === "researchPlanner") {
        return Promise.resolve<Awaited<ReturnType<typeof agent>>>(
          agent.mock.calls.length === 1
            ? { research_brief: "Brief", title: "Report" }
            : { complete: false, topics: ["Topic"] }
        );
      }
      return Promise.resolve<Awaited<ReturnType<typeof agent>>>(
        name === "researchWriter"
          ? { content: "Content", title: "Report" }
          : { findings: "Evidence" }
      );
    }
  );
  await Array.fromAsync(researchStream(context));
  expect(
    agent.mock.calls.filter(
      ([name]: Readonly<(typeof agent.mock.calls)[number]>) =>
        name === "researchPlanner"
    )
  ).toHaveLength(4);
  expect(
    agent.mock.calls.filter(
      ([name]: Readonly<(typeof agent.mock.calls)[number]>) =>
        name === "researcher"
    )
  ).toHaveLength(3);
  expect(mocks.save).toHaveBeenCalledOnce();
});

it("returns clarification without starting research or saving a document", async () => {
  const prepared = await mocks.prepare();
  mocks.prepare.mockResolvedValue({
    ...prepared,
    config: { ...prepared.config, allow_clarification: true },
  });
  agent.mockResolvedValue({
    need_clarification: true,
    question: "Which scope?",
    verification: "",
  });
  const outputs = await Array.fromAsync(researchStream(context));
  expect(outputs).toHaveLength(1);
  expect(outputs[0].output).toEqual({
    answer: "Which scope?",
    format: "clarifying_questions",
  });
  expect(agent).toHaveBeenCalledOnce();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("runs topics sequentially and stops before new work or saving after cancellation", async () => {
  const cancellation = new Error("Cancelled");
  const research = Promise.withResolvers<Awaited<ReturnType<typeof agent>>>();
  agent
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({ complete: false, topics: ["First", "Second"] })
    .mockReturnValueOnce(research.promise);
  const outputs = Array.fromAsync(researchStream(context));
  await vi.waitFor(() => {
    expect(agent).toHaveBeenCalledTimes(3);
  });
  controller.abort(cancellation);
  const rejected = expect(outputs).rejects.toBe(cancellation);
  research.reject(cancellation);
  await rejected;
  expect(agent).toHaveBeenCalledTimes(3);
  expect(mocks.save).not.toHaveBeenCalled();
});

it("validates native outputs and propagates failures without a successful report receipt", async () => {
  agent.mockResolvedValue({ research_brief: 12, title: "Report" });
  await expect(Array.fromAsync(researchStream(context))).rejects.toThrow();
  expect(mocks.save).not.toHaveBeenCalled();
  agent
    .mockReset()
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({ complete: true, topics: [] })
    .mockResolvedValueOnce({ content: "Content", title: "Report" });
  mocks.save.mockRejectedValue(new Error("Storage unavailable"));
  await expect(Array.fromAsync(researchStream(context))).rejects.toThrow(
    "Storage unavailable"
  );
});
it("rejects oversized topic batches before starting researchers", async () => {
  agent
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({
      complete: false,
      topics: ["First", "Second", "Third"],
    });
  await expect(Array.fromAsync(researchStream(context))).rejects.toThrow();
  expect(agent).toHaveBeenCalledTimes(2);
  expect(
    z
      .object({
        properties: z.object({ topics: z.object({ maxItems: z.number() }) }),
      })
      .parse(agent.mock.calls[1][1].outputSchema).properties.topics.maxItems
  ).toBe(2);
  expect(mocks.save).not.toHaveBeenCalled();
});

it("publishes completed searches when a researcher fails without masking the failure", async () => {
  const error = new Error("Research provider failed");
  const search = {
    queries: ["evidence"],
    status: "completed",
    title: "Search",
    toolCallId: "search",
    type: "web",
  };
  agent
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({ complete: false, topics: ["Topic"] })
    .mockRejectedValueOnce(error);
  mocks.searches.mockResolvedValue([search]);
  const outputs: { updates?: readonly unknown[] }[] = [];
  const consume = async (): Promise<void> => {
    for await (const output of researchStream(context)) {
      outputs.push(output);
    }
  };
  await expect(consume()).rejects.toBe(error);
  expect(outputs.at(-1)?.updates).toContainEqual(search);
  expect(mocks.save).not.toHaveBeenCalled();
});

it("rejects failed or cancelled native child turns before saving or starting more work", async () => {
  agent.mockResolvedValue({ research_brief: "Brief", title: "Report" });
  nativeResult.mockReturnValue({
    status: "failed",
    data: undefined,
    message: undefined,
    error: { message: "Child failed" },
  });
  await expect(Array.fromAsync(researchStream(context))).rejects.toThrow(
    "Child failed"
  );
  expect(agent).toHaveBeenCalledOnce();
  expect(mocks.save).not.toHaveBeenCalled();
  agent.mockClear();
  nativeResult.mockReturnValue({
    status: "waiting",
    data: undefined,
    message: undefined,
  });
  await expect(Array.fromAsync(researchStream(context))).rejects.toThrow(
    "without structured output"
  );
  expect(agent).toHaveBeenCalledOnce();
  expect(agent.mock.calls[0][1].signal).toBe(controller.signal);
  expect(mocks.save).not.toHaveBeenCalled();
});
