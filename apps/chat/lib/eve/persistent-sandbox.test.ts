import { beforeEach, expect, it, vi } from "vitest";
import type { SandboxProviderSessionContext } from "eve/sandbox/provider";
import type { accessPersistentSandbox } from "./persistent-sandbox-store";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  reserve: vi.fn(),
  access: vi.fn<typeof accessPersistentSandbox>(),
  read: vi.fn(),
  retire: vi.fn(),
  cleanup: vi.fn(),
  create: vi.fn(),
  open: vi.fn(),
  stop: vi.fn(),
  remove: vi.fn(),
  write: vi.fn(),
  stopWorkspace: vi.fn(),
}));
vi.mock("./workspace-attachments", () => ({
  recordWorkspaceAttachment: vi.fn(),
  readWorkspaceAttachment: vi.fn(),
}));
vi.mock("@/chatjs/providers/sandbox/provider", () => ({
  supportsPersistentSandbox: true,
}));
vi.mock("../env", () => ({ env: {} }));
vi.mock("./persistent-sandbox-store", () => ({
  registerPersistentSession: mocks.register,
  reservePersistentSandbox: mocks.reserve,
  accessPersistentSandbox: mocks.access,
  resolvePersistentIdentity: mocks.read,
  stopPersistentWorkspace: mocks.stopWorkspace,
  retirePersistentSession: mocks.retire,
  cleanupPersistentSession: mocks.cleanup,
}));
vi.mock("../sandbox/runtime", () => ({
  getPersistentSandboxProvider: vi.fn(),
  getSandboxProvider: () => ({
    scope: { providerId: "vercel", accountId: "account", scopeId: "project" },
    persistent: {
      create: mocks.create,
      open: mocks.open,
      stop: mocks.stop,
      deleteAndConfirmAbsent: mocks.remove,
    },
  }),
}));
const { appSandboxProvider } = await import("./persistent-sandbox");
const implementation = appSandboxProvider();
const context: SandboxProviderSessionContext = {
  host: { resolveProjectPath: (path) => path, loadOptionalPackage: vi.fn() },
  storagePath: "/fixture",
  session: {
    id: "session",
    auth: { initiator: null, current: null },
    turn: { id: "turn", sequence: 0 },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({
    sessionId: "session",
    rootSessionId: "session",
    ownerId: "owner",
    workspaceId: "workspace",
    conversationId: "conversation",
  });
  mocks.reserve.mockResolvedValue({ name: "resource", create: true });
  mocks.create.mockResolvedValue({
    name: "resource",
    resolvePath: (path: string) => path,
    writeBinaryFile: mocks.write,
  });
  mocks.open.mockResolvedValue({
    name: "resource",
    resolvePath: (path: string) => path,
    writeBinaryFile: mocks.write,
  });
  mocks.access.mockImplementation(
    async (_identity, _scope, _name, operation) => await operation()
  );
});
it("does not repeat remote create after a known allocation outlived EVE state persistence", async () => {
  mocks.reserve.mockResolvedValue({ name: "resource", create: false });
  await implementation.start(context, undefined, []);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.open).toHaveBeenCalledWith("resource");
});
it("leaves interrupted allocation fenced without issuing a replacement create", async () => {
  mocks.reserve.mockRejectedValue(new Error("allocation unresolved"));
  await expect(implementation.start(context, undefined, [])).rejects.toThrow(
    "unresolved"
  );
  expect(mocks.create).not.toHaveBeenCalled();
});
it("checks the durable fence again before using cached filesystem handles", async () => {
  const result = await implementation.start(context, undefined, []);
  mocks.access.mockRejectedValue(new Error("session retired"));
  await expect(
    result.handle.sandbox.writeBinaryFile({
      path: "file",
      content: new Uint8Array(),
    })
  ).rejects.toThrow("retired");
  expect(mocks.write).not.toHaveBeenCalled();
});
it("retires before deleting and keeps stop distinct from deletion", async () => {
  const result = await implementation.start(context, undefined, []);
  await result.handle.onSandboxStop();
  expect(mocks.stopWorkspace).toHaveBeenCalled();
  expect(mocks.stop).not.toHaveBeenCalled();
  expect(mocks.retire).not.toHaveBeenCalled();
  await result.handle.onSandboxDelete();
  expect(mocks.retire.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.cleanup.mock.invocationCallOrder[0]
  );
});

it("fences cached process methods and lazy output/file reads after retirement", async () => {
  const pull = vi.fn(
    (controller: ReadableStreamDefaultController<Uint8Array>) => {
      controller.enqueue(new Uint8Array([1]));
    }
  );
  const output = () => new ReadableStream({ pull }, { highWaterMark: 0 });
  const wait = vi.fn().mockResolvedValue({ exitCode: 0 });
  const kill = vi.fn<() => Promise<void>>().mockResolvedValue();
  mocks.create.mockResolvedValue({
    name: "resource",
    spawn: vi
      .fn()
      .mockResolvedValue({ stdout: output(), stderr: output(), wait, kill }),
    readFile: vi.fn().mockResolvedValue(output()),
  });
  const result = await implementation.start(context, undefined, []);
  const process = await result.handle.sandbox.spawn({ command: "fixture" });
  const file = await result.handle.sandbox.readFile({ path: "fixture" });
  expect(pull).not.toHaveBeenCalled();
  mocks.access.mockRejectedValue(new Error("session retired"));
  await expect(process.wait()).rejects.toThrow("retired");
  await expect(process.kill()).rejects.toThrow("retired");
  await expect(process.stdout.getReader().read()).rejects.toThrow("retired");
  await expect(process.stderr.getReader().read()).rejects.toThrow("retired");
  await expect(file?.getReader().read()).rejects.toThrow("retired");
  expect(pull).not.toHaveBeenCalled();
  expect(wait).not.toHaveBeenCalled();
  expect(kill).not.toHaveBeenCalled();
});

it.each([false, true])(
  "copies a fenced file without nesting locks and rechecks retirement (%s)",
  async (retireDuringRead) => {
    let locked = false;
    let retired = false;
    mocks.access.mockImplementation(
      async (_identity, _scope, _name, operation) => {
        if (locked) {
          throw new Error("nested session lock");
        }
        if (retired) {
          throw new Error("session retired");
        }
        locked = true;
        try {
          return await operation();
        } finally {
          locked = false;
        }
      }
    );
    const source = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
          retired = retireDuringRead;
        },
      },
      { highWaterMark: 0 }
    );
    mocks.create.mockResolvedValue({
      name: "resource",
      readFile: vi.fn().mockResolvedValue(source),
      writeBinaryFile: mocks.write,
    });
    const result = await implementation.start(context, undefined, []);
    const content = await result.handle.sandbox.readFile({ path: "source" });
    if (content === null) {
      throw new Error("Missing fixture file");
    }
    const copy = result.handle.sandbox.writeFile({
      path: "destination",
      content,
    });
    if (retireDuringRead) {
      await expect(copy).rejects.toThrow("retired");
      expect(mocks.write).not.toHaveBeenCalled();
    } else {
      await copy;
      expect(mocks.write).toHaveBeenCalledWith({
        path: "destination",
        content: new Uint8Array([1, 2, 3]),
      });
    }
  }
);
