import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

import { checkDatabase } from "@/lib/db/health";
import { eveAgents } from "@/eve-runtime.config";
import { env } from "@/lib/env";

const MINIMUM_WORKFLOW_ID_LENGTH = 1;
const EVE_HEALTH_TIMEOUT_MS = 4000;
const READINESS_TIMEOUT_MS = 4500;

const eveHealth = z.object({
  ok: z.literal(true),
  status: z.literal("ready"),
  workflowId: z.string().min(MINIMUM_WORKFLOW_ID_LENGTH),
});

export const GET = async (): Promise<Response> => {
  // Public readiness reveals no database, agent or credential details.
  // Every configured worker must be ready before the host sends traffic.
  const timeout = new AbortController();
  try {
    await Promise.race([
      Promise.all([
        checkDatabase(),
        ...Object.keys(eveAgents).map(async (agent) => {
          const response = await fetch(
            new URL(`/eve/${agent}/v1/health`, env.EVE_INTERNAL_ORIGIN),
            {
              cache: "no-store",
              redirect: "error",
              signal: AbortSignal.timeout(EVE_HEALTH_TIMEOUT_MS),
            }
          );
          if (!response.ok) {
            throw new Error("Eve unavailable");
          }
          eveHealth.parse(await response.json());
        }),
      ]),
      (async () => {
        await delay(READINESS_TIMEOUT_MS, null, { signal: timeout.signal });
        throw new Error("Readiness timed out");
      })(),
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
    timeout.abort();
  }
};
