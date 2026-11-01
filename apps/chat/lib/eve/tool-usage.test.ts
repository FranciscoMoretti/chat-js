import {
  createRuntimeToolResultFromToolError,
  createToolResultMessagePartFromToolError,
} from "@eve-test/dist/src/harness/action-result-helpers.js";
import { expect, test, vi } from "vitest";

import {
  createToolUsage,
  executeWithToolProgress,
  executeWithToolUsage,
} from "./tool-usage";

const context = () => ({ abortSignal: new AbortController().signal });

test("distinguishes explicitly free work from unreported usage", async () => {
  const free = await executeWithToolUsage(context(), (usage) => {
    usage.addCostUsd(0);
    return { words: 2 };
  });
  const unpriced = await executeWithToolUsage(context(), () => ({ words: 2 }));
  expect(free.usage.costUsd).toBe(0);
  expect(unpriced.usage.costUsd).toBeUndefined();
  expect(JSON.stringify([free, unpriced])).toBe(
    JSON.stringify([
      {
        kind: "chatjs.tool-result",
        output: { words: 2 },
        status: "success",
        usage: { costUsd: 0 },
        version: 1,
      },
      {
        kind: "chatjs.tool-result",
        output: { words: 2 },
        status: "success",
        usage: {},
        version: 1,
      },
    ])
  );
});

test("retains reported costs only for explicitly reported domain failures", async () => {
  const result = await executeWithToolUsage(context(), (usage) => {
    usage.addCostUsd(0.02);
    usage.addCostUsd(0.03);
    return usage.fail();
  });
  expect(result).toMatchObject({
    error: "The tool did not complete.",
    output: null,
    usage: { costUsd: 0.05 },
  });
  expect(JSON.stringify(result)).not.toContain("credentials");
});

test("preserves native exceptions unchanged", async () => {
  const failure = new Error("Provider authorization required", {
    cause: { authorization: "required" },
  });
  await expect(
    executeWithToolUsage(context(), () => {
      throw failure;
    })
  ).rejects.toBe(failure);
  await expect(
    Array.fromAsync(
      executeWithToolProgress(
        context(),
        vi.fn<() => Promise<never>>().mockRejectedValue(failure)
      )
    )
  ).rejects.toBe(failure);
});

test.each([
  { authorization: "required", credentials: "private provider details" },
  "private provider details",
  null,
  undefined,
])("normalizes untyped provider rejections: %j", async (failure) => {
  const provider = vi.fn<() => Promise<never>>().mockRejectedValue(failure);
  const settleCost = vi.fn<() => Promise<number>>();
  const result = executeWithToolUsage(context(), async (usage) => {
    usage.addCostUsd(0.05);
    usage.addDeferredCost(settleCost);
    return await provider();
  });
  await expect(result).rejects.toBeInstanceOf(Error);
  await expect(result).rejects.toMatchObject({
    cause: failure,
    message: "Unexpected tool failure.",
  });
  expect(settleCost).not.toHaveBeenCalled();
  await expect(
    Array.fromAsync(executeWithToolProgress(context(), provider))
  ).rejects.toMatchObject({
    cause: failure,
    message: "Unexpected tool failure.",
  });
});

test("EVE projects normalized failures into failed actions and model error text", async () => {
  const failure: unknown = await executeWithToolUsage(
    context(),
    vi.fn<() => Promise<never>>().mockRejectedValue({ credentials: "private" })
  ).catch((error: unknown) => error);
  const toolError = {
    error: failure,
    input: {},
    toolCallId: "call-1",
    toolName: "meteredTool",
    type: "tool-error",
  } satisfies Parameters<typeof createRuntimeToolResultFromToolError>[0];
  expect(createRuntimeToolResultFromToolError(toolError)).toEqual({
    callId: "call-1",
    errorName: "Error",
    isError: true,
    kind: "tool-result",
    output: "Unexpected tool failure.",
    toolName: "meteredTool",
  });
  expect(createToolResultMessagePartFromToolError(toolError)).toEqual({
    output: { type: "error-text", value: "Unexpected tool failure." },
    toolCallId: "call-1",
    toolName: "meteredTool",
    type: "tool-result",
  });
});

test("cancellation propagates before and during execution", async () => {
  const cancellationReason = { code: "cancelled" };
  const controller = new AbortController();
  const execute = vi.fn();
  controller.abort(cancellationReason);
  await expect(
    executeWithToolUsage({ abortSignal: controller.signal }, execute)
  ).rejects.toBe(controller.signal.reason);
  expect(execute).not.toHaveBeenCalled();
  const running = new AbortController();
  await expect(
    executeWithToolUsage({ abortSignal: running.signal }, (usage) => {
      usage.addCostUsd(0.04);
      running.abort(cancellationReason);
      return usage.fail();
    })
  ).rejects.toBe(running.signal.reason);
});

test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
  "invalid cost %s is a native failure",
  async (cost) => {
    await expect(
      executeWithToolUsage(context(), (usage) => {
        usage.addCostUsd(cost);
        return null;
      })
    ).rejects.toThrow("Tool cost must be finite and nonnegative");
  }
);

test("an unresolved provider cost prevents a known subtotal from becoming a final charge", async () => {
  const usage = createToolUsage();
  usage.addCostUsd(0.05);
  usage.markUnknown();
  expect(await usage.totalUsd()).toBeUndefined();
});
test("invalid durable output is rejected by both types and runtime validation", async () => {
  // @ts-expect-error A Date is not a durable JSON tool output.
  const result = executeWithToolUsage(context(), () => new Date());
  await expect(result).rejects.toThrow();
});
test("streaming cancellation remains native even when the provider returns a result", async () => {
  const controller = new AbortController();
  await expect(
    Array.fromAsync(
      executeWithToolProgress({ abortSignal: controller.signal }, async () => {
        controller.abort();
        return await Promise.resolve(null);
      })
    )
  ).rejects.toBe(controller.signal.reason);
});
