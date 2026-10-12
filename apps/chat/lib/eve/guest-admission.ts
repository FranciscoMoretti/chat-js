import {
  commitEveGuestMessage,
  readExistingEveGuestMessage,
  releaseEveGuestCreation,
  reserveEveGuestMessage,
} from "@/lib/db/eve-guests";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import type { EvePrincipal } from "./principal";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { assertEveFilesOwned } from "@/lib/db/eve-files";
import type { createConversationInput } from "./contracts";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { eveGuestIpHash } from "./guest-credential";
import { eveMessageFileKeys } from "./file-references";
import { getEveConversation } from "@/lib/db/eve-queries";
import { isIP } from "node:net";
import { loadEveModelDefinition } from "./model-selection";
import { z } from "zod";

type ReadonlyGuestCreationInput = ReadonlyNativeSurface<
  z.infer<typeof createConversationInput>
>;

const IPV6_VERSION = 6;
const INVALID_IP_VERSION = 0;
const LEADING_BRACKET_LENGTH = 1;
const TRAILING_BRACKET_INDEX = -1;
const IPV4_OCTET_RANGE = 256;
const MAPPED_HIGH_WORD_GROUP = 1;
const MAPPED_LOW_WORD_GROUP = 2;
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY_REQUESTS = 429;

const MAPPED_IP = /^::ffff:(?<high>[0-9a-f]{1,4}):(?<low>[0-9a-f]{1,4})$/u;

/**
 * Hashes a trusted canonical client address; development uses the local address.
 * @param {ReadonlyNativeSurface<Request>} request Request whose configured proxy header supplies the client address outside development.
 * @returns {string} The keyed guest IP hash after mapped IPv6 normalization; unavailable or invalid addresses throw.
 */
const guestRequestIpHash = (
  request: ReadonlyNativeSurface<Request>
): string => {
  if (env.NODE_ENV === "development") {
    return eveGuestIpHash("127.0.0.1", env.AUTH_SECRET);
  }
  // https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
  const header =
    typeof env.VERCEL_URL === "string" && env.VERCEL_URL !== ""
      ? "x-vercel-forwarded-for"
      : env.TRUSTED_CLIENT_IP_HEADER;
  const address =
    typeof header === "string" && header !== ""
      ? (request.headers.get(header) ?? "").trim()
      : "";
  if (
    address === "" ||
    isIP(address) === INVALID_IP_VERSION ||
    address.includes("%")
  ) {
    throw new Error("Trusted client address is unavailable.");
  }
  const canonical =
    isIP(address) === IPV6_VERSION
      ? new URL(`http://[${address}]`).hostname.slice(
          LEADING_BRACKET_LENGTH,
          TRAILING_BRACKET_INDEX
        )
      : address;
  const mapped = MAPPED_IP.exec(canonical);
  const normalized =
    mapped === null
      ? canonical
      : [
          Math.floor(
            Number.parseInt(mapped[MAPPED_HIGH_WORD_GROUP], 16) /
              IPV4_OCTET_RANGE
          ),
          Number.parseInt(mapped[MAPPED_HIGH_WORD_GROUP], 16) %
            IPV4_OCTET_RANGE,
          Math.floor(
            Number.parseInt(mapped[MAPPED_LOW_WORD_GROUP], 16) /
              IPV4_OCTET_RANGE
          ),
          Number.parseInt(mapped[MAPPED_LOW_WORD_GROUP], 16) % IPV4_OCTET_RANGE,
        ].join(".");
  return eveGuestIpHash(normalized, env.AUTH_SECRET);
};

/**
 * Checks guest policy, source ownership, and model/file availability before quota reservation.
 * @param {ReadonlyNativeSurface<Request>} request Request used to resolve the trusted client-address hash.
 * @param {Readonly< Extract< EvePrincipal, { kind: "guest"; } > >} principal Guest ownership and credential identity used for source/file checks.
 * @param {ReadonlyGuestCreationInput} input Creation request whose model, tool, project, fork, and attachments are validated.
 * @returns {Promise<string | Response>} The trusted IP hash, or a response rejecting the request before quota is reserved.
 */
const validateGuestCreation = async (
  request: ReadonlyNativeSurface<Request>,
  principal: Readonly<
    Extract<
      EvePrincipal,
      {
        kind: "guest";
      }
    >
  >,
  input: ReadonlyGuestCreationInput
): Promise<string | Response> => {
  if (
    (typeof input.projectId === "string" && input.projectId !== "") ||
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
        creationRejected: true,
        error: "Sign in to use this model, tool or project.",
      },
      { status: 403 }
    );
  }
  if (input.fork) {
    const source = await getEveConversation(
      principal.ownerId,
      input.fork.conversationId
    );
    if (
      !source ||
      source.state !== "bound" ||
      typeof source.sessionId !== "string" ||
      source.sessionId === ""
    ) {
      return Response.json(
        { creationRejected: true, error: "Source conversation not found." },
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
        creationRejected: true,
        error: "This model or attachment is unavailable.",
      },
      { status: 400 }
    );
  }
  return ipHash;
};

/**
 * Admits a creation under its native operation identity, preserving quota on matching replays.
 * @param {ReadonlyNativeSurface<Request>} request Request used to resolve trusted admission evidence for a new reservation.
 * @param {Readonly< Extract< EvePrincipal, { kind: "guest"; } > >} principal Guest identity whose operation content and session quota are checked.
 * @param {ReadonlyGuestCreationInput} input Original creation request hashed to prevent replaying different operation content.
 * @returns {Promise< | Response | Extract< Awaited<ReturnType<typeof reserveEveGuestMessage>>, { status: "reserved" | "replay" } > >} A reserved/replayed quota identity or an admission error response; follow-up sends use a separate path.
 */
const admitGuestCreation = async (
  request: ReadonlyNativeSurface<Request>,
  principal: Readonly<
    Extract<
      EvePrincipal,
      {
        kind: "guest";
      }
    >
  >,
  input: ReadonlyGuestCreationInput
): Promise<
  | Response
  | Extract<
      Awaited<ReturnType<typeof reserveEveGuestMessage>>,
      { status: "reserved" | "replay" }
    >
> => {
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const existing = await readExistingEveGuestMessage(
    principal.ownerId,
    input.operationId
  );
  if (typeof existing === "object" && existing.state !== "released") {
    if (existing.requestHash !== requestHash) {
      return Response.json(
        { error: "This operation has different content." },
        { status: HTTP_CONFLICT }
      );
    }
    return { reservationId: existing.reservationId, status: "replay" } as const;
  }
  const ipHash = await validateGuestCreation(request, principal, input);
  if (ipHash instanceof Response) {
    return ipHash;
  }
  const reservation = await reserveEveGuestMessage(
    {
      ipHash,
      operationId: input.operationId,
      ownerId: principal.ownerId,
      requestHash,
      requestsPerMinute: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MINUTE,
      requestsPerMonth: ANONYMOUS_LIMITS.RATE_LIMIT.REQUESTS_PER_MONTH,
    },
    {
      expiresAt: new Date(Date.now() + ANONYMOUS_LIMITS.SESSION_DURATION),
      messageLimit: ANONYMOUS_LIMITS.CREDITS,
      tokenHash: principal.tokenHash,
    }
  );
  if (reservation.status === "reserved" || reservation.status === "replay") {
    return reservation;
  }
  return Response.json(
    {
      creationRejected: reservation.status !== "conflict",
      error:
        reservation.status === "conflict"
          ? "This operation has different content."
          : "Guest message limit reached. Sign in to continue.",
    },
    {
      status:
        reservation.status === "conflict"
          ? HTTP_CONFLICT
          : HTTP_TOO_MANY_REQUESTS,
    }
  );
};

const settleGuestCreation = async (
  response: ReadonlyNativeSurface<Response>,
  ownerId: string,
  operationId: string,
  reservationId: string
): Promise<boolean | undefined> => {
  if (response.ok) {
    await commitEveGuestMessage(ownerId, operationId, reservationId);
  } else {
    const result = z.object({ creationRejected: z.literal(true) }).safeParse(
      await response
        .clone()
        .json()
        .catch((): void => {
          // Missing JSON cannot satisfy the required creationRejected object.
        })
    );
    // A terminal rejection of an existing operation does not prove non-admission.
    // Keep ambiguous quota through deletion and failures to commit the accepted turn.
    if (result.success) {
      return await releaseEveGuestCreation(ownerId, operationId, reservationId);
    }
  }
  return undefined;
};
export {
  admitGuestCreation,
  guestRequestIpHash,
  settleGuestCreation,
  validateGuestCreation,
};
