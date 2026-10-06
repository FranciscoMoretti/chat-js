/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "zod" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { frontendToolsSchema } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
import { canSpend } from "@/lib/db/credits";
import { referenceEveFiles } from "@/lib/db/eve-files";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getBoundEveConversationForSession } from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
import { rejectEveCommand } from "@/lib/eve/command-rejection";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveMessageFileKeys } from "@/lib/eve/file-references";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  admitGuestMessage,
  settleGuestMessage,
} from "@/lib/eve/guest-message-admission";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  EVE_MESSAGE_OPERATION_HEADER,
  eveMessageDeliveryMetadata,
} from "@/lib/eve/message-delivery";
/* oxlint-enable sort-imports */
import type { EveMessageInput } from "@/lib/eve/message-input";
import { loadEveModelDefinition } from "@/lib/eve/model-selection";
import { prepareEveMessage } from "@/lib/eve/prepare-message";
import { resolveEvePrincipal } from "@/lib/eve/principal";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EvePrincipal } from "@/lib/eve/principal";
/* oxlint-enable sort-imports */
import { reconcileEveOwnerUsage } from "@/lib/eve/reconcile-usage";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  parseSessionRequest,
  safeStreamQuery,
  sameOrigin,
} from "@/lib/eve/request-policy";
/* oxlint-enable sort-imports */
import { eveRequest } from "@/lib/eve/server";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  EveUsageReconciliationBusyError,
  eveUsageBusyResponse,
} from "@/lib/eve/usage-reconciliation-busy";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): rejectRequest accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const rejectRequest = (
  request: Request,
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-params, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * max-params (#511): checkTurnAdmission keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): checkTurnAdmission uses 402 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): checkTurnAdmission uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep checkTurnAdmission's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): checkTurnAdmission accepts request: Request; principal: EvePrincipal; command: Exclude<Awaited<ReturnType<typeof readCommand>>, Response>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const checkTurnAdmission = async (
  request: Request,
  principal: EvePrincipal,
  sessionId: string,
  command: Exclude<Awaited<ReturnType<typeof readCommand>>, Response>
) => {
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
    return rejectEveCommand("Insufficient credits", 402);
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-params, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-undefined --
 * no-undefined (#519): selectionsConflict uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const selectionsConflict = (
  header: string | null,
  body: string | undefined
): boolean => header !== null && body !== undefined && header !== body;
/* oxlint-enable no-undefined */

/* oxlint-disable no-undefined, typescript/explicit-function-return-type --
 * no-undefined (#519): parseToolSelection uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep parseToolSelection's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const parseToolSelection = (
  header: string | null,
  body: UiToolName | undefined
) =>
  frontendToolsSchema
    .optional()
    .refine(() => header === null || body === undefined || header === body)
    .safeParse(header ?? body);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readCommand's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined, typescript/explicit-function-return-type */

/* oxlint-disable init-declarations, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * init-declarations (#507): readCommand assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): readCommand keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): readCommand keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): readCommand keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): readCommand uses 400 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep readCommand's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readCommand accepts request: Request; policy: NonNullable<ReturnType<typeof parseSessionRequest>>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): readCommand preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const readCommand = async (
  request: Request,
  policy: NonNullable<ReturnType<typeof parseSessionRequest>>,
  ownerId: string,
  conversationId: string
) => {
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
      ({ message } = input.data);
      const operationId = z
        .uuid()
        .safeParse(request.headers.get(EVE_MESSAGE_OPERATION_HEADER));
      if (!operationId.success) {
        return rejectEveCommand("A message operation ID is required.", 400);
      }
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
          messageMetadata: eveMessageDeliveryMetadata(
            operationId.data,
            selectedTool
          ),
        });
      } catch (error) {
        return rejectEveCommand(
          // oxlint-disable-next-line no-ternary -- Keep rejectEveCommand argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          error instanceof Error ? error.message : "Unable to read attachment.",
          400
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
/* oxlint-enable init-declarations, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): handle keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): handle keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): handle uses 401, 403, 404, 0, 400, 30_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): handle uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): handle accepts request: Request; context: { params: Promise<{ path: string[]; }>; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): handle intentionally keeps the existing falsy-value behavior of value; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const handle = async (
  request: Request,
  context: {
    params: Promise<{
      path: string[];
    }>;
  }
): Promise<Response> => {
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
  // oxlint-disable-next-line no-ternary -- Keep conversation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  if (!query || (request.method !== "GET" && query.size > 0)) {
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
      // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      `/eve/chat/${path.join("/")}${query.size > 0 ? `?${query}` : ""}`,
      {
        body,
        method: request.method,
        // Closing the reader must not cancel a validated command before Eve
        // can durably accept it. Streaming reads still follow browser lifetime.
        signal:
          // oxlint-disable-next-line no-ternary -- Keep signal as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    return new Response(result.body, { headers, status: result.status });
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

const GET = handle;

const POST = handle;
/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (GET, POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { GET, POST };
/* oxlint-enable import/no-named-export */
