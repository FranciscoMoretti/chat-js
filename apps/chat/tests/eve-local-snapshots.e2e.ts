import { z } from "zod";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Snapshot } from "microsandbox";
import { expect, test } from "vitest";

test("current provider cleanup preserves independent checkpoint copies and permits final artifact reclamation", async () => {
  if (process.env.MSB_BACKEND !== "local") {
    throw new Error(
      "This disposable provider test requires MSB_BACKEND=local."
    );
  }
  const { createMicrosandboxSandboxProvider } =
    await import("@eve-test/dist/src/execution/sandbox/bindings/microsandbox.js");
  const provider = createMicrosandboxSandboxProvider({
    image: "debian:bookworm-slim",
    memoryMiB: 256,
    setup: { autoInstall: false },
  });
  type Context = Parameters<typeof provider.start>[0];
  const host: Context["host"] = {
    resolveProjectPath: (p) => p,
    loadOptionalPackage: async (input) => await input.importModule(),
  };
  const storagePath = await mkdtemp(
    path.join(tmpdir(), "eve-current-provider-")
  );
  const context = (id: string): Context => ({
    host,
    storagePath,
    session: {
      id,
      auth: { current: null, initiator: null },
      turn: { id: "turn_0", sequence: 0 },
    },
  });
  const id = `eve-current-${randomBytes(16).toString("hex")}`;
  const artifact = await provider.prepare({
    host,
    storagePath,
    sourceRevision: id,
    resources: { source: { kind: "none" } },
    files: {
      list: async () => await Promise.resolve([]),
      read: async () =>
        await Promise.reject(
          Object.assign(new Error("No fixture files"), { code: "ENOENT" })
        ),
      readText: async () =>
        await Promise.reject(
          Object.assign(new Error("No fixture files"), { code: "ENOENT" })
        ),
    },
  });
  let source: Awaited<ReturnType<typeof provider.start>> | undefined;
  let child: Awaited<ReturnType<typeof provider.start>> | undefined;
  let checkpoint:
    | Awaited<ReturnType<NonNullable<typeof provider.fork>["capture"]>>
    | undefined;
  const { fork } = provider;
  if (fork === undefined) {
    throw new Error("Missing checkpoint capability");
  }
  try {
    source = await provider.start(context(`${id}-source`), undefined, artifact);
    await source.handle.sandbox.writeTextFile({
      path: "copy.txt",
      content: "retained boundary",
    });
    checkpoint = await fork.capture(source.handle, "boundary");
    expect(await fork.capture(source.handle, "boundary")).toEqual(checkpoint);
    await source.handle.sandbox.writeTextFile({
      path: "copy.txt",
      content: "later source",
    });
    child = await fork.restore(
      context(`${id}-child`),
      undefined,
      artifact,
      checkpoint
    );
    expect(child.state.sessionIdentity).not.toBe(source.state.sessionIdentity);
    expect(await child.handle.sandbox.readTextFile({ path: "copy.txt" })).toBe(
      "retained boundary"
    );
    await source.handle.onSandboxDelete();
    source = undefined;
    expect(await child.handle.sandbox.readTextFile({ path: "copy.txt" })).toBe(
      "retained boundary"
    );
    await child.handle.onSandboxStop();
    child = {
      ...child,
      handle: await provider.resume(
        context(`${id}-child`),
        artifact,
        child.state
      ),
    };
    expect(await child.handle.sandbox.readTextFile({ path: "copy.txt" })).toBe(
      "retained boundary"
    );
    await child.handle.onSandboxDelete();
    child = undefined;
    child = await fork.restore(
      context(`${id}-later-copy`),
      undefined,
      artifact,
      checkpoint
    );
    expect(await child.handle.sandbox.readTextFile({ path: "copy.txt" })).toBe(
      "retained boundary"
    );
    await child.handle.onSandboxDelete();
    child = undefined;
    // All disposable consumers are gone; reclaim only this test's exact retained artifact.
    const snapshot = z.object({ snapshotName: z.string() }).parse(checkpoint);
    await Snapshot.remove(snapshot.snapshotName);
    await expect(Snapshot.get(snapshot.snapshotName)).rejects.toThrow(
      "snapshot not found"
    );
    checkpoint = undefined;
  } finally {
    await source?.handle.onSandboxDelete();
    await child?.handle.onSandboxDelete();
    if (checkpoint !== undefined) {
      await Snapshot.remove(
        z.object({ snapshotName: z.string() }).parse(checkpoint).snapshotName
      );
    }
    await Snapshot.remove(
      z.object({ snapshotName: z.string() }).parse(artifact).snapshotName
    );
    await rm(storagePath, { recursive: true, force: true });
  }
}, 120_000);
