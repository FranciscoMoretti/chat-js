import { ClientError } from "eve/client";

import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";

export const isEveAdmissionBusy = (error: unknown) =>
  error instanceof EveUsageReconciliationBusyError ||
  (error instanceof ClientError && error.code === "usage_reconciliation_busy");

/** Replay only a server-certified undispatched admission, retaining its closure/ID. */
export const retryEveAdmission = async <T>(
  admit: () => Promise<T>
): Promise<T> => {
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Retry only explicit admission backpressure, never an ambiguous send.
      return await admit();
    } catch (error) {
      if (!isEveAdmissionBusy(error) || Date.now() + 2000 >= deadline) {
        throw error;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop, promise/avoid-new -- Yield between retryable admissions without holding a server connection.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
  }
};
