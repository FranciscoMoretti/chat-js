import { z } from "zod";
import { auth } from "@/lib/auth";
import { canSpend } from "@/lib/db/credits";
import {
  CreationConflict,
  createEveConversation,
  getEveCreation,
} from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import { createConversationInput } from "@/lib/eve/contracts";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
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
  try {
    const existing = await getEveCreation(
      session.user.id,
      input.data.operationId
    );
    if (!existing) {
      try {
        await loadEveModelDefinition(input.data.modelId);
      } catch {
        return Response.json(
          {
            error: "This model is not available for chat.",
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
      input.data.message,
      async (operationId) => {
        const result = await eveRequest(
          session.user.id,
          "/eve/v1/session",
          {
            method: "POST",
            body: JSON.stringify({ message: input.data.message, operationId }),
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
      input.data.modelId
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
