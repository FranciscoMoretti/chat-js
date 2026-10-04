/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:crypto" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; import { isIP } from "node:net";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-files"; "../db/eve-guests"; "../db/eve-queries"; "../env"; "../types/anonymous" dependency within this package instead of introducing an alias or barrel API.
 */
import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { z } from "zod";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

type ReadonlyGuestCreationInput = ReadonlyNativeSurface<
  z.infer<typeof createConversationInput>
>;

const IPV6_VERSION = 6;
const LEADING_BRACKET_LENGTH = 1;
const TRAILING_BRACKET_INDEX = -1;
const IPV4_OCTET_RANGE = 256;
const MAPPED_HIGH_WORD_GROUP = 1;
const MAPPED_LOW_WORD_GROUP = 2;
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY_REQUESTS = 429;

const MAPPED_IP = /^::ffff:(?<high>[0-9a-f]{1,4}):(?<low>[0-9a-f]{1,4})$/u;

/* oxlint-disable no-undefined, typescript/strict-boolean-expressions --no-undefined (#519): guestRequestIpHash uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): guestRequestIpHash intentionally keeps the existing falsy-value behavior of env.VERCEL_URL; header; address; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Hashes a trusted canonical client address; development uses the local address.
 * @param request Request whose configured proxy header supplies the client address outside development.
 * @returns The keyed guest IP hash after mapped IPv6 normalization; unavailable or invalid addresses throw.
 */
const guestRequestIpHash = (
  request: ReadonlyNativeSurface<Request>
): string => {
  if (env.NODE_ENV === "development") {
    return eveGuestIpHash("127.0.0.1", env.AUTH_SECRET);
  }
  // https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
  const header = env.VERCEL_URL
    ? "x-vercel-forwarded-for"
    : env.TRUSTED_CLIENT_IP_HEADER;
  const address = header ? request.headers.get(header)?.trim() : undefined;
  if (!(address && isIP(address)) || address.includes("%")) {
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
  const normalized = mapped
    ? [
        Math.floor(
          Number.parseInt(mapped[MAPPED_HIGH_WORD_GROUP], 16) / IPV4_OCTET_RANGE
        ),
        Number.parseInt(mapped[MAPPED_HIGH_WORD_GROUP], 16) % IPV4_OCTET_RANGE,
        Math.floor(
          Number.parseInt(mapped[MAPPED_LOW_WORD_GROUP], 16) / IPV4_OCTET_RANGE
        ),
        Number.parseInt(mapped[MAPPED_LOW_WORD_GROUP], 16) % IPV4_OCTET_RANGE,
      ].join(".")
    : canonical;
  return eveGuestIpHash(normalized, env.AUTH_SECRET);
};
/* oxlint-enable no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, typescript/strict-boolean-expressions -- init-declarations (#507): validateGuestCreation assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
max-lines-per-function (#510): validateGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): validateGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/strict-boolean-expressions (#610): validateGuestCreation intentionally keeps the existing falsy-value behavior of input.projectId; source.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Checks guest policy, source ownership, and model/file availability before quota reservation.
 * @param request Request used to resolve the trusted client-address hash.
 * @param principal Guest ownership and credential identity used for source/file checks.
 * @param input Creation request whose model, tool, project, fork, and attachments are validated.
 * @returns The trusted IP hash, or a response rejecting the request before quota is reserved.
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
    if (source?.state !== "bound" || !source.sessionId) {
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
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, typescript/strict-boolean-expressions --max-lines-per-function (#510): admitGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): admitGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/strict-boolean-expressions (#610): admitGuestCreation intentionally keeps the existing falsy-value behavior of existing; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Admits a creation under its native operation identity, preserving quota on matching replays.
 * @param request Request used to resolve trusted admission evidence for a new reservation.
 * @param principal Guest identity whose operation content and session quota are checked.
 * @param input Original creation request hashed to prevent replaying different operation content.
 * @returns A reserved/replayed quota identity or an admission error response; follow-up sends use a separate path.
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
  if (existing && existing.state !== "released") {
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
/* oxlint-enable max-lines-per-function, max-statements, typescript/strict-boolean-expressions */

/* oxlint-disable max-params -- max-params (#511): settleGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
// oxlint-disable-next-line typescript/consistent-return -- #580: settleGuestCreation has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
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
};
/* oxlint-enable max-params */
export {
  admitGuestCreation,
  guestRequestIpHash,
  settleGuestCreation,
  validateGuestCreation,
};
