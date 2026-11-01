import { retryEveAdmission } from "./admission-retry";

const RECONCILIATION_TIMEOUT_MS = 15_000;
const RECONCILIATION_RETRY_DELAY_MS = 250;

/**
 * Send with admission retries, then reconnect past a preceding cancellation when needed.
 * Eve may report errors through onError even when the command promise resolves.
 * @param {() => Promise<void>} send - Submit the command; admission retries may invoke it again.
 * @param {() => Promise<void>} resume - Reopen the reader after a preceding cancellation boundary.
 * @param {boolean} afterCancellation - Whether the command needs cancellation-boundary reconciliation.
 * @param {() => Error | undefined} getError - Read the latest error reported by the command or resumed reader.
 * @param {() => boolean} hasAcceptedInput - Check whether reconciliation has accepted the submitted input.
 */
export const sendCommand = async (
  send: () => Promise<void>,
  resume: () => Promise<void>,
  afterCancellation: boolean,
  getError: () => Error | undefined,
  hasAcceptedInput: () => boolean = () => true
): Promise<void> => {
  await retryEveAdmission(async () => {
    await send();
    const sendError = getError();
    if (sendError) {
      throw sendError;
    }
  });
  // Reconnect past a preceding cancellation without dispatching another message.
  if (afterCancellation) {
    const deadline = Date.now() + RECONCILIATION_TIMEOUT_MS;
    do {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Complete the preceding reader and inspect acceptance/error state before the 250ms delay and next resume; ambiguous failures cannot resubmit the command.
      await resume();
      if (getError() || hasAcceptedInput()) {
        break;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          "The accepted message is still being reconciled. Reconnect before retrying."
        );
      }
      const retryDelay: { promise: Promise<void>; resolve: () => void } =
        Promise.withResolvers();
      setTimeout(retryDelay.resolve, RECONCILIATION_RETRY_DELAY_MS);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Complete the reader and delay before checking acceptance and resuming again.
      await retryDelay.promise;
    } while (!hasAcceptedInput());
  }
  const replayError = getError();
  if (replayError) {
    throw replayError;
  }
};
