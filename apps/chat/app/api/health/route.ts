import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { checkDatabase } from "@/lib/db/health";
/* oxlint-enable sort-imports */
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

/* oxlint-disable init-declarations, no-magic-numbers --
 * init-declarations (#507): GET assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * no-magic-numbers (#517): GET uses 4000, 4500 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const GET = async (): Promise<Response> => {
  // Public readiness reveals no database, agent or credential details.
  // Both workers must be ready before the host sends traffic to this instance.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([
        checkDatabase(),
        ...["chat", "guest"].map(async (agent) => {
          const response = await fetch(
            new URL(`/eve/${agent}/v1/health`, env.EVE_INTERNAL_ORIGIN),
            {
              cache: "no-store",
              redirect: "error",
              signal: AbortSignal.timeout(4000),
            }
          );
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
/* oxlint-enable init-declarations, no-magic-numbers */
