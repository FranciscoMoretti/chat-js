import { ClientError } from "eve/client";

import { isEveAdmissionBusy } from "./admission-retry";

const code = "chatjs_command_rejected";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns -- jsdoc/require-param (#534): rejectEveCommand's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): rejectEveCommand's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags. */
/** Only use before forwarding a command to Eve; upstream failures can be ambiguous. */
const rejectEveCommand = (message: string, status: number): Response =>
  Response.json({ code, error: message }, { status });
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */

const isEveCommandRejection = (error: unknown): error is ClientError =>
  error instanceof ClientError &&
  (error.code === code || isEveAdmissionBusy(error));
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (isEveCommandRejection, rejectEveCommand); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { isEveCommandRejection, rejectEveCommand };
/* oxlint-enable import/no-named-export */
