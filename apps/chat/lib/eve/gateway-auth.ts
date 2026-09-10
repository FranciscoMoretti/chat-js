import { timingSafeEqual } from "node:crypto";
import {
  getDeletingEveConversationForSession,
  ownsEveSession,
} from "../db/eve-queries";
import { env } from "../env";
import { parseDeletionSessionRequest } from "./deletion-policy";
import { loadEveModelDefinition } from "./model-selection";
import { parseSessionRequest } from "./request-policy";

const operationLookupPath = /^\/eve\/v1\/operation\/[A-Za-z0-9_-]+$/;

export async function authenticateEveGateway(request: Request) {
  if (env.EVE_ENABLED !== "true" || !env.EVE_GATEWAY_SECRET) {
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
    const sessionId = parseDeletionSessionRequest(path, request.method);
    if (
      !(
        sessionId &&
        (await getDeletingEveConversationForSession(owner, sessionId))
      )
    ) {
      return null;
    }
  } else if (
    !(
      (path === "/eve/v1/session" && request.method === "POST") ||
      (operationLookupPath.test(path) && request.method === "GET")
    )
  ) {
    const policy = parseSessionRequest(path, request.method);
    if (!(policy && (await ownsEveSession(owner, policy.sessionId)))) {
      return null;
    }
  }
  const modelId = request.headers.get("x-chatjs-model") ?? undefined;
  if (modelId) {
    await loadEveModelDefinition(modelId);
  }
  const attributes: Record<string, string> = {};
  if (modelId) {
    attributes.modelId = modelId;
  }
  return {
    attributes,
    authenticator: "chatjs-gateway",
    issuer: "chatjs",
    principalType: "user",
    principalId: owner,
    subject: owner,
  };
}
