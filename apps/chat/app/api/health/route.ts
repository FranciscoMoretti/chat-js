import { z } from "zod";
import { checkDatabase } from "@/lib/db/health";
import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";

const eveHealth = z.object({
  ok: z.literal(true),
  status: z.literal("ready"),
  workflowId: z.string().min(1),
});

export async function GET() {
  // A bounded local readiness probe, not a public infrastructure inventory.
  if (env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([
        checkDatabase(),
        isEveEnabled()
          ? fetch(new URL("/eve/v1/health", env.EVE_INTERNAL_ORIGIN), {
              signal: AbortSignal.timeout(4000),
              cache: "no-store",
              redirect: "error",
            }).then(async (response) => {
              if (!response.ok) {
                throw new Error("Eve unavailable");
              }
              eveHealth.parse(await response.json());
            })
          : Promise.resolve(),
      ]),
      new Promise<never>((_, reject) => {
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
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  } finally {
    clearTimeout(timeout);
  }
}
