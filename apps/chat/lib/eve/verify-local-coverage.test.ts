/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { createHash } from "node:crypto";; import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";; import { tmpdir } from "node:os";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
/* oxlint-enable sort-imports */
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import nodePath from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */

import { verifyLocalEveFamilyCoverage } from "./verify-local-coverage";
/* oxlint-enable import/no-nodejs-modules */

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
vi.mock("@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof", () => ({
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve beforeEach's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable import/no-nodejs-modules, typescript/promise-function-async --
 * import/no-nodejs-modules (#529): This test harness requires import("node:fs/promises"); its Node runtime boundary deliberately permits these built-ins.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterEach's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules, typescript/promise-function-async */
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(root, { force: true, recursive: true });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each(["appRoot", "sessionId", "backendName"])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): it.each(["appRoot", "sessionId", "backendName"])("rejects native %s mismatch") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it.each(["appRoot", "sessionId", "backendName"])(
  "rejects native %s mismatch",
  async (field) => {
    mocks.fetch.mockImplementation(() =>
      Promise.resolve(
        Response.json({
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("rejects missing native evidence and mismatched local evidence") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("rejects missing native evidence and mismatched local evidence", async () => {
  mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
  await expect(
    verifyLocalEveFamilyCoverage("owner", root, inventories)
  ).rejects.toThrow("unavailable");
  await writeFile(
    identityPath(),
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    JSON.stringify({ ...identity(), sessionId: "other" })
  );
  await expect(
    verifyLocalEveFamilyCoverage("owner", root, inventories)
  ).rejects.toThrow("Local sandbox ownership");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */
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
