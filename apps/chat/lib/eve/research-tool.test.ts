/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tests/helpers/eve-tool-context" dependency within this package instead of introducing an alias or barrel API.
 */
import type { WorkflowToolContext } from "eve/tools";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { beforeEach, expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import { executeEveResearch } from "@/tools/chatjs/deep-research/workflow";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
/* oxlint-enable import/no-relative-parent-imports */

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  save: vi.fn(),
  searches: vi.fn(),
}));
vi.mock("@/tools/chatjs/deep-research/search-updates", () => ({
  researchSearchUpdates: mocks.searches,
}));
/* oxlint-disable no-magic-numbers, typescript/promise-function-async --
 * no-magic-numbers (#517): vi.mock("@/tools/chatjs/deep-research/steps") uses 100 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): vi.mock("@/tools/chatjs/deep-research/steps") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("@/tools/chatjs/deep-research/steps", () => ({
  prepareResearch: mocks.prepare,
  researchCompletionTime: (): Promise<number> => Promise.resolve(100),
  saveResearchReport: mocks.save,
}));
/* oxlint-enable no-magic-numbers, typescript/promise-function-async */
const agent = vi.fn();
/* oxlint-disable init-declarations --
 * init-declarations (#507): controller assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let controller: AbortController;
/* oxlint-enable init-declarations */
/* oxlint-disable init-declarations --
 * init-declarations (#507): context assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let context: WorkflowToolContext;
/* oxlint-enable init-declarations */
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing testToolContext({ abortSignal: controller.signal }) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("lets the supervisor request follow-up after receiving findings and synthesizes al uses 4, 1, 7, 8, -1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("lets the supervisor request follow-up after receiving findings and synthesizes al accepts [name]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
  // oxlint-disable-next-line typescript/no-unsafe-return -- #598: This research-tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
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
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This research-tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(agent.mock.calls[4][1].message).toContain("First findings");
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This research-tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(agent.mock.calls[7][1].message).toContain("Follow-up findings");
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This research-tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(agent.mock.calls[8][1].message).toContain(
    "First findings\nFollow-up findings"
  );
  expect(outputs.at(-1)).toMatchObject({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing document own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): it("bounds adaptive decisions even when the supervisor never finishes") uses 1, 4, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("bounds adaptive decisions even when the supervisor never finishes") accepts [name]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): it("bounds adaptive decisions even when the supervisor never finishes") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("returns clarification without starting research or saving a document") uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("returns clarification without starting research or saving a document", async () => {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This research-tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  const prepared = await mocks.prepare();
  mocks.prepare.mockResolvedValue({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing prepared own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...prepared,
    // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, oxc/no-rest-spread-properties -- #595: This research-tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This research-tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. Rest/spread: Keep the existing prepared.config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/promise-function-async --
 * no-magic-numbers (#517): it("runs topics sequentially and stops before new work or saving after cancellation") uses 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): it("runs topics sequentially and stops before new work or saving after cancellation") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("runs topics sequentially and stops before new work or saving after cancellation", async () => {
  agent
    .mockResolvedValueOnce({ research_brief: "Brief", title: "Report" })
    .mockResolvedValueOnce({ complete: false, topics: ["First", "Second"] })
    .mockImplementationOnce(() => {
      controller.abort(new Error("Cancelled"));
      // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- #603: AbortSignal.reason is typed as any; forward the controller’s Error unchanged to verify cancellation stops further topics and saving.
      return Promise.reject(controller.signal.reason);
    });
  await expect(
    Array.fromAsync(executeEveResearch({}, context))
  ).rejects.toThrow("Cancelled");
  expect(agent).toHaveBeenCalledTimes(3);
  expect(mocks.save).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/promise-function-async */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("rejects oversized topic batches before starting researchers") uses 2, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This research-tool fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(agent.mock.calls[1][1].outputSchema.properties.topics.maxItems).toBe(
    2
  );
  expect(mocks.save).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("publishes completed searches when a researcher fails without masking the failure" uses -1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  const consume = async (): Promise<void> => {
    for await (const output of executeEveResearch({}, context)) {
      outputs.push(output);
    }
  };
  await expect(consume()).rejects.toBe(error);
  expect(outputs.at(-1)?.updates).toContainEqual(search);
  expect(mocks.save).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
