import { retryEveAdmission } from "./admission-retry";

/* oxlint-disable jsdoc/require-param, max-params, max-statements, no-magic-numbers  --
 * import/no-named-export (#527): Preserve the named sendCommand API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): sendCommand remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): sendCommand's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): sendCommand keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): sendCommand keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): sendCommand uses 15_000, 250 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): sendCommand sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
/** Eve may report errors through onError even when the command promise resolves. */
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
    const deadline = Date.now() + 15_000;
    do {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Retry only after the preceding attempt and delay have completed.
      await resume();
      if (getError() || hasAcceptedInput()) {
        break;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          "The accepted message is still being reconciled. Reconnect before retrying."
        );
      }
      // oxlint-disable-next-line eslint/no-await-in-loop, promise/avoid-new -- Retry only after the preceding attempt and delay have completed.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 250);
      });
    } while (!hasAcceptedInput());
  }
  const replayError = getError();
  if (replayError) {
    throw replayError;
  }
};
/* oxlint-enable jsdoc/require-param, max-params, max-statements, no-magic-numbers */
