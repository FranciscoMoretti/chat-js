/** Transient admission backpressure, never a rejected or dispatched command. */
class EveUsageReconciliationBusyError extends Error {
  public constructor() {
    super("Usage reconciliation is busy. Retry the same operation shortly.");
    this.name = "EveUsageReconciliationBusyError";
  }
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): eveUsageBusyResponse accepts error: EveUsageReconciliationBusyError; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const eveUsageBusyResponse = (
  error: EveUsageReconciliationBusyError
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { eveUsageBusyResponse, EveUsageReconciliationBusyError };
/* oxlint-enable import/no-named-export */
