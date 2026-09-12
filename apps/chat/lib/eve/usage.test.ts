import type { MessageStreamEvent } from "eve/client";
import { beforeEach, expect, it, vi } from "vitest";
import { ingestEveUsage } from "./usage";

const record = vi.hoisted(() => vi.fn());
vi.mock("../db/eve-billing", () => ({ recordEveUsage: record }));
beforeEach(() => record.mockReset());
it("records each auxiliary model attempt with replay-stable independent identities", async () => {
  record.mockResolvedValue(true);
  const event: MessageStreamEvent = {
    type: "hook.result",
    meta: { id: "hook-event", at: "2026-09-12T00:00:00Z" },
    data: {
      hookId: "followup-suggestions",
      turnId: "turn_0",
      modelCalls: [
        { modelId: "model", usage: { costUsd: 0.001 } },
        { modelId: "model", usage: { costUsd: 0.002 } },
      ],
    },
  };
  expect(await ingestEveUsage("owner", "session", event)).toBe(true);
  expect(
    record.mock.calls.map(([call]) => [call.eventId, call.costUsd])
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
    type: "hook.result",
    meta: { id: "hook-event", at: "2026-09-12T00:00:00Z" },
    data: {
      hookId: "followup-suggestions",
      turnId: "turn_0",
      modelCalls: [{ modelId: "model" }],
    },
  };
  expect(await ingestEveUsage("owner", "session", event)).toBe(false);
  expect(
    await ingestEveUsage("owner", "session", {
      ...event,
      data: { ...event.data, modelCalls: [{ modelId: "model", failed: true }] },
    })
  ).toBe(true);
  expect(record).toHaveBeenCalledTimes(2);
});
