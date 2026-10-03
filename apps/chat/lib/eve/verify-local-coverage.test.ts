/* oxlint-disable import/no-nodejs-modules, sort-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { createHash } from "node:crypto";; import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";; import { tmpdir } from "node:os";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { verifyLocalEveFamilyCoverage } from "./verify-local-coverage";
/* oxlint-enable import/no-nodejs-modules, sort-imports */

const mocks = vi.hoisted(() => ({
  end: vi.fn(),
  fetch: vi.fn(),
  verify: vi.fn(),
}));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("postgres")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("postgres", () => ({ default: () => ({ end: mocks.end }) }));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("../db/eve-sandbox-coverage-proof", () => ({
  verifyEveSandboxCoverage: mocks.verify,
}));
vi.mock("../env", () => ({
  env: {
    EVE_GATEWAY_SECRET: "fixture-secret",
    EVE_INTERNAL_ORIGIN: "http://worker.local",
    WORKFLOW_POSTGRES_URL: "postgresql://localhost",
  },
}));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
/* oxlint-disable init-declarations --
 * init-declarations (#507): root assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let root: string;
/* oxlint-enable init-declarations */
const sessionId = "session";
const inventories = [{ runIds: [sessionId], sessionId }];

const identityPath = (): string =>
  nodePath.join(
    root,
    ".eve",
    "sandbox-identities",
    `${createHash("sha256").update(sessionId).digest("hex")}.json`
  );

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep identity's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const identity = () => ({
  appRoot: root,
  backendName: "microsandbox",
  sessionId,
  version: 1,
});
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable import/no-nodejs-modules, oxc/no-async-await, typescript/promise-function-async --
 * import/no-nodejs-modules (#529): This test harness requires import("node:fs/promises"); its Node runtime boundary deliberately permits these built-ins.
 * oxc/no-async-await (#540): beforeEach sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): beforeEach preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
beforeEach(async () => {
  root = await mkdtemp(nodePath.join(tmpdir(), "eve-coverage-"));
  // On macOS, /var is a link; the production verifier compares canonical roots.
  const { realpath } = await import("node:fs/promises");
  root = await realpath(root);
  await mkdir(nodePath.join(root, ".eve", "sandbox-identities"), {
    recursive: true,
  });
  await writeFile(identityPath(), JSON.stringify(identity()));
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.verify.mockImplementation(async (_connection, _scope, verify) => {
    // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This verify-local-coverage fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    await verify(sessionId);
  });
  mocks.fetch.mockImplementation(() =>
    Promise.resolve(
      Response.json({
        local: identity(),
        sessionId,
        snapshotVersion: 2,
        version: 1,
      })
    )
  );
});
/* oxlint-enable import/no-nodejs-modules, oxc/no-async-await, typescript/promise-function-async */
/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): afterEach sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(root, { force: true, recursive: true });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("matches native evidence to a local identity and carries owner/root authorization" sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("matches native evidence to a local identity and carries owner/root authorization", async () => {
  await verifyLocalEveFamilyCoverage("owner", root, inventories);
  const [[url, init]] = mocks.fetch.mock.calls;
  expect(String(url)).toBe(
    "http://worker.local/eve/chat/v1/session/session/sandbox-identity"
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This verify-local-coverage fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(init.headers).toMatchObject({
    "x-chatjs-deletion": "1",
    "x-chatjs-deletion-root": sessionId,
    "x-chatjs-owner": "owner",
  });
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This verify-local-coverage fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(init.redirect).toBe("error");
  expect(mocks.end).toHaveBeenCalledOnce();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties, typescript/promise-function-async --
 * oxc/no-async-await (#540): it.each(["appRoot", "sessionId", "backendName"])("rejects native %s mismatch") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it.each(["appRoot", "sessionId", "backendName"])("rejects native %s mismatch") copies or separates ...identity() while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/promise-function-async (#606): it.each(["appRoot", "sessionId", "backendName"])("rejects native %s mismatch") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it.each(["appRoot", "sessionId", "backendName"])(
  "rejects native %s mismatch",
  async (field) => {
    mocks.fetch.mockImplementation(() =>
      Promise.resolve(
        Response.json({
          local: { ...identity(), [field]: "different" },
          sessionId,
          snapshotVersion: 2,
          version: 1,
        })
      )
    );
    await expect(
      verifyLocalEveFamilyCoverage("owner", root, inventories)
    ).rejects.toThrow();
    expect(mocks.end).toHaveBeenCalledOnce();
  }
);
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties, typescript/promise-function-async */
/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties, unicorn/no-null --
 * oxc/no-async-await (#540): it("rejects missing native evidence and mismatched local evidence") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("rejects missing native evidence and mismatched local evidence") copies or separates ...identity() while preserving existing object ownership; mutating source objects is not equivalent.
 * unicorn/no-null (#570): it("rejects missing native evidence and mismatched local evidence") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("rejects missing native evidence and mismatched local evidence", async () => {
  mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
  await expect(
    verifyLocalEveFamilyCoverage("owner", root, inventories)
  ).rejects.toThrow("unavailable");
  await writeFile(
    identityPath(),
    JSON.stringify({ ...identity(), sessionId: "other" })
  );
  await expect(
    verifyLocalEveFamilyCoverage("owner", root, inventories)
  ).rejects.toThrow("Local sandbox ownership");
});
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties, unicorn/no-null */
/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("does not follow a linked identity file") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("does not follow a linked identity file", async () => {
  const actual = nodePath.join(root, "actual.json");
  await writeFile(actual, JSON.stringify(identity()));
  await rm(identityPath());
  await symlink(actual, identityPath());
  await expect(
    verifyLocalEveFamilyCoverage("owner", root, inventories)
  ).rejects.toThrow();
});
/* oxlint-enable oxc/no-async-await */
