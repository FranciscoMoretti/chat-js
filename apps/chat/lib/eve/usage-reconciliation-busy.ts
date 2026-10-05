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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveUsageBusyResponse, EveUsageReconciliationBusyError); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { eveUsageBusyResponse, EveUsageReconciliationBusyError };
/* oxlint-enable import/no-named-export */
