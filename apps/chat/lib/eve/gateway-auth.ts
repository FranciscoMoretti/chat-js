/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:crypto" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This server/tooling module requires import { timingSafeEqual } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types"; "../db/eve-guests"; "../db/eve-queries"; "../db/eve-sandbox-coverage-proof"; "../db/eve-subagents" dependency within this package instead of introducing an alias or barrel API.
 */
import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import { readEveGuestOwner } from "../db/eve-guests";
import {
  getDeletingEveConversationForSession,
  ownsEveSession,
  readEveSessionMapping,
} from "../db/eve-queries";
import { isFencedEveDescendant } from "../db/eve-sandbox-coverage-proof";
import { getEveSubagent } from "../db/eve-subagents";
import { env } from "../env";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import { parseDeletionSessionRequest } from "./deletion-policy";
import { loadEveModelDefinition } from "./model-selection";
import { parseSessionRequest } from "./request-policy";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

const checkpointLookupPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/checkpoint$/u;

const namedCheckpointLookupPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/checkpoint\/[0-9a-f-]{36}$/iu;

const operationLookupPath = /^\/eve\/v1\/operation\/[A-Za-z0-9_-]+$/u;
const compactionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/compact$/u;

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/prefer-readonly-parameter-types (#565): authorizeDeletionRequest accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): authorizeDeletionRequest intentionally keeps the existing falsy-value behavior of sessionId; rootSessionId; env.WORKFLOW_POSTGRES_URL; await getDeletingEveConversationForSession(owner, rootSessionId); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const authorizeDeletionRequest = async (
  request: Request,
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
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): gatewaySessionPolicy uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep gatewaySessionPolicy's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): gatewaySessionPolicy intentionally keeps the existing falsy-value behavior of compactionSession; ordinaryCheckpoint; checkpointSession; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const gatewaySessionPolicy = (path: string, method: string) => {
  const compactionSession = method === "POST" && compactionPath.exec(path)?.[1];
  if (compactionSession) {
    return { sessionId: compactionSession };
  }
  const ordinaryCheckpoint =
    (method === "GET" || method === "POST") &&
    checkpointLookupPath.exec(path)?.[1];
  const namedCheckpoint =
    method === "GET" && namedCheckpointLookupPath.exec(path)?.[1];
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
  const checkpointSession = ordinaryCheckpoint || namedCheckpoint;
  return checkpointSession
    ? { sessionId: checkpointSession }
    : parseSessionRequest(path, method);
};
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep readCreationReservation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readCreationReservation accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): readCreationReservation intentionally keeps the existing falsy-value behavior of reservation; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): readCreationReservation preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const readCreationReservation = async (request: Request, owner: string) => {
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-statements, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-statements (#512): readGatewayAttributes keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): readGatewayAttributes uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep readGatewayAttributes's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readGatewayAttributes accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): readGatewayAttributes intentionally keeps the existing falsy-value behavior of modelId; reservationId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): readGatewayAttributes preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const readGatewayAttributes = async (request: Request, owner: string) => {
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
/* oxlint-enable max-statements, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): guestAttributesAllowed accepts expiresAt: Date; attributes: Record<string, string>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const guestAttributesAllowed = (
  expiresAt: Date,
  attributes: Record<string, string>,
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

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
/* oxlint-enable max-params */

/* oxlint-disable max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-lines-per-function (#510): authenticateEveGateway keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): authenticateEveGateway keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep authenticateEveGateway's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep authenticateEveGateway's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): authenticateEveGateway accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): authenticateEveGateway intentionally keeps the existing falsy-value behavior of owner; guest; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): authenticateEveGateway preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const authenticateEveGateway = async (request: Request) => {
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
/* oxlint-enable max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
