/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:crypto" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; import { isIP } from "node:net";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-files"; "../db/eve-guests"; "../db/eve-queries"; "../env"; "../types/anonymous" dependency within this package instead of introducing an alias or barrel API.
 */
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
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

const MAPPED_IP = /^::ffff:(?<high>[0-9a-f]{1,4}):(?<low>[0-9a-f]{1,4})$/u;

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): guestRequestIpHash's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): guestRequestIpHash's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
no-magic-numbers (#517): guestRequestIpHash uses 6, 1, -1, 256, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): guestRequestIpHash uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/prefer-readonly-parameter-types (#565): guestRequestIpHash accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): guestRequestIpHash intentionally keeps the existing falsy-value behavior of env.VERCEL_URL; header; address; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Development never trusts caller-supplied forwarding headers. */
const guestRequestIpHash = (request: Request): string => {
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
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- init-declarations (#507): validateGuestCreation assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
jsdoc/require-param (#534): validateGuestCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): validateGuestCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): validateGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): validateGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/explicit-function-return-type (#560): Keep validateGuestCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep validateGuestCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): validateGuestCreation accepts request: Request; principal: Extract< EvePrincipal, { kind: "guest"; } >; input: z.infer<typeof createConversationInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): validateGuestCreation intentionally keeps the existing falsy-value behavior of input.projectId; source.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Checks guest policy and ownership before reserving quota. */
const validateGuestCreation = async (
  request: Request,
  principal: Extract<
    EvePrincipal,
    {
      kind: "guest";
    }
  >,
  input: z.infer<typeof createConversationInput>
) => {
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
/* oxlint-enable init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): admitGuestCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): admitGuestCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): admitGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): admitGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): admitGuestCreation uses 409, 429 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep admitGuestCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep admitGuestCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): admitGuestCreation accepts request: Request; principal: Extract< EvePrincipal, { kind: "guest"; } >; input: z.infer<typeof createConversationInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): admitGuestCreation intentionally keeps the existing falsy-value behavior of existing; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Creation replays use eve's native operation ID; this must not wrap raw follow-up sends. */
const admitGuestCreation = async (
  request: Request,
  principal: Extract<
    EvePrincipal,
    {
      kind: "guest";
    }
  >,
  input: z.infer<typeof createConversationInput>
) => {
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
      status: reservation.status === "conflict" ? 409 : 429,
    }
  );
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- max-params (#511): settleGuestCreation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/explicit-function-return-type (#560): Keep settleGuestCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep settleGuestCreation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): settleGuestCreation accepts response: Response; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): settleGuestCreation preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
// oxlint-disable-next-line typescript/consistent-return -- #580: settleGuestCreation has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
const settleGuestCreation = async (
  response: Response,
  ownerId: string,
  operationId: string,
  reservationId: string
) => {
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
};
/* oxlint-enable max-params, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
export {
  admitGuestCreation,
  guestRequestIpHash,
  settleGuestCreation,
  validateGuestCreation,
};
