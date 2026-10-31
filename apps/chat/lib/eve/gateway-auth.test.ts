import { beforeEach, expect, it, vi } from "vitest";

import { authenticateEveGateway } from "./gateway-auth";

const mocks = vi.hoisted(() => ({
  child: vi.fn(),
  deleting: vi.fn(),
  mapping: vi.fn(),
  model: vi.fn(),
  owns: vi.fn(),
}));
vi.mock("../db/eve-subagents", () => ({ getEveSubagent: mocks.child }));
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
vi.mock("./model-selection", () => ({ loadEveModelDefinition: mocks.model }));
const reservationId = "01912345-1234-7123-8123-123456789abc";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.child.mockResolvedValue(null);
  mocks.mapping.mockResolvedValue({
    id: reservationId,
    ownerId: "owner",
    state: "creating",
  });
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
])(
  "allows authenticated cleanup only for the deleting owner's session: %s",
  async (path, method) => {
    expect(await authenticateEveGateway(request(path, method))).toMatchObject({
      principalId: "owner",
    });
    expect(mocks.deleting).toHaveBeenCalledWith("owner", "session");
    mocks.deleting.mockResolvedValue(null);
    expect(await authenticateEveGateway(request(path, method))).toBeNull();
  }
);

it.each([
  ["/eve/v1/session", "POST"],
  ["/eve/v1/session/session", "POST"],
  ["/eve/v1/session/session/cancel", "POST"],
  ["/eve/v1/session/session/reset", "GET"],
  ["/eve/v1/session/session/stream", "POST"],
  ["/eve/v1/session/session/local-resources", "GET"],
  ["/eve/v1/session/session/local-resources", "POST"],
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
it("rejects removed checkpoint endpoints even for the source owner", async () => {
  mocks.owns.mockResolvedValue(true);
  const read = request(
    "/eve/v1/session/source/checkpoint?beforeTurnId=turn_0",
    "GET"
  );
  read.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(read)).toBeNull();
  const write = request("/eve/v1/session/source/checkpoint", "POST");
  write.headers.delete("x-chatjs-deletion");
  expect(await authenticateEveGateway(write)).toBeNull();
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

it("ordinary owner access cannot manage internal sandbox resources", async () => {
  const read = request("/eve/v1/session/session/local-resources", "POST");
  read.headers.delete("x-chatjs-deletion");
  mocks.owns.mockResolvedValue(true);
  expect(await authenticateEveGateway(read)).toBeNull();
  expect(mocks.deleting).not.toHaveBeenCalled();
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
  null,
  { id: reservationId, ownerId: "foreign", state: "creating" },
  { id: reservationId, ownerId: "owner", state: "deleting" },
  { id: reservationId, ownerId: "owner", state: "deleted" },
])(
  "rejects an unavailable creation identity: %j",
  async (
    row: Readonly<{ id: string; ownerId: string; state: string } | null>
  ) => {
    mocks.mapping.mockResolvedValue(row);
    const command = request("/eve/v1/session", "POST");
    command.headers.delete("x-chatjs-deletion");
    expect(await authenticateEveGateway(command)).toBeNull();
  }
);

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
it("authorizes owned child streams without granting child mutation or cross-owner access", async () => {
  mocks.child.mockResolvedValueOnce({ rootSessionId: "root" });
  const read = new Request("http://localhost/eve/v1/session/child/stream", {
    headers: {
      authorization: "Bearer fixture-secret",
      "x-chatjs-owner": "owner",
    },
  });
  expect(await authenticateEveGateway(read)).toMatchObject({
    principalId: "owner",
  });
  await Promise.all(
    ["", "/cancel", "/reset"].map(async (suffix) => {
      expect(
        await authenticateEveGateway(
          new Request(`http://localhost/eve/v1/session/child${suffix}`, {
            headers: read.headers,
            method: "POST",
          })
        )
      ).toBeNull();
    })
  );
  expect(mocks.child).toHaveBeenCalledExactlyOnceWith("owner", "child");
  const foreign = new Headers(read.headers);
  foreign.set("x-chatjs-owner", "other");
  expect(
    await authenticateEveGateway(new Request(read.url, { headers: foreign }))
  ).toBeNull();
  expect(mocks.child).toHaveBeenLastCalledWith("other", "child");
});
