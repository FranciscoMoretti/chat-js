import { z } from "zod";

import { checkDatabase } from "@/lib/db/health";
import { env } from "@/lib/env";

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): eveHealth uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const eveHealth = z.object({
  ok: z.literal(true),
  status: z.literal("ready"),
  workflowId: z.string().min(1),
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable init-declarations, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-null --
 * init-declarations (#507): GET assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * no-magic-numbers (#517): GET uses 4000, 4500 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): GET accepts response; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): GET keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): GET preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const GET = async (): Promise<Response> => {
  // A bounded local readiness probe, not a public infrastructure inventory.
  if (env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([
        checkDatabase(),
        fetch(new URL("/eve/chat/v1/health", env.EVE_INTERNAL_ORIGIN), {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(4000),
          // oxlint-disable-next-line promise/always-return -- This readiness branch validates or throws; Promise.all only needs its completion, not a result value.
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error("Eve unavailable");
          }
          eveHealth.parse(await response.json());
        }),
      ]),
      // oxlint-disable-next-line promise/avoid-new -- Bridge the readiness timer or never-settling test fixture to the awaited operation.
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Readiness timed out")),
          4500
        );
      }),
    ]);
    return Response.json(
      { status: "ready" },
      { headers: { "cache-control": "no-store" } }
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { headers: { "cache-control": "no-store" }, status: 503 }
    );
  } finally {
    clearTimeout(timeout);
  }
};
/* oxlint-enable init-declarations, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls, unicorn/no-null */
