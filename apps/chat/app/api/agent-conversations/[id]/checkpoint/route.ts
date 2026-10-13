import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { z } from "zod";
import { getEveConversation } from "@/lib/db/eve-queries";
import {
  readEveCheckpoint,
  waitForEveCheckpoint,
} from "@/lib/eve/checkpoint-readiness";
import { CheckpointRejectedError } from "@/lib/eve/checkpoint-rejection";
import { env } from "@/lib/env";
import { eveRequest } from "@/lib/eve/server";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";

const MAX_TURN_ID_LENGTH = 64;
const CHECKPOINT_REQUEST_TIMEOUT_MS = 15_000;
const CHECKPOINT_ACCEPTED_STATUS = 202;

const inputSchema = z
  .object({
    beforeTurnId: z
      .string()
      .max(MAX_TURN_ID_LENGTH)
      .regex(/^turn_(?<turnIndex>0|[1-9][0-9]*)$/u),
    checkpointId: z.uuid(),
  })
  .strict();
const checkpointFailureResponse = (
  error: unknown,
  id: string,
  input: ReadonlyNativeSurface<
    Extract<ReturnType<typeof inputSchema.safeParse>, { success: true }>
  >
): Response => {
  if (error instanceof CheckpointRejectedError) {
    return Response.json(
      {
        checkpointRejected: true,
        conversationId: id,
        error: error.message,
        reason: error.reason,
        ...input.data,
      },
      { headers: { "cache-control": "no-store" }, status: 409 }
    );
  }
  return Response.json(
    {
      error:
        "Checkpoint capture is unconfirmed. Retain this request before retrying.",
    },
    { headers: { "cache-control": "no-store" }, status: 409 }
  );
};

/**
 * Requests checkpoint capture for a bound source conversation.
 * On an ambiguous response, the caller must retain this request for a same-request retry.
 * @param {Request} request Same-origin request containing checkpoint identity and turn data.
 * @param {{ params: Promise<{ id: string }> }} context Route parameters containing the conversation ID.
 * @returns {Promise<Response>} JSON confirming readiness or explaining rejection or uncertainty.
 */
export const POST = async (
  request: ReadonlyNativeSurface<Request>,
  context: {
    readonly params: Readonly<
      Promise<{
        readonly id: string;
      }>
    >;
  }
): Promise<Response> => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return new Response(null, { status: 401 });
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { status: 403 });
  }
  const { id } = await context.params;
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!(z.uuid().safeParse(id).success && input.success)) {
    return Response.json(
      { error: "Invalid checkpoint request." },
      { status: 400 }
    );
  }
  const source = await getEveConversation(principal.ownerId, id);
  const sessionId = source?.sessionId;
  if (
    typeof sessionId !== "string" ||
    sessionId === "" ||
    source?.state !== "bound"
  ) {
    return Response.json(
      { error: "Source conversation not found." },
      { status: 404 }
    );
  }
  try {
    if (
      !(await readEveCheckpoint(
        principal.ownerId,
        sessionId,
        input.data.beforeTurnId,
        input.data.checkpointId
      ))
    ) {
      const accepted = await eveRequest(
        principal.ownerId,
        `/eve/chat/v1/session/${encodeURIComponent(sessionId)}/checkpoint`,
        {
          body: JSON.stringify(input.data),
          method: "POST",
          signal: AbortSignal.timeout(CHECKPOINT_REQUEST_TIMEOUT_MS),
        }
      );
      if (accepted.status !== CHECKPOINT_ACCEPTED_STATUS) {
        throw new Error("Checkpoint capture was not accepted.");
      }
      await waitForEveCheckpoint(
        principal.ownerId,
        sessionId,
        input.data.beforeTurnId,
        input.data.checkpointId
      );
    }
    return Response.json(
      { conversationId: id, ready: true, ...input.data },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    return checkpointFailureResponse(error, id, input);
  }
};
