/* oxlint-disable unicorn/prefer-structured-clone -- Exercise persisted JSON wire data, including omitted undefined values. */
import type { MessageStreamEvent } from "eve/client";
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";

import { ingestEveUsage } from "./usage";

const record = vi.hoisted(() => vi.fn());
vi.mock("../db/eve-subagents", () => ({ registerEveSubagent: vi.fn() }));
vi.mock("../db/eve-billing", () => ({ recordEveUsage: record }));
beforeEach(() => record.mockReset());
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("records each auxiliary model attempt with replay-stable independent identities") uses 0.001, 0.002, 2, 0, 3, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("records each auxiliary model attempt with replay-stable independent identities") accepts [call]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
    // oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-member-access -- #598: This usage fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This usage fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    record.mock.calls.map(([call]) => [call.eventId, call.costUsd])
  ).toEqual([
    ["hook-event:model-call:0", 0.001],
    ["hook-event:model-call:1", 0.002],
  ]);
  await ingestEveUsage("owner", "session", event);
  expect(record.mock.calls[2]).toEqual(record.mock.calls[0]);
  expect(record.mock.calls[3]).toEqual(record.mock.calls[1]);
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("requires reconciliation for unpriced completed calls and preserves failed-attempt uses 2, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This usage fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(record.mock.calls[1][0].costUsd).toBe(0);
});
/* oxlint-enable no-magic-numbers */

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

const toolEvent = (output: unknown, id = "event-one"): MessageStreamEvent => ({
  data: {
    result: {
      callId: "call-external",
      kind: "tool-result",
      output: z.json().parse(JSON.parse(JSON.stringify(output))),
      toolName: "externalPaidTool",
    },
    sequence: 1,
    status: "completed",
    stepIndex: 0,
    turnId: "turn_1",
  },
  meta: { at: "2026-09-27T00:00:00Z", id },
  type: "action.result",
});

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * no-magic-numbers (#517): it("ingests receipts from arbitrary installed names with the same ledger identity aft uses 0.02, 2, 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("ingests receipts from arbitrary installed names with the same ledger identity aft accepts usage; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): it("ingests receipts from arbitrary installed names with the same ledger identity aft keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
  await ingestEveUsage(
    "owner",
    "session",
    toolEvent(JSON.parse(JSON.stringify(output)), "replayed-event")
  );
  expect(record).toHaveBeenCalledTimes(2);
  expect(record.mock.calls[0]).toEqual(record.mock.calls[1]);
  expect(record.mock.calls[0][0]).toEqual({
    costUsd: 0.02,
    eventId: "eve-tool:session:call-external",
    ownerId: "owner",
    sessionId: "session",
    turnId: "turn_1",
  });
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */

/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types --
 * no-undefined (#519): it("retains unpriced and malformed external receipts for reconciliation") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): it("retains unpriced and malformed external receipts for reconciliation") accepts [value]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("retains unpriced and malformed external receipts for reconciliation", async () => {
  record.mockResolvedValue(false);
  for (const usage of [{}, { costUsd: -1 }]) {
    const output = {
      kind: "chatjs.tool-result",
      output: {},
      status: "success",
      usage,
      version: 1,
    };
    // A malformed receipt must not bypass accounting because its name is new.
    // oxlint-disable-next-line eslint/no-await-in-loop -- Assert each reconciliation result before processing the next receipt.
    const priced = await ingestEveUsage("owner", "session", toolEvent(output));
    expect(priced).toBe(false);
  }
  // oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-member-access -- #598: This usage fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This usage fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(record.mock.calls.map(([value]) => value.costUsd)).toEqual([
    undefined,
    undefined,
  ]);
});
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types */

it("does not infer billing from ordinary tool output", async () => {
  await ingestEveUsage(
    "owner",
    "session",
    toolEvent({ answer: "ordinary data", costUsd: 5 })
  );
  expect(record).not.toHaveBeenCalled();
});

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("attributes child model events to the root turn without billing delegation summari uses 0, 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable no-magic-numbers */
