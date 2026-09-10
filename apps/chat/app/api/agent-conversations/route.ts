import { createHash } from "node:crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canSpend } from "@/lib/db/credits";
import {
  CreationConflict,
  createEveConversation,
  getEveConversation,
  getEveCreation,
} from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import {
  createConversationInput,
  type EveForkInput,
} from "@/lib/eve/contracts";
import { eveMessageTitle } from "@/lib/eve/message-input";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { prepareEveMessage } from "@/lib/eve/prepare-message";
import { reconcileEveOwnerUsage } from "@/lib/eve/reconcile-usage";
import { sameOrigin } from "@/lib/eve/request-policy";
import { assertEveConfigured, eveRequest } from "@/lib/eve/server";

export async function POST(request: Request) {
  if (!isEveEnabled()) {
    return new Response(null, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response(null, { status: 401 });
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { status: 403 });
  }
  const input = createConversationInput.safeParse(
    await request.json().catch(() => null)
  );
  if (!input.success) {
    return Response.json(
      { error: "Enter a message between 1 and 16,000 characters." },
      { status: 400 }
    );
  }
  try {
    assertEveConfigured();
  } catch {
    return Response.json(
      { error: "The agent worker is not configured." },
      { status: 503 }
    );
  }
  const fork = await resolveFork(session.user.id, input.data.fork);
  if (fork instanceof Response) {
    return fork;
  }

  let preparedMessage:
    | Awaited<ReturnType<typeof prepareEveMessage>>
    | undefined;
  try {
    const existing = await getEveCreation(
      session.user.id,
      input.data.operationId
    );
    if (!existing) {
      try {
        await loadEveModelDefinition(input.data.modelId);
        preparedMessage = await prepareEveMessage(
          input.data.message,
          input.data.modelId
        );
      } catch {
        return Response.json(
          {
            error: "This model or attachment is not available for chat.",
            creationRejected: true,
          },
          { status: 400 }
        );
      }
      await reconcileEveOwnerUsage(session.user.id);
      if (!(await canSpend(session.user.id))) {
        return Response.json(
          { error: "Insufficient credits" },
          { status: 402 }
        );
      }
    }
  } catch {
    return Response.json(
      {
        error:
          "Usage reconciliation is unavailable. Try again before starting a new conversation.",
      },
      { status: 503 }
    );
  }
  try {
    const binding = await createEveConversation(
      session.user.id,
      input.data.operationId,
      eveMessageTitle(input.data.message),
      async (operationId) => {
        const existing = await eveRequest(
          session.user.id,
          `/eve/v1/operation/${operationId}`,
          {
            signal: AbortSignal.timeout(15_000),
          }
        );
        if (existing.ok) {
          return z
            .object({ sessionId: z.string().min(1) })
            .parse(await existing.json()).sessionId;
        }
        const lookupFailure = z
          .object({ code: z.literal("eve_operation_not_found") })
          .safeParse(await existing.json().catch(() => null));
        if (existing.status !== 404 || !lookupFailure.success) {
          throw new Error("Native operation lookup is unavailable.");
        }
        // Uncertain reservations may have reached Eve before their reply was lost.
        // Reuse the same operation with the original input; never dispatch an empty turn.
        if (preparedMessage === undefined) {
          await loadEveModelDefinition(input.data.modelId);
          preparedMessage = await prepareEveMessage(
            input.data.message,
            input.data.modelId
          );
        }
        const result = await eveRequest(
          session.user.id,
          "/eve/v1/session",
          {
            method: "POST",
            signal: AbortSignal.timeout(30_000),
            body: JSON.stringify({
              message: preparedMessage,
              operationId,
              fork,
            }),
          },
          input.data.modelId
        );
        if (!result.ok) {
          throw new Error("Session creation failed.");
        }
        return z
          .object({ sessionId: z.string().min(1) })
          .parse(await result.json()).sessionId;
      },
      input.data.modelId,
      typeof input.data.message === "string"
        ? undefined
        : createHash("sha256")
            .update(JSON.stringify(input.data.message))
            .digest("hex"),
      input.data.fork
    );
    return Response.json(binding);
  } catch (cause) {
    return Response.json(
      {
        error:
          cause instanceof CreationConflict
            ? cause.message
            : "Creation is unresolved. Retain this operation for reconciliation before retrying.",
      },
      { status: 409 }
    );
  }
}

async function resolveFork(ownerId: string, input: EveForkInput | undefined) {
  if (!input) {
    return undefined;
  }
  const source = await getEveConversation(ownerId, input.conversationId);
  if (!source?.sessionId || source.state !== "bound") {
    return Response.json(
      { error: "Source conversation not found.", creationRejected: true },
      { status: 404 }
    );
  }
  return { sessionId: source.sessionId, beforeTurnId: input.beforeTurnId };
}
