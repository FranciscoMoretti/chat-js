import { timingSafeEqual } from "node:crypto";

import { frontendToolsSchema } from "../ai/types";
import { readEveGuestOwner } from "../db/eve-guests";
import {
  getDeletingEveConversationForSession,
  ownsEveSession,
} from "../db/eve-queries";
import { isFencedEveDescendant } from "../db/eve-sandbox-coverage-proof";
import { env } from "../env";
import { ANONYMOUS_LIMITS } from "../types/anonymous";
import { parseDeletionSessionRequest } from "./deletion-policy";
import { loadEveModelDefinition } from "./model-selection";
import { parseSessionRequest } from "./request-policy";

const checkpointLookupPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/checkpoint$/u;

const namedCheckpointLookupPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/checkpoint\/[0-9a-f-]{36}$/iu;

const operationLookupPath = /^\/eve\/v1\/operation\/[A-Za-z0-9_-]+$/u;
const compactionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/compact$/u;

const authorizeDeletionRequest = async (
  request: Request,
  owner: string,
  path: string
) => {
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
  const checkpointSession = ordinaryCheckpoint || namedCheckpoint;
  return checkpointSession
    ? { sessionId: checkpointSession }
    : parseSessionRequest(path, method);
};

const readGatewayAttributes = async (request: Request) => {
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
  return attributes;
};

const guestAttributesAllowed = (
  expiresAt: Date,
  attributes: Record<string, string>,
  requiresModel: boolean
) =>
  expiresAt > new Date() &&
  (!requiresModel || !!attributes.modelId) &&
  (!attributes.modelId ||
    ANONYMOUS_LIMITS.AVAILABLE_MODELS.some(
      (model) => model === attributes.modelId
    )) &&
  (!attributes.selectedTool ||
    ANONYMOUS_LIMITS.AVAILABLE_TOOLS.some(
      (tool) => tool === attributes.selectedTool
    ));

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
    if (!(policy && (await ownsEveSession(owner, policy.sessionId)))) {
      return null;
    }
  }
  const attributes = await readGatewayAttributes(request);
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
