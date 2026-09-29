import type { WorkflowToolContext } from "eve/tools";
import { beforeEach, expect, it, vi } from "vitest";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import { executeEveResearch } from "./research-tool";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  save: vi.fn(),
  searches: vi.fn(),
}));
vi.mock("./research-search-updates", () => ({
  researchSearchUpdates: mocks.searches,
}));
vi.mock("./research-steps", () => ({
  prepareResearch: mocks.prepare,
  researchCompletionTime: () => Promise.resolve(100),
  saveResearchReport: mocks.save,
}));
const agent = vi.fn();
let controller: AbortController;
let context: WorkflowToolContext;
const document = {
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
  controller = new AbortController();
  context = {
    ...testToolContext({ abortSignal: controller.signal }),
    agent,
    agents: {},
    ask: vi.fn(),
  };
  mocks.prepare.mockResolvedValue({
    config: {
      allow_clarification: false,
      max_concurrent_research_units: 2,
      max_researcher_iterations: 2,
      search_api_max_queries: 3,
    },
    date: "Sep 28, 2026",
    messages: "Research this",
    timestamp: 0,
  });
  mocks.save.mockResolvedValue(document);
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
  const outputs = await Array.fromAsync(executeEveResearch({}, context));
  expect(agent.mock.calls.map(([name]) => name)).toEqual([
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
    expect.objectContaining({ type: "completed" })
  );
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith(context, {
    content: "# Both findings",
    title: "Report",
  });
});

it("bounds adaptive decisions even when the supervisor never finishes", async () => {
  agent.mockImplementation((name: string) => {
    if (name === "researchPlanner") {
      return Promise.resolve(
        agent.mock.calls.length === 1
          ? { research_brief: "Brief", title: "Report" }
          : { complete: false, topics: ["Topic"] }
      );
    }
    return Promise.resolve(
      name === "researchWriter"
        ? { content: "Content", title: "Report" }
        : { findings: "Evidence" }
    );
  });
  await Array.fromAsync(executeEveResearch({}, context));
  expect(
    agent.mock.calls.filter(([name]) => name === "researchPlanner")
  ).toHaveLength(4);
  expect(
    agent.mock.calls.filter(([name]) => name === "researcher")
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
  const outputs = await Array.fromAsync(executeEveResearch({}, context));
  expect(outputs).toHaveLength(1);
  expect(outputs[0].output).toEqual({
    answer: "Which scope?",
    format: "clarifying_questions",
  });
  expect(agent).toHaveBeenCalledOnce();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("runs topics sequentially and stops before new work or saving after cancellation", async () => {
  agent
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({ complete: false, topics: ["First", "Second"] })
    .mockImplementationOnce(() => {
      controller.abort(new Error("Cancelled"));
      return Promise.reject(controller.signal.reason);
    });
  await expect(
    Array.fromAsync(executeEveResearch({}, context))
  ).rejects.toThrow("Cancelled");
  expect(agent).toHaveBeenCalledTimes(3);
  expect(mocks.save).not.toHaveBeenCalled();
});

it("validates native outputs and propagates failures without a successful report receipt", async () => {
  agent.mockResolvedValue({ research_brief: 12, title: "Report" });
  await expect(
    Array.fromAsync(executeEveResearch({}, context))
  ).rejects.toThrow();
  expect(mocks.save).not.toHaveBeenCalled();
  agent
    .mockReset()
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({ complete: true, topics: [] })
    .mockResolvedValueOnce({ content: "Content", title: "Report" });
  mocks.save.mockRejectedValue(new Error("Storage unavailable"));
  await expect(
    Array.fromAsync(executeEveResearch({}, context))
  ).rejects.toThrow("Storage unavailable");
});

it("rejects oversized topic batches before starting researchers", async () => {
  agent
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({
      complete: false,
      topics: ["First", "Second", "Third"],
    });
  await expect(
    Array.fromAsync(executeEveResearch({}, context))
  ).rejects.toThrow();
  expect(agent).toHaveBeenCalledTimes(2);
  expect(agent.mock.calls[1][1].outputSchema.properties.topics.maxItems).toBe(
    2
  );
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
  const outputs: { updates?: unknown[] }[] = [];
  const consume = async () => {
    for await (const output of executeEveResearch({}, context)) {
      outputs.push(output);
    }
  };
  await expect(consume()).rejects.toBe(error);
  expect(outputs.at(-1)?.updates).toContainEqual(search);
  expect(mocks.save).not.toHaveBeenCalled();
});
