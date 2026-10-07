import { beforeEach, expect, it, vi } from "vitest";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DELETE, GET } from "./route";
/* oxlint-enable sort-imports */

const mocks = vi.hoisted(() => ({
  env: {
    APP_URL: "http://localhost:3790",
    EVE_INTERNAL_ORIGIN: "http://localhost:4000",
    WORKFLOW_POSTGRES_URL: "postgresql://localhost/test",
  },
  principal: vi.fn(),
  remove: vi.fn(),
  removeCopy: vi.fn(),
  state: vi.fn(),
  unacceptedCopy: vi.fn(),
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/db/eve-deletion", () => ({ getEveDeletionState: mocks.state }));
vi.mock("@/lib/db/eve-copy-journal", () => ({
  isUnacceptedEveCopy: mocks.unacceptedCopy,
}));
vi.mock("@/lib/eve/delete-unaccepted-copy", () => ({
  deleteUnacceptedEveCopy: mocks.removeCopy,
}));
vi.mock("@/lib/eve/delete-local-conversation", () => ({
  deleteLocalEveConversationFamily: mocks.remove,
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
const id = "5c57c1d6-5540-4c6d-9d03-064a33528a5d";
const context = { params: Promise.resolve({ id }) };
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep request's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const request = (method = "DELETE", origin = "http://localhost:3790") =>
  new Request(`http://localhost:3790/api/agent-conversations/${id}`, {
    headers: { origin },
    method,
  });
/* oxlint-enable typescript/explicit-function-return-type */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://localhost/test";
  mocks.env.EVE_INTERNAL_ORIGIN = "http://localhost:4000";
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.state.mockResolvedValue({ rootId: id, state: "bound" });
  mocks.remove.mockResolvedValue({ rootId: id });
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("cleans an unaccepted copy with never-dispatched proof instead of native retiremen uses 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("cleans an unaccepted copy with never-dispatched proof instead of native retirement", async () => {
  const rootId = "00000000-0000-4000-8000-000000000099";
  mocks.state.mockResolvedValue({ rootId, state: "bound" });
  mocks.unacceptedCopy.mockResolvedValue(true);
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://remote.example/db";
  const resolvedResult1 = await DELETE(request(), context);
  expect(resolvedResult1.status).toBe(200);
  expect(await resolvedResult1.json()).toEqual({ rootId, status: "deleted" });
  expect(mocks.removeCopy).toHaveBeenCalledWith("owner", id);
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("runs owner-authorized family deletion with a server-controlled worker root") uses 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("runs owner-authorized family deletion with a server-controlled worker root", async () => {
  const response = await DELETE(request(), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ rootId: id, status: "deleted" });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.remove).toHaveBeenCalledWith("owner", id, process.cwd());
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): it("hides unavailable and foreign bindings without cleanup") uses 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("hides unavailable and foreign bindings without cleanup") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
it("hides unavailable and foreign bindings without cleanup", async () => {
  mocks.state.mockResolvedValue(undefined);
  const resolvedResult2 = await DELETE(request(), context);
  expect(resolvedResult2.status).toBe(404);
  expect(mocks.state).toHaveBeenCalledWith("owner", id);
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined */
/* oxlint-disable no-magic-numbers, unicorn/no-null --
 * no-magic-numbers (#517): it("requires login and valid coordinates") uses 401, 400 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): it("requires login and valid coordinates") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("requires login and valid coordinates", async () => {
  mocks.principal.mockResolvedValue(null);
  const resolvedResult3 = await DELETE(request(), context);
  expect(resolvedResult3.status).toBe(401);
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  const resolvedResult4 = await DELETE(request(), {
    params: Promise.resolve({ id: "invalid" }),
  });
  expect(resolvedResult4.status).toBe(400);
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, unicorn/no-null */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("rejects cross-origin mutation before any cleanup") uses 403 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("rejects cross-origin mutation before any cleanup", async () => {
  const resolvedResult6 = await DELETE(
    request("DELETE", "https://foreign.example"),
    context
  );
  expect(resolvedResult6.status).toBe(403);
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("refuses unsupported provider configuration before revoking access") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("refuses unsupported provider configuration before revoking access", async () => {
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://remote.example/db";
  const resolvedResult7 = await DELETE(request(), context);
  expect(resolvedResult7.status).toBe(503);
  mocks.env.WORKFLOW_POSTGRES_URL = "postgresql://localhost/test";
  mocks.env.EVE_INTERNAL_ORIGIN = "https://remote.example";
  const resolvedResult8 = await DELETE(request(), context);
  expect(resolvedResult8.status).toBe(503);
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("reports pending erasure without leaking internal failure details") uses 202 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("reports pending erasure without leaking internal failure details", async () => {
  mocks.remove.mockRejectedValue(new Error("private provider details"));
  mocks.state
    .mockResolvedValueOnce({ rootId: id, state: "bound" })
    .mockResolvedValue({ rootId: id, state: "deleting" });
  const response = await DELETE(request(), context);
  expect(response.status).toBe(202);
  expect(await response.json()).toMatchObject({
    retryRequired: true,
    status: "pending",
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("does not call an unstarted operation pending") uses 409 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("does not call an unstarted operation pending", async () => {
  mocks.remove.mockRejectedValue(new Error("creation unsettled"));
  const resolvedResult9 = await DELETE(request(), context);
  expect(resolvedResult9.status).toBe(409);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
it("returns completed tombstones idempotently and GET never resumes cleanup", async () => {
  mocks.state.mockResolvedValue({ rootId: id, state: "deleted" });
  const resolvedResult10 = await DELETE(request(), context);
  expect(await resolvedResult10.json()).toEqual({
    rootId: id,
    status: "deleted",
  });
  const resolvedResult11 = await GET(request("GET"), context);
  expect(await resolvedResult11.json()).toEqual({
    rootId: id,
    status: "deleted",
  });
  mocks.state.mockResolvedValue({ rootId: id, state: "deleting" });
  const resolvedResult12 = await GET(request("GET"), context);
  expect(await resolvedResult12.json()).toEqual({
    rootId: id,
    status: "pending",
  });
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
