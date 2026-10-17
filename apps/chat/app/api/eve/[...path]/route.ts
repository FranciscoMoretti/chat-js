import {
  dispatchEveOnce,
  EveDispatchUnknownError,
} from "@/lib/db/eve-dispatch";
import {
  EveUsageReconciliationBusyError,
  eveUsageBusyResponse,
} from "@/lib/eve/usage-reconciliation-busy";
import type { EveMessageInput } from "@/lib/eve/message-input";
import type { EvePrincipal } from "@/lib/eve/principal";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { UiToolName } from "@/lib/ai/types";
import { eveMessageFileKeys } from "@/lib/eve/file-references";
import { frontendToolsSchema } from "@/lib/ai/types";
import { canSpend } from "@/lib/db/credits";
import { env } from "@/lib/env";
import { referenceEveFiles } from "@/lib/db/eve-files";
import { getBoundEveConversationForSession } from "@/lib/db/eve-queries";
import { rejectEveCommand } from "@/lib/eve/command-rejection";
import {
  admitGuestMessage,
  settleGuestMessage,
} from "@/lib/eve/guest-message-admission";
import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { prepareEveMessage } from "@/lib/eve/prepare-message";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { reconcileEveOwnerUsage } from "@/lib/eve/reconcile-usage";
import {
  parseSessionRequest,
  safeStreamQuery,
  sameOrigin,
} from "@/lib/eve/request-policy";
import { eveRequest } from "@/lib/eve/server";
import { relayResponse } from "./relay-response";
import { z } from "zod";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_PAYMENT_REQUIRED = 402;
const NO_QUERY_PARAMETERS = 0;
const COMMAND_TIMEOUT_MS = 30_000;
const rejectRequest = (
  request: { readonly method: string },
  message: string,
  status: number
): Response =>
  // A failed stream read cannot prove that an earlier POST was rejected.
  {
    if (request.method === "POST") {
      return rejectEveCommand(message, status);
    }
    return Response.json({ error: message }, { status });
  };
const checkTurnAdmission = async (
  request: ReadonlyNativeSurface<Request>,
  {
    principal,
    sessionId,
  }: {
    readonly principal: Readonly<EvePrincipal>;
    readonly sessionId: string;
  },
  command: ReadonlyNativeSurface<
    Exclude<Awaited<ReturnType<typeof readCommand>>, Response>
  >
): Promise<Awaited<ReturnType<typeof admitGuestMessage>> | undefined> => {
  if (!command.isNewMessage || command.message === undefined) {
    return undefined;
  }
  if (principal.kind === "guest") {
    return await admitGuestMessage(request, principal.ownerId, sessionId, {
      message: command.message,
      modelId: command.modelId,
      selectedTool: command.selectedTool,
    });
  }
  await reconcileEveOwnerUsage(principal.ownerId, sessionId);
  if (!(await canSpend(principal.ownerId))) {
    return rejectEveCommand("Insufficient credits", HTTP_PAYMENT_REQUIRED);
  }
  return undefined;
};
const selectionsConflict = (
  header: string | null,
  body: string | undefined
): boolean => header !== null && typeof body === "string" && header !== body;
const parseToolSelection = (
  header: string | null,
  body: UiToolName | undefined
): ReturnType<ReturnType<typeof frontendToolsSchema.optional>["safeParse"]> =>
  frontendToolsSchema
    .optional()
    .refine(
      () => header === null || typeof body !== "string" || header === body
    )
    .safeParse(header ?? body);
const readCommand = async (
  request: {
    readonly method: string;
    readonly json: Request["json"];
    readonly headers: { readonly get: (name: string) => string | null };
  },
  policy: {
    readonly schema: Readonly<
      Pick<
        NonNullable<ReturnType<typeof parseSessionRequest>>["schema"],
        "safeParse"
      >
    >;
  },
  {
    conversationId,
    ownerId,
  }: {
    readonly conversationId: string;
    readonly ownerId: string;
  }
): Promise<
  | Response
  | {
      body: string | undefined;
      isNewMessage: boolean;
      message: EveMessageInput | undefined;
      modelId: string | undefined;
      selectedTool: UiToolName | undefined;
    }
> => {
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
      return rejectEveCommand("Invalid command.", HTTP_BAD_REQUEST);
    }
    if ("message" in input.data) {
      ({ message } = input.data);
      const operationId = z
        .uuid()
        .safeParse(request.headers.get(EVE_MESSAGE_OPERATION_HEADER));
      if (!operationId.success) {
        return rejectEveCommand(
          "A message operation ID is required.",
          HTTP_BAD_REQUEST
        );
      }
      const suppliedTool = request.headers.get("x-chatjs-selected-tool");
      const tool = parseToolSelection(suppliedTool, input.data.selectedTool);
      if (!tool.success) {
        return rejectEveCommand(
          "Invalid or conflicting tool selection.",
          HTTP_BAD_REQUEST
        );
      }
      selectedTool = tool.data;
      const selectedModel = request.headers.get("x-chatjs-selected-model");
      if (selectionsConflict(selectedModel, input.data.modelId)) {
        return rejectEveCommand(
          "Conflicting model selection.",
          HTTP_BAD_REQUEST
        );
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
      } catch (error) {
        return rejectEveCommand(
          error instanceof Error ? error.message : "Unable to read attachment.",
          HTTP_BAD_REQUEST
        );
      }
    } else {
      body = JSON.stringify(input.data);
    }
    isNewMessage = "message" in input.data;
  }
  return { body, isNewMessage, message, modelId, selectedTool };
};
const handle = async (
  request: ReadonlyNativeSurface<Request>,
  context: {
    readonly params: Readonly<
      Promise<{
        readonly path: readonly string[];
      }>
    >;
  }
): Promise<Response> => {
  const principal = await resolveEvePrincipal(request.headers);
  if (!principal) {
    return rejectRequest(request, "Sign in to continue.", HTTP_UNAUTHORIZED);
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return rejectRequest(
      request,
      "Request origin is not allowed.",
      HTTP_FORBIDDEN
    );
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
    return rejectRequest(request, "Conversation not found.", HTTP_NOT_FOUND);
  }
  const query = safeStreamQuery(new URL(request.url).searchParams);
  if (
    !query ||
    (request.method !== "GET" && query.size > NO_QUERY_PARAMETERS)
  ) {
    return rejectRequest(request, "Invalid command query.", HTTP_BAD_REQUEST);
  }
  // Capture owner before the conversation getter, matching the original argument order.
  const { ownerId } = principal;
  const command = await readCommand(request, policy, {
    conversationId: conversation.id,
    ownerId,
  });
  if (command instanceof Response) {
    return command;
  }
  const { body, modelId, selectedTool } = command;
  try {
    const admission = await checkTurnAdmission(
      request,
      { principal, sessionId: policy.sessionId },
      command
    );
    if (admission instanceof Response) {
      return admission;
    }
    const dispatch = async (): Promise<Response> => {
      const result = await eveRequest(
        principal.ownerId,
        `/eve/chat/${path.join("/")}${query.size > NO_QUERY_PARAMETERS ? `?${query}` : ""}`,
        {
          body,
          method: request.method,
          // Closing the reader must not cancel a validated command before Eve
          // can durably accept it. Streaming reads still follow browser lifetime.
          signal:
            request.method === "GET"
              ? request.signal
              : AbortSignal.timeout(COMMAND_TIMEOUT_MS),
        },
        modelId,
        selectedTool
      );
      if (admission) {
        await settleGuestMessage(result, principal.ownerId, admission);
      }
      return result;
    };
    if (command.isNewMessage) {
      const operationId = z
        .uuid()
        .parse(request.headers.get(EVE_MESSAGE_OPERATION_HEADER));
      const binding = await dispatchEveOnce(
        {
          ownerId,
          operationId,
          conversationId: conversation.id,
          kind: "send",
          intent: {
            sessionId: policy.sessionId,
            message: command.message,
            modelId: modelId ?? null,
            selectedTool: selectedTool ?? null,
          },
        },
        async () => {
          const result = await dispatch();
          if (!result.ok) {
            throw new EveDispatchUnknownError();
          }
          return z
            .object({
              sessionId: z.literal(policy.sessionId),
              deliveryId: z.string().min(1),
            })
            .parse(await result.json());
        }
      );
      return Response.json(
        { ok: true, status: "accepted", ...binding },
        { headers: { "cache-control": "no-store" } }
      );
    }
    return relayResponse(await dispatch());
  } catch (error) {
    if (error instanceof EveUsageReconciliationBusyError) {
      return eveUsageBusyResponse(error);
    }
    if (error instanceof EveDispatchUnknownError) {
      return Response.json(
        {
          code: "chatjs_delivery_unknown",
          error:
            "Message delivery is unknown. This operation will not be sent again.",
        },
        { status: 502, headers: { "cache-control": "no-store" } }
      );
    }
    return Response.json(
      {
        error:
          "The agent connection was interrupted. Reconnect to check its status; delivery may remain unknown.",
      },
      { status: 502 }
    );
  }
};
const GET = handle;
const POST = handle;
export { GET, POST };
