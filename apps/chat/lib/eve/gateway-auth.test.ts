import { beforeEach, expect, it, vi } from "vitest";
import { authenticateEveGateway } from "./gateway-auth";

const mocks = vi.hoisted(() => ({
  owns: vi.fn(),
  deleting: vi.fn(),
  model: vi.fn(),
}));
vi.mock("../env", () => ({
  env: { EVE_ENABLED: "true", EVE_GATEWAY_SECRET: "fixture-secret" },
}));
vi.mock("../db/eve-queries", () => ({
  ownsEveSession: mocks.owns,
  getDeletingEveConversationForSession: mocks.deleting,
}));
vi.mock("./model-selection", () => ({ loadEveModelDefinition: mocks.model }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owns.mockResolvedValue(false);
  mocks.deleting.mockResolvedValue({ id: "conversation" });
});

function request(path: string, method: string, secret = "fixture-secret") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      authorization: `Bearer ${secret}`,
      "x-chatjs-owner": "owner",
      "x-chatjs-deletion": "1",
    },
  });
}

it.each([
  ["/eve/v1/session/session/reset", "POST"],
  ["/eve/v1/session/session/stream", "GET"],
])("allows authenticated cleanup only for the deleting owner's session: %s", async (path, method) => {
  expect(await authenticateEveGateway(request(path, method))).toMatchObject({
    principalId: "owner",
  });
  expect(mocks.deleting).toHaveBeenCalledWith("owner", "session");
  mocks.deleting.mockResolvedValue(undefined);
  expect(await authenticateEveGateway(request(path, method))).toBeNull();
});

it.each([
  ["/eve/v1/session", "POST"],
  ["/eve/v1/session/session", "POST"],
  ["/eve/v1/session/session/cancel", "POST"],
  ["/eve/v1/session/session/reset", "GET"],
  ["/eve/v1/session/session/stream", "POST"],
  ["/eve/v1/operation/id", "GET"],
])("cleanup credentials cannot start work or broaden access: %s", async (path, method) => {
  expect(await authenticateEveGateway(request(path, method))).toBeNull();
  expect(mocks.deleting).not.toHaveBeenCalled();
});

it("rejects a forged cleanup header before querying ownership", async () => {
  expect(
    await authenticateEveGateway(
      request("/eve/v1/session/session/reset", "POST", "wrong")
    )
  ).toBeNull();
  expect(mocks.deleting).not.toHaveBeenCalled();
});

it("ordinary requests still require a bound session and cannot reset it", async () => {
  const reset = request("/eve/v1/session/session/reset", "POST");
  reset.headers.delete("x-chatjs-deletion");
  mocks.owns.mockResolvedValue(true);
  expect(await authenticateEveGateway(reset)).toBeNull();
  const stream = request("/eve/v1/session/session/stream", "GET");
  stream.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(stream)).toMatchObject({
    principalId: "owner",
  });
});

it("checkpoint readiness and capture require the source owner", async () => {
  const read = request(
    "/eve/v1/session/source/checkpoint?beforeTurnId=turn_0",
    "GET"
  );
  read.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(read)).toBeNull();
  mocks.owns.mockResolvedValue(true);
  expect(await authenticateEveGateway(read)).toMatchObject({
    principalId: "owner",
  });
  expect(mocks.owns).toHaveBeenCalledWith("owner", "source");
  const write = request("/eve/v1/session/source/checkpoint", "POST");
  write.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(write)).toMatchObject({
    principalId: "owner",
  });
  mocks.owns.mockResolvedValue(false);
  expect(await authenticateEveGateway(write)).toBeNull();
  const named = request(
    `/eve/v1/session/source/checkpoint/${crypto.randomUUID()}?beforeTurnId=turn_1`,
    "GET"
  );
  named.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(named)).toBeNull();
  mocks.owns.mockResolvedValue(true);
  expect(await authenticateEveGateway(named)).toMatchObject({
    principalId: "owner",
  });
});
