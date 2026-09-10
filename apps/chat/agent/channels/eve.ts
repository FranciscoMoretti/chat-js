import { timingSafeEqual } from "node:crypto";
import { eveChannel } from "eve/channels/eve";
import { ownsEveSession } from "../../lib/db/eve-queries";
import { env } from "../../lib/env";
import { loadEveModelDefinition } from "../../lib/eve/model-selection";
import { parseSessionRequest } from "../../lib/eve/request-policy";

const operationLookupPath = /^\/eve\/v1\/operation\/[A-Za-z0-9_-]+$/;

export default eveChannel({
  authorizeFork: ({ auth, sourceSessionId }) =>
    ownsEveSession(auth.principalId, sourceSessionId),
  auth: async (request) => {
    if (env.EVE_ENABLED !== "true" || !env.EVE_GATEWAY_SECRET) {
      return null;
    }
    const expected = Buffer.from(`Bearer ${env.EVE_GATEWAY_SECRET}`);
    const actual = Buffer.from(request.headers.get("authorization") ?? "");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return null;
    }
    const owner = request.headers.get("x-chatjs-owner");
    if (!owner) {
      return null;
    }
    const path = new URL(request.url).pathname;
    if (
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
  },
});
