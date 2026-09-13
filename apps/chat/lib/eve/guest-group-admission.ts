import { createHash } from "node:crypto";

import type { z } from "zod";

import { reserveEveGuestMessages } from "../db/eve-guests";
import { reserveEveResponseGroupInTransaction } from "../db/eve-response-groups";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import { validateGuestCreation } from "./guest-admission";
import type { EvePrincipal } from "./principal";
import { eveResponseGroupCandidates } from "./response-group-candidates";
import type { eveResponseGroupInput } from "./response-group-input";

export async function admitGuestResponseGroup(
  request: Request,
  principal: Extract<EvePrincipal, { kind: "guest" }>,
  input: z.infer<typeof eveResponseGroupInput>
) {
  const candidates = eveResponseGroupCandidates(
    input.operationId,
    input.modelIds
  );
  const inputs: Parameters<typeof reserveEveGuestMessages>[0] = [];
  for (const candidate of candidates) {
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
}
