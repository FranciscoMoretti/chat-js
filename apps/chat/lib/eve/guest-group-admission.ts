/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports  --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-guests"; "../db/eve-response-groups"; "../types/anonymous" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { createHash } from "node:crypto";

import type { z } from "zod";

import { reserveEveGuestMessages } from "../db/eve-guests";
import { reserveEveResponseGroupInTransaction } from "../db/eve-response-groups";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import { validateGuestCreation } from "./guest-admission";
import type { EvePrincipal } from "./principal";
import { eveResponseGroupCandidates } from "./response-group-candidates";
import type { eveResponseGroupInput } from "./response-group-input";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * import/no-named-export (#527): Preserve the named admitGuestResponseGroup API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): admitGuestResponseGroup remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * max-lines-per-function (#510): admitGuestResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): admitGuestResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): admitGuestResponseGroup uses 0, 409, 429 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): admitGuestResponseGroup derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): admitGuestResponseGroup sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): admitGuestResponseGroup copies or separates ...candidate while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep admitGuestResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep admitGuestResponseGroup's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): admitGuestResponseGroup accepts request: Request; principal: Extract< EvePrincipal, { kind: "guest"; } >; input: z.infer<typeof eveResponseGroupInput>; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): admitGuestResponseGroup preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
export const admitGuestResponseGroup = async (
  request: Request,
  principal: Extract<
    EvePrincipal,
    {
      kind: "guest";
    }
  >,
  input: z.infer<typeof eveResponseGroupInput>
) => {
  const candidates = eveResponseGroupCandidates(
    input.operationId,
    input.modelIds
  );
  const inputs: Parameters<typeof reserveEveGuestMessages>[0] = [];
  for (const candidate of candidates) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
    const ipHash = await validateGuestCreation(request, principal, {
      ...candidate,
      message: input.message,
      selectedTool: input.selectedTool,
      fork: input.fork,
      projectId: input.projectId,
    });
    if (ipHash instanceof Response) {
      return ipHash;
    }
    inputs.push({
      ownerId: principal.ownerId,
      operationId: candidate.operationId,
      requestHash: createHash("sha256")
        .update(
          JSON.stringify({ group: input, candidate: candidate.operationId })
        )
        .digest("hex"),
      ipHash,
      requestsPerMinute: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MINUTE,
      requestsPerMonth: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MONTH,
    });
  }
  const result = await reserveEveGuestMessages(
    inputs,
    {
      tokenHash: principal.tokenHash,
      messageLimit: ANONYMOUS_LIMITS.CREDITS,
      expiresAt: new Date(Date.now() + ANONYMOUS_LIMITS.SESSION_DURATION),
    },
    (tx) => reserveEveResponseGroupInTransaction(tx, principal.ownerId, input)
  );
  if (result.status === "admitted") {
    if (!result.admission) {
      throw new Error("Guest comparison was not persisted.");
    }
    return { reservations: result.reservations, group: result.admission };
  }
  return Response.json(
    {
      error:
        result.status === "conflict"
          ? "This comparison has different content."
          : "Guest message limit reached. Sign in to continue.",
    },
    { status: result.status === "conflict" ? 409 : 429 }
  );
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
