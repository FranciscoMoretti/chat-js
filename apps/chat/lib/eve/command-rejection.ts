import { ClientError } from "eve/client";

const code = "chatjs_command_rejected";

/** Only use before forwarding a command to Eve; upstream failures can be ambiguous. */
export function rejectEveCommand(message: string, status: number) {
  return Response.json({ error: message, code }, { status });
}

export function isEveCommandRejection(error: unknown): error is ClientError {
  return error instanceof ClientError && error.code === code;
}
