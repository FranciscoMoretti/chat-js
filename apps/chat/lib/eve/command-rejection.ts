import { ClientError } from "eve/client";

import { isEveAdmissionBusy } from "./admission-retry";

const code = "chatjs_command_rejected";

/** Only use before forwarding a command to Eve; upstream failures can be ambiguous.
 * @param {string} message Rejection reason exposed to the requesting client.
 * @param {number} status HTTP status for this definitive admission rejection.
 * @returns {Response} JSON response carrying the application rejection code and message; this code certifies that the command was not forwarded.
 */
const rejectEveCommand = (message: string, status: number): Response =>
  Response.json({ code, error: message }, { status });

const isEveCommandRejection = (error: unknown): error is ClientError =>
  error instanceof ClientError &&
  (error.code === code || isEveAdmissionBusy(error));
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (isEveCommandRejection, rejectEveCommand); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { isEveCommandRejection, rejectEveCommand };
/* oxlint-enable import/no-named-export */
