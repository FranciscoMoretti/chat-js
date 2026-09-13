/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { createHash } from "node:crypto";

import { z } from "zod";

import type { UiToolName } from "../ai/types";
import {
  commitEveGuestMessage,
  releaseEveGuestMessage,
  reserveEveGuestMessage,
} from "../db/eve-guests";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import { rejectEveCommand } from "./command-rejection";
import { guestRequestIpHash } from "./guest-admission";
import type { EveMessageInput } from "./message-input";

export const EVE_MESSAGE_OPERATION_HEADER = "x-chatjs-message-operation";
/** Only the first reservation may dispatch: eve's session POST has no replay key. */
export const admitGuestMessage = async (
  request: Request,
  ownerId: string,
  sessionId: string,
  input: {
    message: EveMessageInput;
    modelId?: string;
    selectedTool?: UiToolName;
  }
) => {
  const operationId = z
    .uuid()
    .safeParse(request.headers.get(EVE_MESSAGE_OPERATION_HEADER));
  if (!operationId.success) {
    return rejectEveCommand("A message operation ID is required.", 400);
  }
  if (
    !ANONYMOUS_LIMITS.AVAILABLE_MODELS.some(
      (model) => model === input.modelId
    ) ||
    (input.selectedTool &&
      !ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some(
        (tool) => tool === input.selectedTool
      ))
  ) {
    return rejectEveCommand("Sign in to use this model or tool.", 403);
  }
  let ipHash: string;
  try {
    ipHash = guestRequestIpHash(request);
  } catch {
    return rejectEveCommand("Guest admission is unavailable.", 503);
  }
  const result = await reserveEveGuestMessage({
    ownerId,
    operationId: operationId.data,
    requestHash: createHash("sha256")
      .update(JSON.stringify({ kind: "message", sessionId, ...input }))
      .digest("hex"),
    ipHash,
    requestsPerMinute: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MINUTE,
    requestsPerMonth: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MONTH,
  });
  if (result.status === "reserved") {
    return {
      operationId: operationId.data,
      reservationId: result.reservationId,
    };
  }
  if (result.status === "replay" || result.status === "conflict") {
    // This is deliberately not chatjs_command_rejected: the original may have run.
    return Response.json(
      {
        error:
          "This message operation already exists. Reconnect before sending again.",
        code: "chatjs_message_operation_exists",
      },
      { status: 409 }
    );
  }
  return rejectEveCommand(
    "Guest message limit reached. Sign in to continue.",
    429
  );
};
export const settleGuestMessage = async (
  response: Response,
  ownerId: string,
  admission: {
    operationId: string;
    reservationId: string;
  }
) => {
  if (response.ok) {
    await commitEveGuestMessage(
      ownerId,
      admission.operationId,
      admission.reservationId
    );
    return;
  }
  // Native dispatch explicitly reports a session that never admitted the command.
  const inactive =
    response.status === 409 &&
    z.object({ code: z.literal("session_not_active") }).safeParse(
      await response
        .clone()
        .json()
        .catch(() => null)
    ).success;
  if (inactive) {
    await releaseEveGuestMessage(
      ownerId,
      admission.operationId,
      admission.reservationId
    );
  }
};
