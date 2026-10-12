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
  // Eve 0.52.2 can end a send reader at the preceding cancellation boundary.
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
      // oxlint-disable-next-line eslint/no-await-in-loop, promise/avoid-new -- Yield 250 ms after an unaccepted resume before checking input and opening another reader. Complete the preceding reader and inspect acceptance/error state before the 250ms delay and next resume; ambiguous failures cannot resubmit the command.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, RECONCILIATION_RETRY_DELAY_MS);
      });
    } while (!hasAcceptedInput());
  }
  const replayError = getError();
  if (replayError) {
    throw replayError;
  }
};
