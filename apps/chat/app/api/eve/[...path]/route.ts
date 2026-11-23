import { EveWorkspaceBusyError } from "@/lib/db/eve-workspace-turns";
import {
  dispatchEveOnce,
  withEveCopyCaptureFence,
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
import { canStartPaidTurn } from "@/lib/eve/spending-admission";
import { env } from "@/lib/env";
import { referenceEveFiles } from "@/lib/db/eve-files";
import { getBoundEveConversationForSession } from "@/lib/db/eve-queries";
import { rejectEveCommand } from "@/lib/eve/command-rejection";
import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { prepareEveMessage } from "@/lib/eve/prepare-message";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import {
  activeResponseModel,
  responseModelReferences,
} from "@/lib/eve/response-model";
import {
  parseSessionRequest,
  safeStreamQuery,
  sameOrigin,
} from "@/lib/eve/request-policy";
import { eveRequest } from "@/lib/eve/server";
import { EveSteerRejectedError } from "@/lib/eve/steer-rejected";
import { relayResponse } from "./relay-response";
import { Client, conversationOf } from "eve/client";
import { z } from "zod";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_PAYMENT_REQUIRED = 402;
const NO_QUERY_PARAMETERS = 0;
const COMMAND_TIMEOUT_MS = 30_000;
const ATTACHMENT_MODEL_TIMEOUT_MS = 5000;
const NATIVE_SESSION_CONFLICT = 409;
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
): Promise<Response | undefined> => {
  if (!command.isNewMessage || command.message === undefined) {
    return undefined;
  }
  if (!(await canStartPaidTurn(principal.ownerId, sessionId))) {
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

const steeringAttachmentModel = async (
  ownerId: string,
  sessionId: string,
  fileKeys: readonly string[]
): Promise<string | undefined> => {
  if (fileKeys.length === 0) {
    return undefined;
  }
  const client = new Client(getEveConnectionOptions(ownerId));
  const { events } = await client.sessions
    .attach(sessionId)
    .snapshot({ signal: AbortSignal.timeout(ATTACHMENT_MODEL_TIMEOUT_MS) });
  const modelId = activeResponseModel(
    conversationOf(events).view,
    responseModelReferences(events)
  );
  if (modelId === undefined) {
    throw new Error("Wait for the active model before sending attachments.");
  }
  return modelId;
};

const readSteerRejection = async (
  response: ReadonlyNativeSurface<Response>
): Promise<string | undefined> => {
  if (
    response.status !== HTTP_BAD_REQUEST &&
    response.status !== NATIVE_SESSION_CONFLICT
  ) {
    return undefined;
  }
  const body = z
    .object({
      ok: z.literal(false),
      error: z.string(),
      code: z.string().optional(),
    })
    .safeParse(await response.json().catch(() => null));
  if (
    body.success &&
    (response.status === HTTP_BAD_REQUEST ||
      body.data.code === "session_not_active" ||
      body.data.code === "session_not_ready" ||
      body.data.code === "session_stranded")
  ) {
    return body.data.error;
  }
  return undefined;
};

const prepareSteerBody = async (
  message: ReadonlyNativeSurface<EveMessageInput>,
  ownerId: string,
  conversationId: string,
  sessionId: string
): Promise<string> => {
  try {
    const fileKeys = eveMessageFileKeys(message);
    const modelId = await steeringAttachmentModel(ownerId, sessionId, fileKeys);
    await referenceEveFiles(ownerId, conversationId, fileKeys);
    return JSON.stringify({
      message: await prepareEveMessage(message, modelId),
      turnPolicy: "steer",
    });
  } catch (error) {
    throw new EveSteerRejectedError(
      error instanceof Error ? error.message : "Unable to read attachment."
    );
  }
};

const readCommand = async (
  request: {
    readonly method: string;
    readonly json: Request["json"];
    readonly headers: { readonly get: (name: string) => string | null };
  },
  policy: {
    readonly sessionId: string;
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
      turnPolicy: "steer" | undefined;
      steerSessionId: string | undefined;
    }
> => {
  let body: string | undefined;
  let isNewMessage = false;
  let message: EveMessageInput | undefined;
  let modelId: string | undefined;
  let selectedTool: UiToolName | undefined;
  let turnPolicy: "steer" | undefined;
  if (request.method === "POST") {
    const input = policy.schema.safeParse(
      await request.json().catch(() => null)
    );
    if (!input.success) {
      return rejectEveCommand("Invalid command.", HTTP_BAD_REQUEST);
    }
    if ("message" in input.data) {
      ({ message, turnPolicy } = input.data);
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
      if (turnPolicy === undefined) {
        try {
          await loadEveModelDefinition(modelId);
          await referenceEveFiles(
            ownerId,
            conversationId,
            eveMessageFileKeys(message)
          );
          body = JSON.stringify({
            message: await prepareEveMessage(message, modelId),
          });
        } catch (error) {
          return rejectEveCommand(
            error instanceof Error
              ? error.message
              : "Unable to read attachment.",
            HTTP_BAD_REQUEST
          );
        }
      }
    } else {
      body = JSON.stringify(input.data);
    }
    isNewMessage = "message" in input.data;
  }
  const turnOptions =
    turnPolicy === undefined
      ? { modelId, selectedTool }
      : { modelId: undefined, selectedTool: undefined };
  return {
    body,
    isNewMessage,
    message,
    ...turnOptions,
    turnPolicy,
    steerSessionId: turnPolicy === "steer" ? policy.sessionId : undefined,
  };
};
const commandFailureResponse = (error: unknown): Response => {
  if (error instanceof EveWorkspaceBusyError) {
    return rejectEveCommand(error.message, 409);
  }
  if (error instanceof EveUsageReconciliationBusyError) {
    return eveUsageBusyResponse(error);
  }
  if (error instanceof EveSteerRejectedError) {
    return rejectEveCommand(error.message, HTTP_BAD_REQUEST);
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
  const { body, modelId, selectedTool, steerSessionId, turnPolicy } = command;
  try {
    const admission = await checkTurnAdmission(
      { principal, sessionId: policy.sessionId },
      command
    );
    if (admission instanceof Response) {
      return admission;
    }
    const dispatch = async (dispatchBody = body): Promise<Response> => {
      const result = await eveRequest(
        principal.ownerId,
        `/eve/chat/${path.join("/")}${query.size > NO_QUERY_PARAMETERS ? `?${query}` : ""}`,
        {
          body: dispatchBody,
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
          steerSessionId,
          intent: {
            sessionId: policy.sessionId,
            message: command.message,
            modelId: modelId ?? null,
            selectedTool: selectedTool ?? null,
            turnPolicy,
          },
        },
        async () => {
          const { message } = command;
          const result = await dispatch(
            turnPolicy === "steer" && message !== undefined
              ? await prepareSteerBody(
                  message,
                  ownerId,
                  conversation.id,
                  policy.sessionId
                )
              : body
          );
          if (!result.ok) {
            const rejection =
              turnPolicy === "steer"
                ? await readSteerRejection(result)
                : undefined;
            if (rejection !== undefined) {
              throw new EveSteerRejectedError(rejection);
            }
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
    return relayResponse(
      await (request.method === "GET"
        ? dispatch()
        : withEveCopyCaptureFence(ownerId, async () => await dispatch()))
    );
  } catch (error) {
    return commandFailureResponse(error);
  }
};

const GET = handle;
const POST = handle;
export { GET, POST };
