import type {
  AgentMessageResult,
  AgentSendOptions,
  WorkflowToolContext,
} from "eve/tools";
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import type {
  prepareResearch,
  researchCompletedAt,
} from "@/agent/lib/research/steps";
import type { publishResearchReport } from "@/agent/lib/research/delivery";
import { researchOptions } from "@/agent/lib/research/configuration";

import deepResearch from "@/agent/tools/deepResearch";

import { testToolContext } from "../../tests/helpers/eve-tool-context";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn<() => ReturnType<typeof prepareResearch>>(),
  save: vi.fn<typeof researchCompletedAt>(),
  publish: vi.fn<typeof publishResearchReport>(),
  files: new Map<string, string>(),
}));
vi.mock("@/agent/lib/research/workspace", () => ({
  writeResearchFile: async (
    _context: unknown,
    name: string,
    content: string
  ) => {
    mocks.files.set(name, content);
    return await Promise.resolve(`/workspace/research/test/${name}`);
  },
  readResearchFiles: async (_context: unknown, names: readonly string[]) =>
    await Promise.resolve(
      names.map((name) => {
        const content = mocks.files.get(name);
        if (content === undefined) {
          throw new Error(`Missing ${name}`);
        }
        return content;
      })
    ),
}));
vi.mock("@/agent/lib/research/steps", () => ({
  prepareResearch: mocks.prepare,
  researchCompletedAt: mocks.save,
}));
vi.mock("@/agent/lib/research/delivery", () => ({
  publishResearchReport: mocks.publish,
}));
const researchStream = (context: WorkflowToolContext) => {
  const result = deepResearch.execute({ request: "Research this" }, context);
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
const reportOutput = {
  path: "/workspace/research/test/report.md",
  title: "Report",
  format: "report",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.files.clear();
  nativeResult.mockImplementation((data) => ({
    status: "completed",
    data,
    reply: undefined,
    sessionEnded: false,
  }));
  controller = new AbortController();
  context = {
    ...testToolContext({ abortSignal: controller.signal }),
    session: {
      ...testToolContext().session,
      auth: {
        current: null,
        initiator: {
          authenticator: "chatjs-gateway",
          principalId: "owner",
          principalType: "user",
          attributes: {},
        },
      },
    },
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
      ...researchOptions,
      allow_clarification: false,
      max_concurrent_research_units: 2,
      max_researcher_iterations: 2,
      search_api_max_queries: 3,
    },
    date: "Sep 28, 2026",
    messages: "Research this",
    timestamp: 0,
  });
  mocks.save.mockResolvedValue(100);
  mocks.publish.mockResolvedValue(null);
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
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
  ]);
  expect(agent.mock.calls[4][1].message).toContain("First findings");
  expect(agent.mock.calls[7][1].message).toContain("Follow-up findings");
  expect(agent.mock.calls[8][1].message).toContain(
    "# Initial topic\n\nFirst findings\n# Missing evidence\n\nFollow-up findings"
  );
  expect(outputs.at(-1)).toMatchObject({
    output: { ...reportOutput },
    usage: { costUsd: 0 },
  });
  expect(outputs[0].updates).toContainEqual(
    expect.objectContaining({ type: "started" })
  );
  expect(outputs.at(-1)?.updates).toContainEqual(
    expect.objectContaining({ type: "completed", timestamp: 100 })
  );
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(mocks.files.get("brief.md")).toBe("Compare evidence");
  expect(mocks.files.get("topic-1-sources.md")).toContain(
    "https://example.test/one"
  );
  expect(mocks.files.get("topic-2-notes.md")).toContain("Follow-up findings");
  expect(mocks.files.get("report.md")).toBe("# Both findings");
});

it("bounds adaptive decisions even when the supervisor never finishes", async () => {
  agent
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({ complete: false, topics: ["Topic"] })
    .mockResolvedValueOnce({ findings: "Evidence" })
    .mockResolvedValueOnce({ findings: "Evidence" })
    .mockResolvedValueOnce({ complete: false, topics: ["Topic"] })
    .mockResolvedValueOnce({ findings: "Evidence" })
    .mockResolvedValueOnce({ findings: "Evidence" })
    .mockResolvedValueOnce({ complete: false, topics: ["Topic"] })
    .mockResolvedValueOnce({ findings: "Evidence" })
    .mockResolvedValueOnce({ findings: "Evidence" })
    .mockResolvedValueOnce({ content: "Content", title: "Report" });
  await Array.fromAsync(researchStream(context));
  expect(agent.mock.calls.map(([name]: readonly unknown[]) => name)).toEqual([
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
    "agent",
  ]);
  expect(mocks.save).toHaveBeenCalledOnce();
});

it("returns a published artifact in the report without a separate tool call", async () => {
  const artifact = {
    fileId: "stored-file",
    mediaType: "text/plain",
    name: "report.md",
    size: 8,
    url: "/api/files/stored-file",
  };
  mocks.publish.mockResolvedValueOnce(artifact);
  agent
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({ complete: true, topics: [] })
    .mockResolvedValueOnce({ content: "# Report", title: "Report" });

  const outputs = await Array.fromAsync(researchStream(context));

  expect(mocks.publish).toHaveBeenCalledExactlyOnceWith(context, "# Report");
  expect(outputs.at(-1)?.output).toEqual({ ...reportOutput, artifact });
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
  expect(mocks.publish).not.toHaveBeenCalled();
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
  mocks.save.mockRejectedValue(new Error("Completion failed"));
  await expect(Array.fromAsync(researchStream(context))).rejects.toThrow(
    "Completion failed"
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

it("rejects failed or missing-output native child results before saving or starting more work", async () => {
  agent.mockResolvedValue({ research_brief: "Brief", title: "Report" });
  nativeResult.mockReturnValue({
    status: "failed",
    data: undefined,
    reply: undefined,
    sessionEnded: false,
    error: { message: "Model refused the request" },
  });
  await expect(Array.fromAsync(researchStream(context))).rejects.toThrow(
    "Model refused the request"
  );
  expect(agent).toHaveBeenCalledOnce();
  expect(mocks.save).not.toHaveBeenCalled();
  agent.mockClear();
  nativeResult.mockReturnValue({
    status: "completed",
    data: undefined,
    reply: undefined,
    sessionEnded: false,
  });
  await expect(Array.fromAsync(researchStream(context))).rejects.toThrow(
    "without structured output"
  );
  expect(agent).toHaveBeenCalledOnce();
  expect(agent.mock.calls[0][1].signal).toBe(controller.signal);
  expect(mocks.save).not.toHaveBeenCalled();
});

it.each([
  { sessionEnded: false, expectedCalls: 2 },
  { sessionEnded: true, expectedCalls: 1 },
])(
  "reports the failed phase after $expectedCalls child sends",
  async ({ sessionEnded, expectedCalls }) => {
    const message =
      "The agent could not produce a result matching the requested schema.";
    agent.mockResolvedValue({ research_brief: "Brief", title: "Report" });
    nativeResult.mockReturnValue({
      status: "failed",
      data: undefined,
      reply: undefined,
      sessionEnded,
      error: { message },
    });

    await expect(Array.fromAsync(researchStream(context))).rejects.toThrow(
      `Deep Research (research brief): ${message}`
    );
    expect(agent).toHaveBeenCalledTimes(expectedCalls);
    if (!sessionEnded) {
      expect(agent.mock.calls[1][1].outputSchema).toBe(
        agent.mock.calls[0][1].outputSchema
      );
    }
    expect(mocks.publish).not.toHaveBeenCalled();
  }
);
