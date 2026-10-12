import type { MessageStreamEvent } from "eve/client";
import { beforeEach, expect, it, vi } from "vitest";
import type { recordEveUsage } from "../db/eve-billing";

import { ingestEveUsage } from "./usage";

const record = vi.hoisted(() => vi.fn<typeof recordEveUsage>());
vi.mock("../db/eve-subagents", () => ({ registerEveSubagent: vi.fn() }));
vi.mock("../db/eve-billing", () => ({ recordEveUsage: record }));
beforeEach(() => record.mockReset());
it("records each auxiliary model attempt with replay-stable independent identities", async () => {
  record.mockResolvedValue(true);
  const event: MessageStreamEvent = {
    data: {
      hookId: "followup-suggestions",
      modelCalls: [
        { modelId: "model", usage: { costUsd: 0.001 } },
        { modelId: "model", usage: { costUsd: 0.002 } },
      ],
      turnId: "turn_0",
    },
    meta: { at: "2026-09-12T00:00:00Z", id: "hook-event" },
    type: "hook.result",
  };
  expect(await ingestEveUsage("owner", "session", event)).toBe(true);
  expect(
    record.mock.calls.map(
      ([call]: Readonly<(typeof record.mock.calls)[number]>) => [
        call.eventId,
        call.costUsd,
      ]
    )
  ).toEqual([
    ["hook-event:model-call:0", 0.001],
    ["hook-event:model-call:1", 0.002],
  ]);
  await ingestEveUsage("owner", "session", event);
  expect(record.mock.calls[2]).toEqual(record.mock.calls[0]);
  expect(record.mock.calls[3]).toEqual(record.mock.calls[1]);
});
it("requires reconciliation for unpriced completed calls and preserves failed-attempt evidence", async () => {
  record.mockResolvedValue(false);
  const event: MessageStreamEvent = {
    data: {
      hookId: "followup-suggestions",
      modelCalls: [{ modelId: "model" }],
      turnId: "turn_0",
    },
    meta: { at: "2026-09-12T00:00:00Z", id: "hook-event" },
    type: "hook.result",
  };
  expect(await ingestEveUsage("owner", "session", event)).toBe(false);
  expect(
    await ingestEveUsage("owner", "session", {
      ...event,
      data: { ...event.data, modelCalls: [{ failed: true, modelId: "model" }] },
    })
  ).toBe(true);
  expect(record).toHaveBeenCalledTimes(2);
  expect(record.mock.calls[1][0].costUsd).toBe(0);
});

it("retains failed-step evidence without reporting an unpriced completed call", async () => {
  record.mockResolvedValue(false);
  const event = {
    data: {
      code: "boundary_hook_failed",
      message: "Binding unavailable",
      sequence: 0,
      stepIndex: 0,
      turnId: "turn_0",
    },
    meta: { at: "2026-09-21T00:00:00Z", id: "failed-before-model" },
    type: "step.failed",
  } satisfies MessageStreamEvent;
  expect(await ingestEveUsage("owner", "session", event)).toBeUndefined();
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      costUsd: 0,
      eventId: "failed-before-model",
    })
  );
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
it("attributes child model events to the root turn without billing delegation summaries", async () => {
  const attribution = { sessionId: "root", turnId: "turn_7" };
  const event: MessageStreamEvent = {
    data: {
      hookId: "aux",
      modelCalls: [{ modelId: "model", usage: { costUsd: 0.03 } }],
      turnId: "turn_0",
    },
    meta: { at: "2026-09-28T00:00:00Z", id: "event" },
    type: "hook.result",
  };
  await ingestEveUsage("owner", "child", event, attribution);
  await ingestEveUsage("owner", "child", event, attribution);
  expect(record.mock.calls[0][0]).toMatchObject({
    costUsd: 0.03,
    eventId: "eve-child:child:event:model-call:0",
    sessionId: "root",
    turnId: "turn_7",
  });
  expect(record.mock.calls[1]).toEqual(record.mock.calls[0]);
  await ingestEveUsage("owner", "root", {
    data: {
      callId: "delegation",
      output: "Finished",
      subagentName: "researcher",
    },
    meta: event.meta,
    type: "subagent.completed",
  });
  expect(record).toHaveBeenCalledTimes(2);
});
