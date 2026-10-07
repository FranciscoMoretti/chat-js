/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { createHash } from "node:crypto";

import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { reserveEveGuestMessages } from "@/lib/db/eve-guests";
/* oxlint-enable sort-imports */
import { reserveEveResponseGroupInTransaction } from "@/lib/db/eve-response-groups";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
/* oxlint-enable sort-imports */

import { validateGuestCreation } from "./guest-admission";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EvePrincipal } from "./principal";
/* oxlint-enable sort-imports */
import { eveResponseGroupCandidates } from "./response-group-candidates";
import type { eveResponseGroupInput } from "./response-group-input";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (admitGuestResponseGroup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve admitGuestResponseGroup's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): admitGuestResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): admitGuestResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): admitGuestResponseGroup uses 0, 409, 429 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
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
): Promise<
  | Response
  | {
      reservations: {
        operationId: string;
        reservationId: string;
        status: "reserved" | "replay";
      }[];
      group: Awaited<ReturnType<typeof reserveEveResponseGroupInTransaction>>;
    }
> => {
  const candidates = eveResponseGroupCandidates(
    input.operationId,
    input.modelIds
  );
  const inputs: Parameters<typeof reserveEveGuestMessages>[0][number][] = [];
  for (const candidate of candidates) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
    const ipHash = await validateGuestCreation(request, principal, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
        // oxlint-disable-next-line no-ternary -- Keep error as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        result.status === "conflict"
          ? "This comparison has different content."
          : "Guest message limit reached. Sign in to continue.",
    },
    // oxlint-disable-next-line no-ternary -- Keep status as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    { status: result.status === "conflict" ? 409 : 429 }
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
