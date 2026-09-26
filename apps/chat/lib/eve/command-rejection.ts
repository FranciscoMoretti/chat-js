import { ClientError } from "eve/client";

import { isEveAdmissionBusy } from "./admission-retry";

const code = "chatjs_command_rejected";

/** Only use before forwarding a command to Eve; upstream failures can be ambiguous. */
export const rejectEveCommand = (message: string, status: number) =>
  Response.json({ code, error: message }, { status });

export const isEveCommandRejection = (error: unknown): error is ClientError =>
  error instanceof ClientError &&
  (error.code === code || isEveAdmissionBusy(error));
