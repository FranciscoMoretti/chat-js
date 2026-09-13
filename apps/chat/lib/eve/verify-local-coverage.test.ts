import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { verifyLocalEveFamilyCoverage } from "./verify-local-coverage";

const mocks = vi.hoisted(() => ({
  end: vi.fn(),
  verify: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("postgres", () => ({ default: () => ({ end: mocks.end }) }));
vi.mock("../db/eve-sandbox-coverage-proof", () => ({
  verifyEveSandboxCoverage: mocks.verify,
}));
vi.mock("../env", () => ({
  env: {
    WORKFLOW_POSTGRES_URL: "postgresql://localhost",
    EVE_INTERNAL_ORIGIN: "http://worker.local",
    EVE_GATEWAY_SECRET: "fixture-secret",
  },
}));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
let root: string;
const sessionId = "session";
const inventories = [{ sessionId, runIds: [sessionId] }];
const identityPath = () =>
  join(
    root,
    ".eve",
    "sandbox-identities",
    `${createHash("sha256").update(sessionId).digest("hex")}.json`
  );
const identity = () => ({
  version: 1,
  sessionId,
  appRoot: root,
  backendName: "microsandbox",
});
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "eve-coverage-"));
  // macOS /var is a link; the production verifier compares canonical roots.
  const { realpath } = await import("node:fs/promises");
  root = await realpath(root);
  await mkdir(join(root, ".eve", "sandbox-identities"), { recursive: true });
  await writeFile(identityPath(), JSON.stringify(identity()));
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.verify.mockImplementation(async (_connection, _scope, verify) => {
    await verify(sessionId);
  });
  mocks.fetch.mockImplementation(async () =>
    Response.json({
      version: 1,
      snapshotVersion: 2,
      sessionId,
      local: identity(),
    })
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(root, { recursive: true, force: true });
});
it("matches native evidence to a local identity and carries owner/root authorization", async () => {
  await verifyLocalEveFamilyCoverage("owner", root, inventories);
  const [url, init] = mocks.fetch.mock.calls[0];
  expect(String(url)).toBe(
    "http://worker.local/eve/v1/session/session/sandbox-identity"
  );
  expect(init.headers).toMatchObject({
    "x-chatjs-owner": "owner",
    "x-chatjs-deletion-root": sessionId,
    "x-chatjs-deletion": "1",
  });
  expect(init.redirect).toBe("error");
  expect(mocks.end).toHaveBeenCalledOnce();
});
it.each(["appRoot", "sessionId", "backendName"])(
  "rejects native %s mismatch",
  async (field) => {
    mocks.fetch.mockImplementation(async () =>
      Response.json({
        version: 1,
        snapshotVersion: 2,
        sessionId,
        local: { ...identity(), [field]: "different" },
      })
    );
    await expect(
      verifyLocalEveFamilyCoverage("owner", root, inventories)
    ).rejects.toThrow();
    expect(mocks.end).toHaveBeenCalledOnce();
  }
);
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
it("does not follow a linked identity file", async () => {
  const actual = join(root, "actual.json");
  await writeFile(actual, JSON.stringify(identity()));
  await rm(identityPath());
  await symlink(actual, identityPath());
  await expect(
    verifyLocalEveFamilyCoverage("owner", root, inventories)
  ).rejects.toThrow();
});
