/** Transient admission backpressure, never a rejected or dispatched command. */
export class EveUsageReconciliationBusyError extends Error {
  constructor() {
    super("Usage reconciliation is busy. Retry the same operation shortly.");
    this.name = "EveUsageReconciliationBusyError";
  }
}

export const eveUsageBusyResponse = (error: EveUsageReconciliationBusyError) =>
  Response.json(
    {
      code: "usage_reconciliation_busy",
      error: error.message,
      retryable: true,
    },
    { headers: { "Retry-After": "2" }, status: 503 }
  );
