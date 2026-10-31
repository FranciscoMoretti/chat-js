import { expect, test, vi } from "vitest";
import type { UsageBilling } from "@/chatjs/core/billing/contracts";
import { composeBilling } from "@/chatjs/core/billing/compose";

test("without billing, admission is allowed and no debit can mark receipts charged", async () => {
  const billing = composeBilling([]);
  await expect(billing.canSpend("owner")).resolves.toBe(true);
  expect(billing.debit).toBeUndefined();
});

test("billing preserves the selected adapter's receiver and rejects ambiguous selection", async () => {
  const adapter = {
    allowedOwner: "owner",
    async canSpend(ownerId: string) {
      return await Promise.resolve(ownerId === this.allowedOwner);
    },
    debit: vi.fn<UsageBilling["debit"]>(),
  };
  const billing = composeBilling([adapter]);
  await expect(billing.canSpend("owner")).resolves.toBe(true);
  await expect(billing.canSpend("other")).resolves.toBe(false);
  expect(() => composeBilling([adapter, adapter])).toThrow(
    "Only one billing adapter"
  );
});
