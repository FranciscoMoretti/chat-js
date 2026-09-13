import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { assertEveFilesOwned } from "../db/eve-files";
import {
  commitEveGuestMessage,
  readExistingEveGuestMessage,
  releaseEveGuestCreation,
  reserveEveGuestMessage,
} from "../db/eve-guests";
import { getEveConversation } from "../db/eve-queries";
import { env } from "../env";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import type { createConversationInput } from "./contracts";
import { eveMessageFileKeys } from "./file-references";
import { eveGuestIpHash } from "./guest-credential";
import { loadEveModelDefinition } from "./model-selection";
import type { EvePrincipal } from "./principal";

const MAPPED_IP = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;

/** Development never trusts caller-supplied forwarding headers. */
export function guestRequestIpHash(request: Request) {
  if (env.NODE_ENV === "development") {
    return eveGuestIpHash("127.0.0.1", env.AUTH_SECRET);
  }
  // https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
  const address = env.VERCEL_URL
    ? request.headers.get("x-vercel-forwarded-for")?.trim()
    : undefined;
  if (!(address && isIP(address)) || address.includes("%")) {
    throw new Error("Trusted client address is unavailable.");
  }
  const canonical =
    isIP(address) === 6
      ? new URL(`http://[${address}]`).hostname.slice(1, -1)
      : address;
  const mapped = MAPPED_IP.exec(canonical);
  const normalized = mapped
    ? [
        Math.floor(Number.parseInt(mapped[1], 16) / 256),
        Number.parseInt(mapped[1], 16) % 256,
        Math.floor(Number.parseInt(mapped[2], 16) / 256),
        Number.parseInt(mapped[2], 16) % 256,
      ].join(".")
    : canonical;
  return eveGuestIpHash(normalized, env.AUTH_SECRET);
}

/** Checks guest policy and ownership before reserving quota. */
export async function validateGuestCreation(
  request: Request,
  principal: Extract<EvePrincipal, { kind: "guest" }>,
  input: z.infer<typeof createConversationInput>
) {
  if (
    input.projectId ||
    !ANONYMOUS_LIMITS.AVAILABLE_MODELS.some(
      (model) => model === input.modelId
    ) ||
    (input.selectedTool &&
      !ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some(
        (tool) => tool === input.selectedTool
      ))
  ) {
    return Response.json(
      {
        error: "Sign in to use this model, tool or project.",
        creationRejected: true,
      },
      { status: 403 }
    );
  }
  if (input.fork) {
    const source = await getEveConversation(
      principal.ownerId,
      input.fork.conversationId
    );
    if (source?.state !== "bound" || !source.sessionId) {
      return Response.json(
        { error: "Source conversation not found.", creationRejected: true },
        { status: 404 }
      );
    }
  }
  let ipHash: string;
  try {
    ipHash = guestRequestIpHash(request);
  } catch {
    return Response.json(
      { error: "Guest admission is unavailable." },
      { status: 503 }
    );
  }
  try {
    await loadEveModelDefinition(input.modelId);
    await assertEveFilesOwned(
      principal.ownerId,
      eveMessageFileKeys(input.message)
    );
  } catch {
    return Response.json(
      {
        error: "This model or attachment is unavailable.",
        creationRejected: true,
      },
      { status: 400 }
    );
  }
  return ipHash;
}

/** Creation replays use eve's native operation ID; this must not wrap raw follow-up sends. */
export async function admitGuestCreation(
  request: Request,
  principal: Extract<EvePrincipal, { kind: "guest" }>,
  input: z.infer<typeof createConversationInput>
) {
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const existing = await readExistingEveGuestMessage(
    principal.ownerId,
    input.operationId
  );
  if (existing && existing.state !== "released") {
    if (existing.requestHash !== requestHash) {
      return Response.json(
        { error: "This operation has different content." },
        { status: 409 }
      );
    }
    return { status: "replay", reservationId: existing.reservationId } as const;
  }
  const ipHash = await validateGuestCreation(request, principal, input);
  if (ipHash instanceof Response) {
    return ipHash;
  }
  const reservation = await reserveEveGuestMessage(
    {
      ownerId: principal.ownerId,
      operationId: input.operationId,
      requestHash,
      ipHash,
      requestsPerMinute: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MINUTE,
      requestsPerMonth: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MONTH,
    },
    {
      tokenHash: principal.tokenHash,
      messageLimit: ANONYMOUS_LIMITS.CREDITS,
      expiresAt: new Date(Date.now() + ANONYMOUS_LIMITS.SESSION_DURATION),
    }
  );
  if (reservation.status === "reserved" || reservation.status === "replay") {
    return reservation;
  }
  return Response.json(
    {
      error:
        reservation.status === "conflict"
          ? "This operation has different content."
          : "Guest message limit reached. Sign in to continue.",
      creationRejected: reservation.status !== "conflict",
    },
    {
      status: reservation.status === "conflict" ? 409 : 429,
    }
  );
}

export async function settleGuestCreation(
  response: Response,
  ownerId: string,
  operationId: string,
  reservationId: string
) {
  if (response.ok) {
    await commitEveGuestMessage(ownerId, operationId, reservationId);
  } else {
    const result = z.object({ creationRejected: z.literal(true) }).safeParse(
      await response
        .clone()
        .json()
        .catch(() => null)
    );
    // A terminal rejection of an existing operation does not prove non-admission.
    // Keep ambiguous quota through deletion and failures to commit the accepted turn.
    if (result.success) {
      return await releaseEveGuestCreation(ownerId, operationId, reservationId);
    }
  }
}
