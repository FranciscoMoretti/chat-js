import { ClientError } from "eve/client";

import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";

const ADMISSION_RETRY_WINDOW_MS = 30_000;
const ADMISSION_RETRY_DELAY_MS = 2000;

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): isEveAdmissionBusy stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const isEveAdmissionBusy = (error: unknown): boolean =>
  error instanceof EveUsageReconciliationBusyError ||
  (error instanceof ClientError && error.code === "usage_reconciliation_busy");
/* oxlint-enable import/group-exports */

/* oxlint-disable id-length, import/group-exports --
 * id-length (#506): retryEveAdmission uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): retryEveAdmission stays exported at its declaration so its public contract is visible beside its implementation.
 */
/**
 * Replay only a server-certified undispatched admission, retaining its closure/ID.
 * @param admit Replays the caller's admission closure after certified backpressure.
 * @returns The first successful admission result.
 */
export const retryEveAdmission = async <T>(
  admit: () => Promise<T>
): Promise<T> => {
  const deadline = Date.now() + ADMISSION_RETRY_WINDOW_MS;
  for (;;) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Retry only explicit admission backpressure, never an ambiguous send.
      return await admit();
    } catch (error) {
      if (
        !isEveAdmissionBusy(error) ||
        Date.now() + ADMISSION_RETRY_DELAY_MS >= deadline
      ) {
        throw error;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop, promise/avoid-new -- Yield between retryable admissions without holding a server connection.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, ADMISSION_RETRY_DELAY_MS);
      });
    }
  }
};
/* oxlint-enable id-length, import/group-exports */
