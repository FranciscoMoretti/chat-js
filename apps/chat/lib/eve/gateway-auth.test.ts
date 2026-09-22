import { beforeEach, expect, it, vi } from "vitest";

import { authenticateEveGateway } from "./gateway-auth";

const mocks = vi.hoisted(() => ({
  deleting: vi.fn(),
  descendant: vi.fn(),
  guest: vi.fn(),
  mapping: vi.fn(),
  model: vi.fn(),
  owns: vi.fn(),
}));
vi.mock("../db/eve-guests", () => ({ readEveGuestOwner: mocks.guest }));
vi.mock("../types/anonymous", () => ({
  ANONYMOUS_LIMITS: {
    AVAILABLE_MODELS: ["cheap-model"],
    AVAILABLE_TOOLS: ["webSearch"],
  },
}));
vi.mock("../env", () => ({
  env: {
    EVE_GATEWAY_SECRET: "fixture-secret",
    WORKFLOW_POSTGRES_URL: "postgresql://local",
  },
}));
vi.mock("../db/eve-queries", () => ({
  getDeletingEveConversationForSession: mocks.deleting,
  ownsEveSession: mocks.owns,
  readEveSessionMapping: mocks.mapping,
}));
vi.mock("../db/eve-sandbox-coverage-proof", () => ({
  isFencedEveDescendant: mocks.descendant,
}));
vi.mock("./model-selection", () => ({ loadEveModelDefinition: mocks.model }));
const reservationId = "01912345-1234-7123-8123-123456789abc";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guest.mockResolvedValue(undefined);
  mocks.mapping.mockResolvedValue({
    id: reservationId,
    ownerId: "owner",
    state: "creating",
  });
  mocks.descendant.mockResolvedValue(false);
  mocks.owns.mockResolvedValue(false);
  mocks.deleting.mockResolvedValue({ id: "conversation" });
});

const request = (path: string, method: string, secret = "fixture-secret") =>
  new Request(`http://localhost${path}`, {
    headers: {
      authorization: `Bearer ${secret}`,
      "x-chatjs-deletion": "1",
      "x-chatjs-owner": "owner",
    },
    method,
    ...(path === "/eve/v1/session" && method === "POST"
      ? { body: JSON.stringify({ operationId: reservationId }) }
      : {}),
  });

it.each([
  ["/eve/v1/session/session/reset", "POST"],
  ["/eve/v1/session/session/stream", "GET"],
  ["/eve/v1/session/session/sandbox-identity", "GET"],
])(
  "allows authenticated cleanup only for the deleting owner's session: %s",
  async (path, method) => {
    expect(await authenticateEveGateway(request(path, method))).toMatchObject({
      principalId: "owner",
    });
    expect(mocks.deleting).toHaveBeenCalledWith("owner", "session");
    mocks.deleting.mockResolvedValue(undefined);
    expect(await authenticateEveGateway(request(path, method))).toBeNull();
  }
);

it.each([
  ["/eve/v1/session", "POST"],
  ["/eve/v1/session/session", "POST"],
  ["/eve/v1/session/session/cancel", "POST"],
  ["/eve/v1/session/session/reset", "GET"],
  ["/eve/v1/session/session/stream", "POST"],
  ["/eve/v1/session/session/sandbox-identity", "POST"],
  ["/eve/v1/operation/id", "GET"],
])(
  "cleanup credentials cannot start work or broaden access: %s",
  async (path, method) => {
    expect(await authenticateEveGateway(request(path, method))).toBeNull();
    expect(mocks.deleting).not.toHaveBeenCalled();
  }
);

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

it("internal compaction requires a gateway credential and the bound owner", async () => {
  const compact = request("/eve/v1/session/source/compact", "POST");
  compact.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(compact)).toBeNull();
  mocks.owns.mockResolvedValue(true);
  expect(await authenticateEveGateway(compact)).toMatchObject({
    principalId: "owner",
  });
  expect(mocks.owns).toHaveBeenCalledWith("owner", "source");
  compact.headers.set("authorization", "Bearer wrong");
  expect(await authenticateEveGateway(compact)).toBeNull();
  expect(
    await authenticateEveGateway(
      request("/eve/v1/session/source/compact", "POST")
    )
  ).toBeNull();
  const read = request("/eve/v1/session/source/compact", "GET");
  read.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(read)).toBeNull();
});

it("ordinary owner access cannot read internal sandbox birth evidence", async () => {
  const read = request("/eve/v1/session/session/sandbox-identity", "GET");
  read.headers.delete("x-chatjs-deletion");
  mocks.owns.mockResolvedValue(true);
  expect(await authenticateEveGateway(read)).toBeNull();
  expect(mocks.deleting).not.toHaveBeenCalled();
});

it("only allows fenced descendants of an owner-matched deleting root", async () => {
  const read = request("/eve/v1/session/child/sandbox-identity", "GET");
  read.headers.set("x-chatjs-deletion-root", "root");
  expect(await authenticateEveGateway(read)).toBeNull();
  mocks.descendant.mockResolvedValue(true);
  expect(await authenticateEveGateway(read)).toMatchObject({
    principalId: "owner",
  });
  expect(mocks.deleting).toHaveBeenCalledWith("owner", "root");
  expect(mocks.descendant).toHaveBeenCalledWith(
    "postgresql://local",
    "root",
    "child"
  );
  mocks.deleting.mockResolvedValue(undefined);
  expect(await authenticateEveGateway(read)).toBeNull();
});
it("root proof headers cannot authorize descendant mutations or transcript reads", async () => {
  mocks.descendant.mockResolvedValue(true);
  for (const [path, method] of [
    ["reset", "POST"],
    ["stream", "GET"],
  ]) {
    const read = request(`/eve/v1/session/child/${path}`, method);
    read.headers.set("x-chatjs-deletion-root", "root");
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    expect(await authenticateEveGateway(read)).toBeNull();
  }
  expect(mocks.descendant).not.toHaveBeenCalled();
});

it("accepts only a known tool selection as a gateway attribute", async () => {
  const command = request("/eve/v1/session", "POST");
  command.headers.delete("x-chatjs-deletion");
  command.headers.set("x-chatjs-tool", "webSearch");
  expect(await authenticateEveGateway(command)).toMatchObject({
    attributes: { selectedTool: "webSearch" },
  });
  command.headers.set("x-chatjs-tool", "server__arbitrary");
  expect(await authenticateEveGateway(command)).toBeNull();
});

it("derives guest identity from storage and enforces anonymous model/tool policy", async () => {
  const send = request("/eve/v1/session", "POST");
  send.headers.delete("x-chatjs-deletion");
  send.headers.set("x-chatjs-model", "cheap-model");
  mocks.guest.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000) });
  expect(await authenticateEveGateway(send)).toMatchObject({
    attributes: { chatjsGuest: "true" },
  });
  send.headers.delete("x-chatjs-model");
  expect(await authenticateEveGateway(send)).toBeNull();
  send.headers.set("x-chatjs-model", "cheap-model");
  send.headers.set("x-chatjs-tool", "webSearch");
  expect(await authenticateEveGateway(send)).not.toBeNull();
  send.headers.set("x-chatjs-tool", "deepResearch");
  expect(await authenticateEveGateway(send)).toBeNull();
  send.headers.delete("x-chatjs-tool");
  send.headers.set("x-chatjs-model", "expensive-model");
  expect(await authenticateEveGateway(send)).toBeNull();
  send.headers.set("x-chatjs-model", "cheap-model");
  mocks.guest.mockResolvedValue({ expiresAt: new Date(0) });
  expect(await authenticateEveGateway(send)).toBeNull();
  expect(
    await authenticateEveGateway(
      request("/eve/v1/session/session/reset", "POST")
    )
  ).toMatchObject({ attributes: { chatjsGuest: "true" } });
});

it("stamps the reservation from the body, ignoring forged identity headers and metadata", async () => {
  const command = request("/eve/v1/session", "POST");
  command.headers.delete("x-chatjs-deletion");
  command.headers.set("x-chatjs-reservation", crypto.randomUUID());
  expect(await authenticateEveGateway(command)).toMatchObject({
    attributes: { chatjsReservationId: reservationId },
  });
  expect(await command.json()).toEqual({ operationId: reservationId });
  expect(mocks.mapping).toHaveBeenCalledWith({ reservationId });
});
it.each([
  undefined,
  { id: reservationId, ownerId: "foreign", state: "creating" },
  { id: reservationId, ownerId: "owner", state: "deleting" },
  { id: reservationId, ownerId: "owner", state: "deleted" },
])("rejects an unavailable creation identity: %j", async (row) => {
  mocks.mapping.mockResolvedValue(row);
  const command = request("/eve/v1/session", "POST");
  command.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(command)).toBeNull();
});

it("does not let a seed reservation use the message operation namespace", async () => {
  mocks.mapping.mockResolvedValue({
    creationKind: "copy",
    id: reservationId,
    ownerId: "owner",
    state: "creating",
  });
  const command = request("/eve/v1/session", "POST");
  command.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(command)).toBeNull();
  const seed = new Request(command.url, {
    body: JSON.stringify({ operationId: reservationId, seed: true }),
    headers: command.headers,
    method: "POST",
  });
  expect(await authenticateEveGateway(seed)).toMatchObject({
    attributes: { chatjsReservationId: reservationId },
  });
});
