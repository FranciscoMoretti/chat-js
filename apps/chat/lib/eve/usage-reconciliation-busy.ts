/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): EveUsageReconciliationBusyError stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named EveUsageReconciliationBusyError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/** Transient admission backpressure, never a rejected or dispatched command. */
export class EveUsageReconciliationBusyError extends Error {
  public constructor() {
    super("Usage reconciliation is busy. Retry the same operation shortly.");
    this.name = "EveUsageReconciliationBusyError";
  }
}
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): eveUsageBusyResponse stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveUsageBusyResponse API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): eveUsageBusyResponse accepts error: EveUsageReconciliationBusyError; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const eveUsageBusyResponse = (
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
/* oxlint-enable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types */
