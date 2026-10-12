import { ClientError } from "eve/client";

import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";

const ADMISSION_RETRY_WINDOW_MS = 30_000;
const ADMISSION_RETRY_DELAY_MS = 2000;

const isEveAdmissionBusy = (error: unknown): boolean =>
  error instanceof EveUsageReconciliationBusyError ||
  (error instanceof ClientError && error.code === "usage_reconciliation_busy");

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
      // oxlint-disable-next-line eslint/no-await-in-loop -- Only the preceding admission's certified busy error permits a retry; complete its delay and recheck the deadline before attempting admission again.
      return await admit();
    } catch (error) {
      if (
        !isEveAdmissionBusy(error) ||
        Date.now() + ADMISSION_RETRY_DELAY_MS >= deadline
      ) {
        throw error;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop, promise/avoid-new -- Yield between retryable admissions without holding a server connection. Only the preceding admission's certified busy error permits a retry; complete its delay and recheck the deadline before attempting admission again.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, ADMISSION_RETRY_DELAY_MS);
      });
    }
  }
};

export { isEveAdmissionBusy, retryEveAdmission };
