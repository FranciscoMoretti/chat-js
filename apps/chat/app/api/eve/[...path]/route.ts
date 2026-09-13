import { frontendToolsSchema, type UiToolName } from "@/lib/ai/types";
import { canSpend } from "@/lib/db/credits";
import { referenceEveFiles } from "@/lib/db/eve-files";
import { getBoundEveConversationForSession } from "@/lib/db/eve-queries";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import { rejectEveCommand } from "@/lib/eve/command-rejection";
import { eveMessageFileKeys } from "@/lib/eve/file-references";
import {
  admitGuestMessage,
  settleGuestMessage,
} from "@/lib/eve/guest-message-admission";
import type { EveMessageInput } from "@/lib/eve/message-input";
import { eveToolMetadata } from "@/lib/eve/message-tool-selection";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { prepareEveMessage } from "@/lib/eve/prepare-message";
import { type EvePrincipal, resolveEvePrincipal } from "@/lib/eve/principal";
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

async function checkTurnAdmission(
  request: Request,
  principal: EvePrincipal,
  sessionId: string,
  command: Exclude<Awaited<ReturnType<typeof readCommand>>, Response>
) {
  if (!command.isNewMessage || command.message === undefined) {
    return;
  }
  if (principal.kind === "guest") {
    return await admitGuestMessage(request, principal.ownerId, sessionId, {
      message: command.message,
      modelId: command.modelId,
      selectedTool: command.selectedTool,
    });
  }
  await reconcileEveOwnerUsage(principal.ownerId);
  if (!(await canSpend(principal.ownerId))) {
    return rejectEveCommand("Insufficient credits", 402);
  }
}

function selectionsConflict(header: string | null, body: string | undefined) {
  return header !== null && body !== undefined && header !== body;
}

function parseToolSelection(
  header: string | null,
  body: UiToolName | undefined
) {
  return frontendToolsSchema
    .optional()
    .refine(() => header === null || body === undefined || header === body)
    .safeParse(header ?? body);
}

async function readCommand(
  request: Request,
  policy: NonNullable<ReturnType<typeof parseSessionRequest>>,
  ownerId: string,
  conversationId: string
) {
  let body: string | undefined;
  let isNewMessage = false;
  let message: EveMessageInput | undefined;
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
      message = input.data.message;
      const suppliedTool = request.headers.get("x-chatjs-selected-tool");
      const tool = parseToolSelection(suppliedTool, input.data.selectedTool);
      if (!tool.success) {
        return rejectEveCommand("Invalid or conflicting tool selection.", 400);
      }
      selectedTool = tool.data;
      const selectedModel = request.headers.get("x-chatjs-selected-model");
      if (selectionsConflict(selectedModel, input.data.modelId)) {
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
          messageMetadata: eveToolMetadata(selectedTool),
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
  return { body, isNewMessage, message, modelId, selectedTool };
}

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!isEveEnabled()) {
    return rejectRequest(request, "Agent conversations are unavailable.", 404);
  }
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return rejectRequest(request, "Sign in to continue.", 401);
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return rejectRequest(request, "Request origin is not allowed.", 403);
  }
  const { path } = await context.params;
  const upstreamPath = `/eve/${path.join("/")}`;
  const policy = parseSessionRequest(upstreamPath, request.method);
  const conversation = policy
    ? await getBoundEveConversationForSession(
        principal.ownerId,
        policy.sessionId
      )
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
    principal.ownerId,
    conversation.id
  );
  if (command instanceof Response) {
    return command;
  }
  const { body, modelId, selectedTool } = command;
  try {
    const admission = await checkTurnAdmission(
      request,
      principal,
      policy.sessionId,
      command
    );
    if (admission instanceof Response) {
      return admission;
    }
    const result = await eveRequest(
      principal.ownerId,
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
    if (admission) {
      await settleGuestMessage(result, principal.ownerId, admission);
    }
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
