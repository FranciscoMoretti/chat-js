import { billing } from "@/integrations/billing";
import { reconcileEveOwnerUsage } from "./reconcile-usage";

/** Repair recorded usage before checking the balance. This does not reserve funds. */
export const canStartPaidTurn = async (
  ownerId: string,
  sessionId?: string
): Promise<boolean> => {
  await reconcileEveOwnerUsage(ownerId, sessionId);
  return await billing.canSpend(ownerId);
};
