/* oxlint-disable eslint/no-await-in-loop -- Exercise each denied child mutation independently. */
import { beforeEach, expect, it, vi } from "vitest";

import { authenticateEveGateway } from "./gateway-auth";

const mocks = vi.hoisted(() => ({
  child: vi.fn(),
  deleting: vi.fn(),
  descendant: vi.fn(),
  guest: vi.fn(),
  mapping: vi.fn(),
  model: vi.fn(),
  owns: vi.fn(),
}));
vi.mock("../db/eve-subagents", () => ({ getEveSubagent: mocks.child }));
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
vi.mock("@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof", () => ({
  isFencedEveDescendant: mocks.descendant,
}));
vi.mock("./model-selection", () => ({ loadEveModelDefinition: mocks.model }));
const reservationId = "01912345-1234-7123-8123-123456789abc";

/* oxlint-disable no-undefined --
 * no-undefined (#519): beforeEach uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
beforeEach(() => {
  vi.clearAllMocks();
  mocks.child.mockResolvedValue(undefined);
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
/* oxlint-enable no-undefined */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep request's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const request = (path: string, method: string, secret = "fixture-secret") =>
  new Request(`http://localhost${path}`, {
    headers: {
      authorization: `Bearer ${secret}`,
      "x-chatjs-deletion": "1",
      "x-chatjs-owner": "owner",
    },
    method,
    // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Conditional spread (path === "/eve/v1/session" && method === "POST"       ? { body: JSON.stringify({ operationId: reservationId }) }       : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(path === "/eve/v1/session" && method === "POST"
      ? { body: JSON.stringify({ operationId: reservationId }) }
      : {}),
  });
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([   ["/eve/v1/session/session/reset", "POST"],   ["/eve/v1/session/session/stream", "GET"], 's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-undefined --
 * no-undefined (#519): it.each([ ["/eve/v1/session/session/reset", "POST"], ["/eve/v1/session/session/stream uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([   ["/eve/v1/session", "POST"],   ["/eve/v1/session/session", "POST"],   ["/eve/v1/session/'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("rejects a forged cleanup header before querying ownership", async () => {
  expect(
    await authenticateEveGateway(
      request("/eve/v1/session/session/reset", "POST", "wrong")
    )
  ).toBeNull();
  expect(mocks.deleting).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements --
 * max-statements (#512): it("checkpoint readiness and capture require the source owner") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements */

/* oxlint-disable max-statements --
 * max-statements (#512): it("internal compaction requires a gateway credential and the bound owner") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements */

it("ordinary owner access cannot read internal sandbox birth evidence", async () => {
  const read = request("/eve/v1/session/session/sandbox-identity", "GET");
  read.headers.delete("x-chatjs-deletion");
  mocks.owns.mockResolvedValue(true);
  expect(await authenticateEveGateway(read)).toBeNull();
  expect(mocks.deleting).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-undefined --
 * no-undefined (#519): it("only allows fenced descendants of an owner-matched deleting root") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): it("derives guest identity from storage and enforces anonymous model/tool policy") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("derives guest identity from storage and enforces anonymous model/tool policy") uses 60_000, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([   undefined,   { id: reservationId, ownerId: "foreign", state: "creating" },   { id: reser's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types --
 * no-undefined (#519): it.each([ undefined, { id: reservationId, ownerId: "foreign", state: "creating" }, {  uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): it.each([ undefined, { id: reservationId, ownerId: "foreign", state: "creating" }, {  accepts row; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-undefined, typescript/promise-function-async --
 * no-undefined (#519): it("authorizes owned child streams without granting child mutation or cross-owner acc uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/promise-function-async (#606): it("authorizes owned child streams without granting child mutation or cross-owner acc preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("authorizes owned child streams without granting child mutation or cross-owner access", async () => {
  mocks.child.mockImplementation((owner, session) => {
    if (owner === "owner" && session === "child") {
      return Promise.resolve({ rootSessionId: "root" });
    }
    return Promise.resolve(undefined);
  });
  const read = new Request("http://localhost/eve/v1/session/child/stream", {
    headers: {
      authorization: "Bearer fixture-secret",
      "x-chatjs-owner": "owner",
    },
  });
  expect(await authenticateEveGateway(read)).toMatchObject({
    principalId: "owner",
  });
  for (const suffix of ["", "/cancel", "/reset"]) {
    expect(
      await authenticateEveGateway(
        new Request(`http://localhost/eve/v1/session/child${suffix}`, {
          headers: read.headers,
          method: "POST",
        })
      )
    ).toBeNull();
  }
  const foreign = new Headers(read.headers);
  foreign.set("x-chatjs-owner", "other");
  expect(
    await authenticateEveGateway(new Request(read.url, { headers: foreign }))
  ).toBeNull();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-undefined, typescript/promise-function-async */

/* oxlint-disable max-lines -- #509: This gateway-auth.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
