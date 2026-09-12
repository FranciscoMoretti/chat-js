import type { UiToolName } from "@/lib/ai/types";
import { auth } from "@/lib/auth";
import { canSpend } from "@/lib/db/credits";
import { referenceEveFiles } from "@/lib/db/eve-files";
import { getBoundEveConversationForSession } from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import { rejectEveCommand } from "@/lib/eve/command-rejection";
import { eveMessageFileKeys } from "@/lib/eve/file-references";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { prepareEveMessage } from "@/lib/eve/prepare-message";
import { reconcileEveOwnerUsage } from "@/lib/eve/reconcile-usage";
import {
  parseSessionRequest,
  safeStreamQuery,
  sameOrigin,
} from "@/lib/eve/request-policy";
import { eveRequest } from "@/lib/eve/server";

function rejectRequest(request: Request, message: string, status: number) {
  // A failed stream read cannot prove that an earlier POST was rejected.
  return request.method === "POST"
    ? rejectEveCommand(message, status)
    : Response.json({ error: message }, { status });
}

async function checkTurnAdmission(isNewMessage: boolean, ownerId: string) {
  if (!isNewMessage) {
    return;
  }
  await reconcileEveOwnerUsage(ownerId);
  if (!(await canSpend(ownerId))) {
    return rejectEveCommand("Insufficient credits", 402);
  }
}

async function readCommand(
  request: Request,
  policy: NonNullable<ReturnType<typeof parseSessionRequest>>,
  ownerId: string,
  conversationId: string
) {
  let body: string | undefined;
  let isNewMessage = false;
  let modelId: string | undefined;
  let selectedTool: UiToolName | undefined;
  if (request.method === "POST") {
    const input = policy.schema.safeParse(
      await request.json().catch(() => null)
    );
    if (!input.success) {
      return rejectEveCommand("Invalid command.", 400);
    }
    if ("message" in input.data) {
      selectedTool = input.data.selectedTool;
      const selectedModel = request.headers.get("x-chatjs-selected-model");
      if (
        selectedModel &&
        input.data.modelId &&
        selectedModel !== input.data.modelId
      ) {
        return rejectEveCommand("Conflicting model selection.", 400);
      }
      modelId = selectedModel ?? input.data.modelId;
      try {
        await loadEveModelDefinition(modelId);
        await referenceEveFiles(
          ownerId,
          conversationId,
          eveMessageFileKeys(input.data.message)
        );
        body = JSON.stringify({
          message: await prepareEveMessage(input.data.message, modelId),
        });
      } catch (cause) {
        return rejectEveCommand(
          cause instanceof Error ? cause.message : "Unable to read attachment.",
          400
        );
      }
    } else {
      body = JSON.stringify(input.data);
    }
    isNewMessage = "message" in input.data;
  }
  return { body, isNewMessage, modelId, selectedTool };
}

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!isEveEnabled()) {
    return rejectRequest(request, "Agent conversations are unavailable.", 404);
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return rejectRequest(request, "Sign in to continue.", 401);
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return rejectRequest(request, "Request origin is not allowed.", 403);
  }
  const { path } = await context.params;
  const upstreamPath = `/eve/${path.join("/")}`;
  const policy = parseSessionRequest(upstreamPath, request.method);
  const conversation = policy
    ? await getBoundEveConversationForSession(session.user.id, policy.sessionId)
    : undefined;
  if (!(policy && conversation)) {
    return rejectRequest(request, "Conversation not found.", 404);
  }
  const query = safeStreamQuery(new URL(request.url).searchParams);
  if (!query || (request.method !== "GET" && query.size)) {
    return rejectRequest(request, "Invalid command query.", 400);
  }
  const command = await readCommand(
    request,
    policy,
    session.user.id,
    conversation.id
  );
  if (command instanceof Response) {
    return command;
  }
  const { body, isNewMessage, modelId, selectedTool } = command;
  try {
    const admission = await checkTurnAdmission(isNewMessage, session.user.id);
    if (admission) {
      return admission;
    }
    const result = await eveRequest(
      session.user.id,
      upstreamPath + (query.size ? `?${query}` : ""),
      {
        method: request.method,
        body,
        // Closing the reader must not cancel a validated command before Eve
        // can durably accept it. Streaming reads still follow browser lifetime.
        signal:
          request.method === "GET"
            ? request.signal
            : AbortSignal.timeout(30_000),
      },
      modelId,
      selectedTool
    );
    const headers = new Headers({ "cache-control": "no-store" });
    for (const key of [
      "content-type",
      "x-eve-session-id",
      "x-eve-stream-format",
      "x-eve-stream-version",
      "x-eve-stream-tail-index",
    ]) {
      const value = result.headers.get(key);
      if (value) {
        headers.set(key, value);
      }
    }
    return new Response(result.body, { status: result.status, headers });
  } catch {
    return Response.json(
      {
        error:
          "The agent connection was interrupted. Reconnect before retrying.",
      },
      { status: 502 }
    );
  }
}
export const GET = handle;
export const POST = handle;
