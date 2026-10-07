/* oxlint-disable unicorn/prefer-structured-clone -- Exercise persisted JSON wire data, including omitted undefined values. */
import { expect, test, vi } from "vitest";

import { toolResultSchema } from "./tool-result";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  createToolUsage,
  executeWithToolProgress,
  executeWithToolUsage,
} from "./tool-usage";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep context's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const context = () => ({ abortSignal: new AbortController().signal });
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * no-magic-numbers (#517): test("distinguishes explicitly free work from unreported usage") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("distinguishes explicitly free work from unreported usage") accepts usage; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): test("distinguishes explicitly free work from unreported usage") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * no-magic-numbers (#517): test("retains reported costs only for explicitly reported domain failures") uses 0.02, 0.03 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("retains reported costs only for explicitly reported domain failures") accepts usage; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): test("retains reported costs only for explicitly reported domain failures") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   new Error("Unexpected provider failure"),   { authorization: "required" }, ])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/max-nested-calls --
 * typescript/prefer-readonly-parameter-types (#565): test.each([ new Error("Unexpected provider failure"), { authorization: "required" },  accepts failure; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test.each([ new Error("Unexpected provider failure"), { authorization: "required" },  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/max-nested-calls (#568): test.each([ new Error("Unexpected provider failure"), { authorization: "required" },  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test.each([
  new Error("Unexpected provider failure"),
  { authorization: "required" },
])("preserves native exceptions unchanged: %s", async (failure) => {
  await expect(
    executeWithToolUsage(context(), () => {
      // oxlint-disable-next-line typescript/only-throw-error -- #601: This test deliberately injects a non-Error failure to verify rejection and abort handling for arbitrary provider reasons.
      throw failure;
    })
  ).rejects.toBe(failure);
  await expect(
    Array.fromAsync(
      // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- #603: This test deliberately injects a non-Error failure to verify rejection and abort handling for arbitrary provider reasons.
      executeWithToolProgress(context(), () => Promise.reject(failure))
    )
  ).rejects.toBe(failure);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/max-nested-calls */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): test("cancellation propagates before and during execution") uses 0.04 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("cancellation propagates before and during execution") accepts usage; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * no-magic-numbers (#517): test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("invalid cost %s is a native fa uses -1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("invalid cost %s is a native fa accepts usage; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("invalid cost %s is a native fa preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("an unresolved provider cost prevents a known subtotal from becoming a final cha uses 0.05 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("an unresolved provider cost prevents a known subtotal from becoming a final charge", async () => {
  const usage = createToolUsage();
  usage.addCostUsd(0.05);
  usage.markUnknown();
  expect(await usage.totalUsd()).toBeUndefined();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
test("invalid durable output is rejected by both types and runtime validation", async () => {
  // @ts-expect-error A Date is not a durable JSON tool output.
  const result = executeWithToolUsage(context(), () => new Date());
  await expect(result).rejects.toThrow();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): test("streaming cancellation remains native even when the provider returns a result") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
