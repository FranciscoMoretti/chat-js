import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("eve.accounting");
interface AccountingScope {
  readonly ownerId: string;
  readonly sessionId: string;
  readonly turnId?: string;
  readonly eventId?: string;
}
type AccountingWrite =
  | "intent"
  | "response"
  | "receipt"
  | "tool-receipt"
  | "cursor";

const reportEveAccountingIssue = (
  scope: AccountingScope,
  stage: AccountingWrite | "missing-cost" | "missing-receipt",
  error?: unknown
): void => {
  log.error(
    {
      ownerId: scope.ownerId,
      sessionId: scope.sessionId,
      turnId: scope.turnId,
      eventId: scope.eventId,
      stage,
      errorType: error instanceof Error ? "error" : typeof error,
    },
    "Eve accounting requires review"
  );
};

// Use only around accounting persistence, after authorization and outside provider calls.
const tryEveAccountingWrite = async <Result>(
  scope: AccountingScope,
  stage: AccountingWrite,
  write: () => Promise<Result>
): Promise<Result | undefined> => {
  try {
    return await write();
  } catch (error) {
    reportEveAccountingIssue(scope, stage, error);
    return undefined;
  }
};

export { reportEveAccountingIssue, tryEveAccountingWrite };
