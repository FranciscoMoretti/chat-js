import { expect, it, vi } from "vitest";
import { eveOperationLookupRoute } from "./operation-lookup-route";

const auth = vi.hoisted(() => vi.fn());
vi.mock("./gateway-auth", () => ({ authenticateEveGateway: auth }));

it("leaves lookup misses unknown and rejects foreign identity selectors without dispatch", async () => {
  auth.mockResolvedValue({
    authenticator: "chatjs-gateway",
    issuer: "chatjs",
    principalType: "user",
    principalId: "owner",
  });
  const forbidden = vi.fn(() => {
    throw new Error("Lookup cannot invoke runtime actions.");
  });
  const resolveSession = vi.fn().mockReturnValue(Promise.resolve());
  const context = {
    params: { operationId: "operation" },
    requestIp: null,
    resolveSession,
    from: forbidden,
    to: forbidden,
    attachSession: forbidden,
    waitUntil: forbidden,
    describe: forbidden,
    listSkillFiles: forbidden,
    readSkill: forbidden,
    invokeTool: forbidden,
  };
  const unknown = await eveOperationLookupRoute.handler(
    new Request("https://test/eve/v1/operation/operation"),
    context
  );
  expect(unknown.status).toBe(409);
  expect(await unknown.json()).toEqual({ code: "eve_operation_unresolved" });
  const foreign = await eveOperationLookupRoute.handler(
    new Request("https://test/eve/v1/operation/operation?owner=foreign"),
    context
  );
  expect(foreign.status).toBe(400);
  auth.mockResolvedValue(null);
  const anonymous = await eveOperationLookupRoute.handler(
    new Request("https://test/eve/v1/operation/operation"),
    context
  );
  expect(anonymous.status).toBe(401);
  expect(resolveSession).toHaveBeenCalledTimes(1);
  expect(forbidden).not.toHaveBeenCalled();
});
