import type { EvePrincipal } from "./principal";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createHash } from "node:crypto";
import { eveResponseGroupCandidates } from "./response-group-candidates";
import type { eveResponseGroupInput } from "./response-group-input";
import { reserveEveGuestMessages } from "@/lib/db/eve-guests";
import { reserveEveResponseGroupInTransaction } from "@/lib/db/eve-response-groups";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { validateGuestCreation } from "./guest-admission";
import type { z } from "zod";

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
  const ipHash = await validateGuestCreation(request, principal, input);
  if (ipHash instanceof Response) {
    return ipHash;
  }
  const inputs = candidates.map((candidate) => ({
    ipHash,
    operationId: candidate.operationId,
    ownerId: principal.ownerId,
    requestHash: createHash("sha256")
      .update(
        JSON.stringify({ group: input, candidate: candidate.operationId })
      )
      .digest("hex"),
    requestsPerMinute: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MINUTE,
    requestsPerMonth: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MONTH,
  }));
  const result = await reserveEveGuestMessages(
    inputs,
    {
      expiresAt: new Date(Date.now() + ANONYMOUS_LIMITS.SESSION_DURATION),
      messageLimit: ANONYMOUS_LIMITS.CREDITS,
      tokenHash: principal.tokenHash,
    },
    async (tx) =>
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
        result.status === "conflict"
          ? "This comparison has different content."
          : "Guest message limit reached. Sign in to continue.",
    },
    { status: result.status === "conflict" ? 409 : 429 }
  );
};
