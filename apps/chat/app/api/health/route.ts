import { z } from "zod";

import { checkDatabase } from "@/lib/db/health";
import { env } from "@/lib/env";

const eveHealth = z.object({
  ok: z.literal(true),
  status: z.literal("ready"),
  workflowId: z.string().min(1),
});

export const GET = async () => {
  // A bounded local readiness probe, not a public infrastructure inventory.
  if (env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([
        checkDatabase(),
        fetch(new URL("/eve/v1/health", env.EVE_INTERNAL_ORIGIN), {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(4000),
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
