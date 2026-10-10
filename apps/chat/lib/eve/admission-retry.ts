import { ClientError } from "eve/client";

import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";

const ADMISSION_RETRY_WINDOW_MS = 30_000;
const ADMISSION_RETRY_DELAY_MS = 2000;

const isEveAdmissionBusy = (error: unknown): boolean =>
  error instanceof EveUsageReconciliationBusyError ||
  (error instanceof ClientError && error.code === "usage_reconciliation_busy");

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve retryEveAdmission's awaited sequencing and rejected-Promise behavior. */

/**
 * Replay only a server-certified undispatched admission, retaining its closure/ID.
 * @param {() => Promise<AdmissionResult>} admit Replays the caller's admission closure after certified backpressure.
 * @returns {Promise<AdmissionResult>} The first successful admission result.
 */
const retryEveAdmission = async <AdmissionResult>(
  admit: () => Promise<AdmissionResult>
): Promise<AdmissionResult> => {
  const deadline = Date.now() + ADMISSION_RETRY_WINDOW_MS;
  for (;;) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Await each admission inside this catch so only certified busy failures can trigger another attempt.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (isEveAdmissionBusy, retryEveAdmission); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */

export { isEveAdmissionBusy, retryEveAdmission };
/* oxlint-enable import/no-named-export */
