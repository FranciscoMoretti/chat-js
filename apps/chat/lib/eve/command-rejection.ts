import { ClientError } from "eve/client";

import { isEveAdmissionBusy } from "./admission-retry";

const code = "chatjs_command_rejected";

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns --
 * import/group-exports (#523): rejectEveCommand stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): rejectEveCommand's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): rejectEveCommand's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/** Only use before forwarding a command to Eve; upstream failures can be ambiguous. */
export const rejectEveCommand = (message: string, status: number): Response =>
  Response.json({ code, error: message }, { status });
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): isEveCommandRejection stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const isEveCommandRejection = (error: unknown): error is ClientError =>
  error instanceof ClientError &&
  (error.code === code || isEveAdmissionBusy(error));
/* oxlint-enable import/group-exports */
