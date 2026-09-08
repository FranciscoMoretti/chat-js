/** Eve may report errors through onError even when the command promise resolves. */
export async function sendCommand(
  send: () => Promise<void>,
  resume: () => Promise<void>,
  afterCancellation: boolean,
  getError: () => Error | undefined
) {
  await send();
  const sendError = getError();
  if (sendError) {
    throw sendError;
  }
  // Eve 0.52.2 can end a send reader at the preceding cancellation boundary.
  if (afterCancellation) {
    await resume();
  }
  const replayError = getError();
  if (replayError) {
    throw replayError;
  }
}
