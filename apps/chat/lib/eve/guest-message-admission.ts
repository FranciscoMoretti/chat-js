/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { createHash } from "node:crypto";

import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  commitEveGuestMessage,
  releaseEveGuestMessage,
  reserveEveGuestMessage,
} from "@/lib/db/eve-guests";
/* oxlint-enable sort-imports */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
/* oxlint-enable sort-imports */

import { rejectEveCommand } from "./command-rejection";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { guestRequestIpHash } from "./guest-admission";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EVE_MESSAGE_OPERATION_HEADER } from "./message-delivery";
/* oxlint-enable sort-imports */
import type { ReadonlyEveMessageInput } from "./readonly-message-types";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve admitGuestMessage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- init-declarations (#507): admitGuestMessage assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
jsdoc/require-param (#534): admitGuestMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): admitGuestMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): admitGuestMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-params (#511): admitGuestMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): admitGuestMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): admitGuestMessage uses 400, 403, 503, 429 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep admitGuestMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep admitGuestMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
/** Only the first reservation may dispatch: eve's session POST has no replay key. */
const admitGuestMessage = async (
  request: ReadonlyNativeSurface<Request>,
  ownerId: string,
  sessionId: string,
  input: {
    readonly message: ReadonlyEveMessageInput;
    readonly modelId?: string;
    readonly selectedTool?: UiToolName;
  }
) => {
  const operationId = z
    .uuid()
    .safeParse(request.headers.get(EVE_MESSAGE_OPERATION_HEADER));
  if (!operationId.success) {
    return rejectEveCommand("A message operation ID is required.", 400);
  }
  if (
    !ANONYMOUS_LIMITS.AVAILABLE_MODELS.some(
      (model) => model === input.modelId
    ) ||
    (input.selectedTool &&
      !ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some(
        (tool) => tool === input.selectedTool
      ))
  ) {
    return rejectEveCommand("Sign in to use this model or tool.", 403);
  }
  let ipHash: string;
  try {
    ipHash = guestRequestIpHash(request);
  } catch {
    return rejectEveCommand("Guest admission is unavailable.", 503);
  }
  const result = await reserveEveGuestMessage({
    ownerId,
    operationId: operationId.data,
    requestHash: createHash("sha256")
      .update(JSON.stringify({ kind: "message", sessionId, ...input }))
      .digest("hex"),
    ipHash,
    requestsPerMinute: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MINUTE,
    requestsPerMonth: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MONTH,
  });
  if (result.status === "reserved") {
    return {
      operationId: operationId.data,
      reservationId: result.reservationId,
    };
  }
  if (result.status === "replay" || result.status === "conflict") {
    // This is deliberately not chatjs_command_rejected: the original may have run.
    return Response.json(
      {
        error:
          "This message operation already exists. Reconnect before sending again.",
        code: "chatjs_message_operation_exists",
      },
      { status: 409 }
    );
  }
  return rejectEveCommand(
    "Guest message limit reached. Sign in to continue.",
    429
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve settleGuestMessage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable no-magic-numbers, unicorn/no-null -- no-magic-numbers (#517): settleGuestMessage uses 409 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
unicorn/no-null (#570): settleGuestMessage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const settleGuestMessage = async (
  response: ReadonlyNativeSurface<Response>,
  ownerId: string,
  admission: {
    readonly operationId: string;
    readonly reservationId: string;
  }
): Promise<void> => {
  if (response.ok) {
    await commitEveGuestMessage(
      ownerId,
      admission.operationId,
      admission.reservationId
    );
    return;
  }
  // Native dispatch explicitly reports a session that never admitted the command.
  const inactive =
    response.status === 409 &&
    z.object({ code: z.literal("session_not_active") }).safeParse(
      await response
        .clone()
        .json()
        .catch(() => null)
    ).success;
  if (inactive) {
    await releaseEveGuestMessage(
      ownerId,
      admission.operationId,
      admission.reservationId
    );
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (admitGuestMessage, settleGuestMessage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, unicorn/no-null */
export { admitGuestMessage, settleGuestMessage };
/* oxlint-enable import/no-named-export */
