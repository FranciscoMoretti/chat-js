/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "zod" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
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
// oxlint-disable-next-line sort-imports -- Keep frontend schema initialization before the database/env client graph; graph audit records a changed first-evaluation effect sequence for the sorted alternative.
import { canSpend } from "@/lib/db/credits";
import { env } from "@/lib/env";
import { referenceEveFiles } from "@/lib/db/eve-files";
// oxlint-disable-next-line sort-imports -- Keep file-row/schema initialization before session query schemas; the sorted alternative changes first-evaluation order in the pinned graph audit.
import { getBoundEveConversationForSession } from "@/lib/db/eve-queries";
import { rejectEveCommand } from "@/lib/eve/command-rejection";
// oxlint-disable-next-line sort-imports -- Keep rejection transport before guest-admission config/database initialization; the sorted alternative reverses these effect nodes in the pinned graph audit.
import {
  admitGuestMessage,
  settleGuestMessage,
} from "@/lib/eve/guest-message-admission";
// oxlint-disable-next-line sort-imports -- Keep guest admission before message-delivery schema initialization; swapping reverses config and draft/schema effect nodes in the pinned graph audit.
import {
  EVE_MESSAGE_OPERATION_HEADER,
  eveMessageDeliveryMetadata,
} from "@/lib/eve/message-delivery";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { prepareEveMessage } from "@/lib/eve/prepare-message";
import { resolveEvePrincipal } from "@/lib/eve/principal";
// oxlint-disable-next-line sort-imports -- Keep auth/principal initialization before reconciliation/workflow initialization; the pinned graph audit records the reversed effect sequence.
import { reconcileEveOwnerUsage } from "@/lib/eve/reconcile-usage";
// oxlint-disable-next-line sort-imports -- Keep reconciliation before request-policy schema initialization; the sorted alternative changes their first evaluation sequence in the pinned graph audit.
import {
  parseSessionRequest,
  safeStreamQuery,
  sameOrigin,
} from "@/lib/eve/request-policy";
import { eveRequest } from "@/lib/eve/server";
import { relayResponse } from "./relay-response";
import { z } from "zod";
/* oxlint-enable import/max-dependencies */
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve checkTurnAdmission's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-params, no-undefined -- max-params (#511): checkTurnAdmission keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): checkTurnAdmission uses undefined for absent or optional values; substituting null would alter its type and serialization contract. */
const checkTurnAdmission = async (
  request: ReadonlyNativeSurface<Request>,
  principal: Readonly<EvePrincipal>,
  sessionId: string,
  command: ReadonlyNativeSurface<
    Exclude<Awaited<ReturnType<typeof readCommand>>, Response>
  >
): Promise<Awaited<ReturnType<typeof admitGuestMessage>> | undefined> => {
  if (!command.isNewMessage || command.message === undefined) {
    return;
  }
  if (principal.kind === "guest") {
    // oxlint-disable-next-line typescript/consistent-return -- #580: checkTurnAdmission has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return await admitGuestMessage(request, principal.ownerId, sessionId, {
      message: command.message,
      modelId: command.modelId,
      selectedTool: command.selectedTool,
    });
  }
  await reconcileEveOwnerUsage(principal.ownerId, sessionId);
  if (!(await canSpend(principal.ownerId))) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: checkTurnAdmission has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return rejectEveCommand("Insufficient credits", HTTP_PAYMENT_REQUIRED);
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-params, no-undefined */
/* oxlint-disable no-undefined --
 * no-undefined (#519): selectionsConflict uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const selectionsConflict = (
  header: string | null,
  body: string | undefined
): boolean => header !== null && body !== undefined && header !== body;
/* oxlint-enable no-undefined */
/* oxlint-disable no-undefined -- * no-undefined (#519): parseToolSelection uses undefined for absent or optional values; substituting null would alter its type and serialization contract. */
const parseToolSelection = (
  header: string | null,
  body: UiToolName | undefined
): ReturnType<ReturnType<typeof frontendToolsSchema.optional>["safeParse"]> =>
  frontendToolsSchema
    .optional()
    .refine(() => header === null || body === undefined || header === body)
    .safeParse(header ?? body);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readCommand's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */
/* oxlint-disable init-declarations, max-lines-per-function, max-params, max-statements, unicorn/no-null -- init-declarations (#507): readCommand assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
max-lines-per-function (#510): readCommand keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-params (#511): readCommand keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): readCommand keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): readCommand preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
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
  ownerId: string,
  conversationId: string
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
          messageMetadata: eveMessageDeliveryMetadata(
            operationId.data,
            selectedTool
          ),
        });
      } catch (error) {
        return rejectEveCommand(
          // oxlint-disable-next-line no-ternary -- Keep rejectEveCommand argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handle's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations, max-lines-per-function, max-params, max-statements, unicorn/no-null */
/* oxlint-disable max-lines-per-function, max-statements, no-undefined -- max-lines-per-function (#510): handle keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): handle keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): handle uses undefined for absent or optional values; context: { params: Promise<{ path: string[]; }>; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
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
  // oxlint-disable-next-line no-ternary -- Keep conversation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
      // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      `/eve/chat/${path.join("/")}${query.size > NO_QUERY_PARAMETERS ? `?${query}` : ""}`,
      {
        body,
        method: request.method,
        // Closing the reader must not cancel a validated command before Eve
        // can durably accept it. Streaming reads still follow browser lifetime.
        signal:
          // oxlint-disable-next-line no-ternary -- Keep signal as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    return relayResponse(result);
  } catch (error) {
    if (error instanceof EveUsageReconciliationBusyError) {
      return eveUsageBusyResponse(error);
    }
    return Response.json(
      {
        error:
          "The agent connection was interrupted. Reconnect before retrying.",
      },
      { status: 502 }
    );
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-undefined */
const GET = handle;
const POST = handle;
/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (GET, POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { GET, POST };
/* oxlint-enable import/no-named-export */
