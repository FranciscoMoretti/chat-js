/** Eve may report errors through onError even when the command promise resolves. */
export async function sendCommand(
  send: () => Promise<void>,
  resume: () => Promise<void>,
  afterCancellation: boolean,
  getError: () => Error | undefined,
  hasAcceptedInput: () => boolean = () => true
) {
  await send();
  const sendError = getError();
  if (sendError) {
    throw sendError;
  }
  // Eve 0.52.2 can end a send reader at the preceding cancellation boundary.
  if (afterCancellation) {
    const deadline = Date.now() + 15_000;
    do {
      await resume();
      if (getError() || hasAcceptedInput()) {
        break;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          "The accepted message is still being reconciled. Reconnect before retrying."
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    } while (!hasAcceptedInput());
  }
  const replayError = getError();
  if (replayError) {
    throw replayError;
  }
}
