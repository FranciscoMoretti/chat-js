/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports  --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types"; "../db/eve-guests"; "../types/anonymous" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { createHash } from "node:crypto";

import { z } from "zod";

import type { UiToolName } from "../ai/types";
import {
  commitEveGuestMessage,
  releaseEveGuestMessage,
  reserveEveGuestMessage,
} from "../db/eve-guests";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import { rejectEveCommand } from "./command-rejection";
import { guestRequestIpHash } from "./guest-admission";
import { EVE_MESSAGE_OPERATION_HEADER } from "./message-delivery";
import type { EveMessageInput } from "./message-input";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable import/group-exports, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): admitGuestMessage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named admitGuestMessage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * init-declarations (#507): admitGuestMessage assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * jsdoc/require-param (#534): admitGuestMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): admitGuestMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): admitGuestMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): admitGuestMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): admitGuestMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): admitGuestMessage uses 400, 403, 503, 429 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): admitGuestMessage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): admitGuestMessage copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep admitGuestMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep admitGuestMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): admitGuestMessage accepts request: Request; input: { message: EveMessageInput; modelId?: string; selectedTool?: UiToolName; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Only the first reservation may dispatch: eve's session POST has no replay key. */
export const admitGuestMessage = async (
  request: Request,
  ownerId: string,
  sessionId: string,
  input: {
    message: EveMessageInput;
    modelId?: string;
    selectedTool?: UiToolName;
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
/* oxlint-enable import/group-exports, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null  --
 * import/group-exports (#523): settleGuestMessage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named settleGuestMessage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): settleGuestMessage uses 409 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): settleGuestMessage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): settleGuestMessage accepts response: Response; admission: { operationId: string; reservationId: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): settleGuestMessage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const settleGuestMessage = async (
  response: Response,
  ownerId: string,
  admission: {
    operationId: string;
    reservationId: string;
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
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */
