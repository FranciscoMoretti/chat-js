import { z } from "zod";

import { getEveConversation } from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import {
  readEveCheckpoint,
  waitForEveCheckpoint,
} from "@/lib/eve/checkpoint-readiness";
import { CheckpointRejected } from "@/lib/eve/checkpoint-rejection";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
import { eveRequest } from "@/lib/eve/server";

const inputSchema = z
  .object({
    checkpointId: z.uuid(),
    beforeTurnId: z
      .string()
      .max(64)
      .regex(/^turn_(0|[1-9][0-9]*)$/),
  })
  .strict();

/** The caller retains this checkpoint identity before posting and on ambiguous failure. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isEveEnabled()) {
    return new Response(null, { status: 404 });
  }
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
  if (!source?.sessionId || source.state !== "bound") {
    return Response.json(
      { error: "Source conversation not found." },
      { status: 404 }
    );
  }
  try {
    if (
      !(await readEveCheckpoint(
        principal.ownerId,
        source.sessionId,
        input.data.beforeTurnId,
        input.data.checkpointId
      ))
    ) {
      const accepted = await eveRequest(
        principal.ownerId,
        `/eve/v1/session/${encodeURIComponent(source.sessionId)}/checkpoint`,
        {
          method: "POST",
          body: JSON.stringify(input.data),
          signal: AbortSignal.timeout(15_000),
        }
      );
      if (accepted.status !== 202) {
        throw new Error("Checkpoint capture was not accepted.");
      }
      await waitForEveCheckpoint(
        principal.ownerId,
        source.sessionId,
        input.data.beforeTurnId,
        input.data.checkpointId
      );
    }
    return Response.json(
      { ready: true, conversationId: id, ...input.data },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (cause) {
    if (cause instanceof CheckpointRejected) {
      return Response.json(
        {
          checkpointRejected: true,
          reason: cause.reason,
          error: cause.message,
          conversationId: id,
          ...input.data,
        },
        { status: 409, headers: { "cache-control": "no-store" } }
      );
    }
    return Response.json(
      {
        error:
          "Checkpoint capture is unconfirmed. Retain this request before retrying.",
      },
      { status: 409, headers: { "cache-control": "no-store" } }
    );
  }
}
