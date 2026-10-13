import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import nodePath from "node:path";
import { tmpdir } from "node:os";
import type { verifyEveSandboxCoverage } from "@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof";
import { verifyLocalEveFamilyCoverage } from "./verify-local-coverage";

const mocks = vi.hoisted(() => ({
  end: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
  verify: vi.fn(),
}));
vi.mock("postgres", () => ({
  default: (): { end: typeof mocks.end } => ({ end: mocks.end }),
}));
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
let root: string;
const sessionId = "session";
const IDENTITY_VERSION = 1;
const VERIFY_IDENTITY_PARAMETER_INDEX = 2;
const inventories = [{ runIds: [sessionId], sessionId }];

const identityPath = (): string =>
  nodePath.join(
    root,
    ".eve",
    "sandbox-identities",
    `${createHash("sha256").update(sessionId).digest("hex")}.json`
  );

const identity = (): {
  appRoot: string;
  backendName: "microsandbox";
  sessionId: string;
  version: typeof IDENTITY_VERSION;
} => ({
  appRoot: root,
  backendName: "microsandbox",
  sessionId,
  version: IDENTITY_VERSION,
});
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
  mocks.verify.mockImplementation(
    async (
      _connection,
      _scope,
      verify: Parameters<
        typeof verifyEveSandboxCoverage
      >[typeof VERIFY_IDENTITY_PARAMETER_INDEX]
    ) => {
      await verify(sessionId);
    }
  );
  mocks.fetch.mockResolvedValue(
    Response.json({
      local: identity(),
      sessionId,
      snapshotVersion: 2,
      version: 1,
    })
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(root, { force: true, recursive: true });
});
it("matches native evidence to a local identity and carries owner/root authorization", async () => {
  await verifyLocalEveFamilyCoverage("owner", root, inventories);
  const [[url, init]] = mocks.fetch.mock.calls;
  if (typeof init !== "object") {
    throw new TypeError("Expected native identity request options.");
  }
  if (!(url instanceof URL)) {
    throw new TypeError("Expected an absolute native identity URL.");
  }
  expect(url.href).toBe(
    "http://worker.local/eve/chat/v1/session/session/sandbox-identity"
  );

  expect(init.headers).toMatchObject({
    "x-chatjs-deletion": "1",
    "x-chatjs-deletion-root": sessionId,
    "x-chatjs-owner": "owner",
  });

  expect(init.redirect).toBe("error");
  expect(mocks.end).toHaveBeenCalledOnce();
});
it.each(["appRoot", "sessionId", "backendName"])(
  "rejects native %s mismatch",
  async (field) => {
    mocks.fetch.mockResolvedValue(
      Response.json({
        local: { ...identity(), [field]: "different" },
        sessionId,
        snapshotVersion: 2,
        version: 1,
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
  const actual = nodePath.join(root, "actual.json");
  await writeFile(actual, JSON.stringify(identity()));
  await rm(identityPath());
  await symlink(actual, identityPath());
  await expect(
    verifyLocalEveFamilyCoverage("owner", root, inventories)
  ).rejects.toThrow();
});
