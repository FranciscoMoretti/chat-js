import type { UsageBilling } from "./usage-billing-contracts";

/** No adapter permits admission but leaves receipts uncharged. */
export const composeBilling = (
  adapters: readonly UsageBilling[]
): {
  readonly canSpend: UsageBilling["canSpend"];
  readonly debit: UsageBilling["debit"] | undefined;
} => {
  if (adapters.length > 1) {
    throw new Error("Only one billing adapter may be selected.");
  }
  const adapter = adapters.at(0);
  return {
    canSpend: adapter
      ? async (ownerId) => await adapter.canSpend(ownerId)
      : async () => await Promise.resolve(true),
    debit: adapter
      ? async (tx, input) => {
          await adapter.debit(tx, input);
        }
      : undefined,
  };
};
