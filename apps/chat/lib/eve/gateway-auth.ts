/* oxlint-disable import/max-dependencies, import/no-nodejs-modules --
 * import/max-dependencies (#524): import from "node:crypto" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This server/tooling module requires import { timingSafeEqual } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { frontendToolsSchema } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
import { readEveGuestOwner } from "@/lib/db/eve-guests";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getDeletingEveConversationForSession,
  ownsEveSession,
  readEveSessionMapping,
} from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */
import { getEveSubagent } from "@/lib/db/eve-subagents";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
import { isFencedEveDescendant } from "@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
/* oxlint-enable sort-imports */

import { parseDeletionSessionRequest } from "./deletion-policy";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { loadEveModelDefinition } from "./model-selection";
/* oxlint-enable sort-imports */
import { parseSessionRequest } from "./request-policy";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules */

const checkpointLookupPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/checkpoint$/u;

const namedCheckpointLookupPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/checkpoint\/[0-9a-f-]{36}$/iu;

const operationLookupPath = /^\/eve\/v1\/operation\/[A-Za-z0-9_-]+$/u;
const compactionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/compact$/u;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve authorizeDeletionRequest's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/strict-boolean-expressions -- * typescript/strict-boolean-expressions (#610): authorizeDeletionRequest intentionally keeps the existing falsy-value behavior of sessionId; rootSessionId; env.WORKFLOW_POSTGRES_URL; await getDeletingEveConversationForSession(owner, rootSessionId); distinguishing empty, zero, and absent states requires a domain behavior decision. */
const authorizeDeletionRequest = async (
  request: ReadonlyNativeSurface<Request>,
  owner: string,
  path: string
): Promise<boolean> => {
  const sessionId = parseDeletionSessionRequest(path, request.method);
  if (!sessionId) {
    return false;
  }
  const rootSessionId = request.headers.get("x-chatjs-deletion-root");
  if (!rootSessionId) {
    return Boolean(
      await getDeletingEveConversationForSession(owner, sessionId)
    );
  }
  if (
    !(
      path.endsWith("/sandbox-identity") &&
      request.method === "GET" &&
      resolveWorkflowWorld(env) === "@workflow/world-postgres" &&
      env.WORKFLOW_POSTGRES_URL &&
      (await getDeletingEveConversationForSession(owner, rootSessionId))
    )
  ) {
    return false;
  }
  return await isFencedEveDescendant(
    env.WORKFLOW_POSTGRES_URL,
    rootSessionId,
    sessionId
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): gatewaySessionPolicy uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): gatewaySessionPolicy intentionally keeps the existing falsy-value behavior of compactionSession; ordinaryCheckpoint; checkpointSession; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const gatewaySessionPolicy = (
  path: string,
  method: string
): ReturnType<typeof parseSessionRequest> | { sessionId: string } => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from compactionPath.exec(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const compactionSession = method === "POST" && compactionPath.exec(path)?.[1];
  if (compactionSession) {
    return { sessionId: compactionSession };
  }
  const ordinaryCheckpoint =
    (method === "GET" || method === "POST") &&
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from checkpointLookupPath.exec(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    checkpointLookupPath.exec(path)?.[1];
  const namedCheckpoint =
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from namedCheckpointLookupPath.exec(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    method === "GET" && namedCheckpointLookupPath.exec(path)?.[1];
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
  const checkpointSession = ordinaryCheckpoint || namedCheckpoint;

  if (checkpointSession) {
    return { sessionId: checkpointSession };
  }
  return parseSessionRequest(path, method);
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readCreationReservation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/strict-boolean-expressions, unicorn/no-null -- * typescript/strict-boolean-expressions (#610): readCreationReservation intentionally keeps the existing falsy-value behavior of reservation; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): readCreationReservation preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const readCreationReservation = async (
  request: ReadonlyNativeSurface<Request>,
  owner: string
): Promise<string | null> => {
  const command = z
    .object({ operationId: z.uuid(), seed: z.boolean().optional() })
    .safeParse(
      await request
        .clone()
        .json()
        .catch(() => null)
    );
  if (!command.success) {
    return null;
  }
  const reservation = await readEveSessionMapping({
    reservationId: command.data.operationId,
  });
  if (
    !reservation ||
    reservation.ownerId !== owner ||
    reservation.state === "deleting" ||
    reservation.state === "deleted" ||
    (command.data.seed === true) !== (reservation.creationKind === "copy")
  ) {
    return null;
  }
  return reservation.id;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readGatewayAttributes's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-statements, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null -- * max-statements (#512): readGatewayAttributes keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): readGatewayAttributes uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-boolean-expressions (#610): readGatewayAttributes intentionally keeps the existing falsy-value behavior of modelId; reservationId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): readGatewayAttributes preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const readGatewayAttributes = async (
  request: ReadonlyNativeSurface<Request>,
  owner: string
): Promise<Record<string, string> | null> => {
  const modelId = request.headers.get("x-chatjs-model") ?? undefined;
  if (modelId) {
    await loadEveModelDefinition(modelId);
  }
  const toolHeader = request.headers.get("x-chatjs-tool");
  const selectedTool = frontendToolsSchema
    .optional()
    .safeParse(toolHeader ?? undefined);
  if (!selectedTool.success) {
    return null;
  }
  const attributes: Record<string, string> = {};
  if (selectedTool.data) {
    attributes.selectedTool = selectedTool.data;
  }
  if (modelId) {
    attributes.modelId = modelId;
  }
  if (
    new URL(request.url).pathname === "/eve/v1/session" &&
    request.method === "POST"
  ) {
    const reservationId = await readCreationReservation(request, owner);
    if (!reservationId) {
      return null;
    }
    // Derive this from the authenticated command and durable reservation, never a header.
    attributes.chatjsReservationId = reservationId;
  }
  return attributes;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-undefined, typescript/strict-boolean-expressions, unicorn/no-null */

const guestAttributesAllowed = (
  expiresAt: ReadonlyNativeSurface<Date>,
  attributes: Readonly<Record<string, string>>,
  requiresModel: boolean
): boolean =>
  expiresAt > new Date() &&
  (!requiresModel || Boolean(attributes.modelId)) &&
  (!attributes.modelId ||
    ANONYMOUS_LIMITS.AVAILABLE_MODELS.some(
      (model) => model === attributes.modelId
    )) &&
  (!attributes.selectedTool ||
    ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some(
      (tool) => tool === attributes.selectedTool
    ));

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ownsGatewaySession's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-params --
 * max-params (#511): ownsGatewaySession keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const ownsGatewaySession = async (
  owner: string,
  sessionId: string,
  path: string,
  method: string
): Promise<boolean> => {
  if (await ownsEveSession(owner, sessionId)) {
    return true;
  }
  // Native child bindings authorize internal stream reads, never mutations.
  if (method !== "GET" || path !== `/eve/v1/session/${sessionId}/stream`) {
    return false;
  }
  return Boolean(await getEveSubagent(owner, sessionId));
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (authenticateEveGateway); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve authenticateEveGateway's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params */

/* oxlint-disable max-lines-per-function, max-statements, typescript/strict-boolean-expressions, unicorn/no-null -- * max-lines-per-function (#510): authenticateEveGateway keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): authenticateEveGateway keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): authenticateEveGateway intentionally keeps the existing falsy-value behavior of owner; guest; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): authenticateEveGateway preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
export const authenticateEveGateway = async (
  request: ReadonlyNativeSurface<Request>
): Promise<{
  attributes: Record<string, string>;
  authenticator: string;
  issuer: string;
  principalId: string;
  principalType: string;
  subject: string;
} | null> => {
  if (!env.EVE_GATEWAY_SECRET) {
    return null;
  }
  const expected = Buffer.from(`Bearer ${env.EVE_GATEWAY_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  const owner = request.headers.get("x-chatjs-owner");
  if (!owner) {
    return null;
  }
  const path = new URL(request.url).pathname;
  if (request.headers.get("x-chatjs-deletion") === "1") {
    if (!(await authorizeDeletionRequest(request, owner, path))) {
      return null;
    }
  } else if (
    !(
      (path === "/eve/v1/session" && request.method === "POST") ||
      (operationLookupPath.test(path) && request.method === "GET")
    )
  ) {
    const policy = gatewaySessionPolicy(path, request.method);
    if (
      !(
        policy &&
        (await ownsGatewaySession(
          owner,
          policy.sessionId,
          path,
          request.method
        ))
      )
    ) {
      return null;
    }
  }
  const attributes = await readGatewayAttributes(request, owner);
  if (!attributes) {
    return null;
  }
  const guest = await readEveGuestOwner(owner);
  if (
    guest &&
    request.headers.get("x-chatjs-deletion") !== "1" &&
    !guestAttributesAllowed(
      guest.expiresAt,
      attributes,
      path === "/eve/v1/session"
    )
  ) {
    return null;
  }
  if (guest) {
    attributes.chatjsGuest = "true";
  }
  return {
    attributes,
    authenticator: "chatjs-gateway",
    issuer: "chatjs",
    principalId: owner,
    principalType: "user",
    subject: owner,
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/strict-boolean-expressions, unicorn/no-null */
