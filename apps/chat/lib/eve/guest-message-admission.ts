import {
  commitEveGuestMessage,
  releaseEveGuestMessage,
  reserveEveGuestMessage,
} from "@/lib/db/eve-guests";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import type { ReadonlyEveMessageInput } from "./readonly-message-types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { UiToolName } from "@/lib/ai/types";
import { createHash } from "node:crypto";
import { rejectEveCommand } from "./command-rejection";
import { EVE_MESSAGE_OPERATION_HEADER } from "./message-delivery";
import { guestRequestIpHash } from "./guest-admission";
import { z } from "zod";

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_UNAVAILABLE = 503;

/**
 * Only the first reservation may dispatch: eve's session POST has no replay key.
 *
 * @param {ReadonlyNativeSurface<Request>} request Request carrying the operation UUID and guest IP headers.
 * @param {string} ownerId Guest owner whose quota and operation reservation are checked.
 * @param {string} sessionId Session included in the reservation payload hash.
 * @param {{ readonly message: ReadonlyEveMessageInput; readonly modelId?: string; readonly selectedTool?: UiToolName; }} input Message, model and selected tool included in the reservation payload hash.
 * @returns {Promise<Response | { operationId: string; reservationId: string }>} The newly acquired reservation identities, or an HTTP rejection/recovery response; storage failures reject.
 */
const admitGuestMessage = async (
  request: ReadonlyNativeSurface<Request>,
  ownerId: string,
  sessionId: string,
  input: {
    readonly message: ReadonlyEveMessageInput;
    readonly modelId?: string;
    readonly selectedTool?: UiToolName;
  }
): Promise<
  | Response
  | {
      operationId: string;
      reservationId: Extract<
        Awaited<ReturnType<typeof reserveEveGuestMessage>>,
        { status: "reserved" }
      >["reservationId"];
    }
> => {
  const operationId = z
    .uuid()
    .safeParse(request.headers.get(EVE_MESSAGE_OPERATION_HEADER));
  if (!operationId.success) {
    return rejectEveCommand(
      "A message operation ID is required.",
      HTTP_BAD_REQUEST
    );
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
    return rejectEveCommand(
      "Sign in to use this model or tool.",
      HTTP_FORBIDDEN
    );
  }
  let ipHash: string;
  try {
    ipHash = guestRequestIpHash(request);
  } catch {
    return rejectEveCommand(
      "Guest admission is unavailable.",
      HTTP_UNAVAILABLE
    );
  }
  const result = await reserveEveGuestMessage({
    ipHash,
    operationId: operationId.data,
    ownerId,
    requestHash: createHash("sha256")
      .update(JSON.stringify({ kind: "message", sessionId, ...input }))
      .digest("hex"),
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
        code: "chatjs_message_operation_exists",
        error:
          "This message operation already exists. Reconnect before sending again.",
      },
      { status: HTTP_CONFLICT }
    );
  }
  return rejectEveCommand(
    "Guest message limit reached. Sign in to continue.",
    HTTP_TOO_MANY_REQUESTS
  );
};
const settleGuestMessage = async (
  response: ReadonlyNativeSurface<Response>,
  ownerId: string,
  admission: {
    readonly operationId: string;
    readonly reservationId: string;
  }
): Promise<void> => {
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
    response.status === HTTP_CONFLICT &&
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
export { admitGuestMessage, settleGuestMessage };
