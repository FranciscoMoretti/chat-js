/** Transient admission backpressure, never a rejected or dispatched command. */
class EveUsageReconciliationBusyError extends Error {
  public constructor() {
    super("Usage reconciliation is busy. Retry the same operation shortly.");
    this.name = "EveUsageReconciliationBusyError";
  }
}

const eveUsageBusyResponse = (
  error: Readonly<EveUsageReconciliationBusyError>
): Response =>
  Response.json(
    {
      code: "usage_reconciliation_busy",
      error: error.message,
      retryable: true,
    },
    { headers: { "Retry-After": "2" }, status: 503 }
  );
export { eveUsageBusyResponse, EveUsageReconciliationBusyError };
