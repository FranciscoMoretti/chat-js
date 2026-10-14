import type { MessageStreamEvent } from "eve/client";
import { beforeEach, expect, it, vi } from "vitest";
import type { recordEveUsage } from "../db/eve-billing";

import { ingestEveUsage } from "./usage";

const record = vi.hoisted(() => vi.fn<typeof recordEveUsage>());
vi.mock("../db/eve-subagents", () => ({ registerEveSubagent: vi.fn() }));
vi.mock("../db/eve-billing", () => ({ recordEveUsage: record }));
beforeEach(() => record.mockReset());
it.each([
  "hook.result",
  "step.completed",
  "step.failed",
  "compaction.usage",
] as const)("never charges model event %s through replay", async (type) => {
  await expect(
    ingestEveUsage("owner", "session", {
      type,
      meta: { id: "event", at: "2026-10-13T00:00:00Z" },
      data: { usage: { costUsd: 4 } },
    })
  ).resolves.toBe(true);
  expect(record).not.toHaveBeenCalled();
});
const toolEvent = (
  output: unknown,
  id = "event-one",
  status: Extract<
    MessageStreamEvent,
    { type: "action.result" }
  >["data"]["status"] = "completed"
): Parameters<typeof ingestEveUsage>[2] & {
  data: { result: { toolName: string } };
} => ({
  data: {
    result: {
      callId: "call-external",
      kind: "tool-result",
      output,
      toolName: "externalPaidTool",
    },
    status,
    turnId: "turn_1",
  },
  meta: { at: "2026-09-27T00:00:00Z", id },
  type: "action.result",
});

it("ingests receipts from arbitrary installed names with the same ledger identity after replay", async () => {
  const { executeWithToolUsage } = await import("./tool-usage");
  const output = await executeWithToolUsage(
    { abortSignal: new AbortController().signal },
    (usage) => {
      usage.addCostUsd(0.02);
      return { answer: "paid result" };
    }
  );
  record.mockResolvedValue(true);
  await ingestEveUsage("owner", "session", toolEvent(output));
  await ingestEveUsage("owner", "session", toolEvent(output, "replayed-event"));
  expect(record).toHaveBeenCalledTimes(2);
  expect(record.mock.calls[0]).toEqual(record.mock.calls[1]);
  expect(record.mock.calls[0][0]).toEqual({
    costUsd: 0.02,
    eventId: "eve-tool:session:call-external",
    ownerId: "owner",
    sessionId: "session",
    turnId: "turn_1",
  });
  await ingestEveUsage(
    "owner",
    "session",
    toolEvent(output, "rejected-event", "rejected")
  );
  expect(record.mock.calls[2][0]).toEqual({
    costUsd: 0,
    eventId: "eve-tool:session:call-external",
    ownerId: "owner",
    sessionId: "session",
    turnId: "turn_1",
  });
});

it("requires reconciliation for unpriced tool executions", async () => {
  const { executeWithToolUsage } = await import("./tool-usage");
  const output = await executeWithToolUsage(
    { abortSignal: new AbortController().signal },
    () => ({ answer: "unpriced result" })
  );
  record.mockResolvedValue(false);
  expect(await ingestEveUsage("owner", "session", toolEvent(output))).toBe(
    false
  );
  expect(record).toHaveBeenCalledExactlyOnceWith({
    costUsd: undefined,
    eventId: "eve-tool:session:call-external",
    ownerId: "owner",
    sessionId: "session",
    turnId: "turn_1",
  });
});

it.each([{}, { costUsd: -1 }])(
  "retains unpriced and malformed external receipt %j for reconciliation",
  async (usage) => {
    record.mockResolvedValue(false);
    const output = {
      kind: "chatjs.tool-result",
      output: {},
      status: "success",
      usage,
      version: 1,
    };
    // A malformed receipt must not bypass accounting because its name is new.
    const priced = await ingestEveUsage("owner", "session", toolEvent(output));
    expect(priced).toBe(false);
    expect(record).toHaveBeenCalledTimes(1);
    expect(
      record.mock.calls.map(
        ([value]: Readonly<(typeof record.mock.calls)[number]>) => value.costUsd
      )
    ).toEqual([undefined]);
  }
);

it("does not infer billing from ordinary tool output", async () => {
  await ingestEveUsage(
    "owner",
    "session",
    toolEvent({ answer: "ordinary data", costUsd: 5 })
  );
  expect(record).not.toHaveBeenCalled();
});
it("attributes independent child tool receipts to the root turn", async () => {
  const attribution = { sessionId: "root", turnId: "turn_7" };
  await ingestEveUsage(
    "owner",
    "child",
    toolEvent({
      version: 1,
      kind: "chatjs.tool-result",
      status: "success",
      output: "ok",
      usage: { costUsd: 0.03 },
    }),
    attribution
  );
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      sessionId: "root",
      turnId: "turn_7",
      costUsd: 0.03,
    })
  );
});

it("permits cursor advancement for events without a billable tool receipt", async () => {
  expect(
    await ingestEveUsage(
      "owner",
      "session",
      toolEvent({ answer: "ordinary output" })
    )
  ).toBe(true);
  expect(
    await ingestEveUsage("owner", "session", {
      type: "session.completed",
      meta: { at: "2026-10-13T00:00:00Z", id: "completion" },
    })
  ).toBe(true);
  expect(record).not.toHaveBeenCalled();
});
