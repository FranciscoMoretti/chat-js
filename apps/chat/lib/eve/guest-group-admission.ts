/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */

import type { EvePrincipal } from "./principal";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createHash } from "node:crypto";
import { eveResponseGroupCandidates } from "./response-group-candidates";
import type { eveResponseGroupInput } from "./response-group-input";
import { reserveEveGuestMessages } from "@/lib/db/eve-guests";
import { reserveEveResponseGroupInTransaction } from "@/lib/db/eve-response-groups";
// oxlint-disable-next-line sort-imports -- eve-guests initializes env and the PostgreSQL client before anonymous.ts runs config.applyDefaults; preserve that validation/allocation order.
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { validateGuestCreation } from "./guest-admission";
import type { z } from "zod";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (admitGuestResponseGroup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve admitGuestResponseGroup's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers -- * max-lines-per-function (#510): admitGuestResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): admitGuestResponseGroup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): admitGuestResponseGroup uses 0, 409, 429 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
export const admitGuestResponseGroup = async (
  request: ReadonlyNativeSurface<Request>,
  principal: Readonly<
    Extract<
      EvePrincipal,
      {
        readonly kind: "guest";
      }
    >
  >,
  input: ReadonlyNativeSurface<z.infer<typeof eveResponseGroupInput>>
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
      fork: input.fork,
      message: input.message,
      projectId: input.projectId,
      selectedTool: input.selectedTool,
    });
    if (ipHash instanceof Response) {
      return ipHash;
    }
    inputs.push({
      ipHash,
      operationId: candidate.operationId,
      ownerId: principal.ownerId,
      requestHash: createHash("sha256")
        .update(
          // oxlint-disable-next-line sort-keys -- The persisted requestHash is SHA-256 of these exact JSON bytes: group must precede candidate for replay identity.
          JSON.stringify({ group: input, candidate: candidate.operationId })
        )
        .digest("hex"),
      requestsPerMinute: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MINUTE,
      requestsPerMonth: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MONTH,
    });
  }
  const result = await reserveEveGuestMessages(
    inputs,
    {
      expiresAt: new Date(Date.now() + ANONYMOUS_LIMITS.SESSION_DURATION),
      messageLimit: ANONYMOUS_LIMITS.CREDITS,
      tokenHash: principal.tokenHash,
    },
    async (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- A native readonly projection is rejected here with TS2345: PgTransaction requires protected schema and nestedIndex, which mapped ReadonlyNativeSurface omits. Forward the original transaction to the row writer.
      tx
    ) =>
      await reserveEveResponseGroupInTransaction(tx, principal.ownerId, input)
  );
  if (result.status === "admitted") {
    if (!result.admission) {
      throw new Error("Guest comparison was not persisted.");
    }
    return { group: result.admission, reservations: result.reservations };
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */
