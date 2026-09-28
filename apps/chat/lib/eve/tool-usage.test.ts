/* oxlint-disable unicorn/prefer-structured-clone -- Exercise persisted JSON wire data, including omitted undefined values. */
import { expect, test, vi } from "vitest";

import { toolResultSchema } from "./tool-result";
import {
  createToolUsage,
  executeWithToolUsage,
  executeWithToolProgress,
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
  expect(toolResultSchema.parse(JSON.parse(JSON.stringify(free)))).toEqual(
    free
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

test.each([
  new Error("Unexpected provider failure"),
  { authorization: "required" },
])("preserves native exceptions unchanged: %s", async (failure) => {
  await expect(
    executeWithToolUsage(context(), () => {
      throw failure;
    })
  ).rejects.toBe(failure);
  await expect(
    Array.fromAsync(
      executeWithToolProgress(context(), () => Promise.reject(failure))
    )
  ).rejects.toBe(failure);
});

test("cancellation propagates before and during execution", async () => {
  const controller = new AbortController();
  const execute = vi.fn();
  controller.abort();
  await expect(
    executeWithToolUsage({ abortSignal: controller.signal }, execute)
  ).rejects.toBe(controller.signal.reason);
  expect(execute).not.toHaveBeenCalled();
  const running = new AbortController();
  await expect(
    executeWithToolUsage({ abortSignal: running.signal }, (usage) => {
      usage.addCostUsd(0.04);
      running.abort();
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
