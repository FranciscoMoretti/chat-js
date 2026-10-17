import { z } from "zod";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Sandbox, Snapshot } from "microsandbox";
import { expect, test } from "vitest";

import { purgeLocalEveSandboxes } from "../lib/eve/purge-local-sandbox";

// This provider acceptance test touches only newly named local fixture resources.
test("family cleanup removes parent and child VMs and snapshots while preserving an unrelated snapshot", async () => {
  const suffix = randomBytes(16).toString("hex");
  const name = `eve-sbx-ses-${suffix}`;
  const snapshotName = `eve-sbx-fork-${suffix}`;
  const childSuffix = randomBytes(16).toString("hex");
  const childName = `eve-sbx-ses-${childSuffix}`;
  const childStateSnapshotName = `eve-sbx-state-${childSuffix}`;
  const stateSnapshotName = `eve-sbx-state-${suffix}`;
  const survivorName = `eve-sbx-fork-${randomBytes(16).toString("hex")}`;
  const root = await mkdtemp(path.join(tmpdir(), "eve-snapshot-acceptance-"));
  const sessionDirectory = path.join(root, name);
  const childDirectory = path.join(root, childName);
  let sandbox: Sandbox | undefined;
  let childSandbox: Sandbox | undefined;
  try {
    await mkdir(path.join(sessionDirectory, "fork-checkpoints"), {
      recursive: true,
    });
    await writeFile(
      path.join(sessionDirectory, "metadata.json"),
      JSON.stringify({
        optionsHash: "fixture",
        sandboxName: name,
        stateSnapshotName,
        version: 2,
      })
    );
    const manifest = path.join(
      sessionDirectory,
      "fork-checkpoints",
      `${snapshotName}.json`
    );
    await writeFile(
      manifest,
      JSON.stringify({
        optionsHash: "fixture",
        sessionKey: name,
        snapshotName,
        version: 1,
      })
    );
    sandbox = await Sandbox.builder(name)
      .image("ghcr.io/vercel/eve:0.52.2")
      .pullPolicy("if-missing")
      .cpus(1)
      .memory(1024)
      .detached(true)
      .create();
    await sandbox.stopWithTimeout(10_000);
    const handle = await Sandbox.get(name);
    await handle.snapshot(stateSnapshotName);
    await handle.snapshot(snapshotName);
    await handle.snapshot(survivorName);
    childSandbox = await Sandbox.builder(childName)
      .fromSnapshot(snapshotName)
      .cpus(1)
      .memory(1024)
      .detached(true)
      .create();
    await childSandbox.stopWithTimeout(10_000);
    const childHandle = await Sandbox.get(childName);
    await childHandle.snapshot(childStateSnapshotName);
    await mkdir(childDirectory, { recursive: true });
    await writeFile(
      path.join(childDirectory, "metadata.json"),
      JSON.stringify({
        optionsHash: "fixture",
        sandboxName: childName,
        stateSnapshotName: childStateSnapshotName,
        version: 2,
      })
    );
    await Snapshot.get(snapshotName);
    await Snapshot.get(survivorName);
    expect(
      await purgeLocalEveSandboxes([
        { sessionDirectory, sessionKey: name },
        { sessionDirectory: childDirectory, sessionKey: childName },
      ])
    ).toEqual([
      {
        sandboxNames: [name],
        snapshotNames: [stateSnapshotName, snapshotName],
      },
      { sandboxNames: [childName], snapshotNames: [childStateSnapshotName] },
    ]);
    sandbox = undefined;
    childSandbox = undefined;
    await expect(Sandbox.get(childName)).rejects.toMatchObject({
      code: "sandboxNotFound",
    });
    await expect(Snapshot.get(childStateSnapshotName)).rejects.toThrow(
      "snapshot not found"
    );
    await expect(Sandbox.get(name)).rejects.toMatchObject({
      code: "sandboxNotFound",
    });
    await expect(Snapshot.get(stateSnapshotName)).rejects.toThrow(
      "snapshot not found"
    );
    await expect(Snapshot.get(snapshotName)).rejects.toThrow(
      "snapshot not found"
    );
    await Snapshot.get(survivorName);
    expect(
      await purgeLocalEveSandboxes([
        { sessionDirectory, sessionKey: name },
        { sessionDirectory: childDirectory, sessionKey: childName },
      ])
    ).toEqual([
      {
        sandboxNames: [name],
        snapshotNames: [stateSnapshotName, snapshotName],
      },
      { sandboxNames: [childName], snapshotNames: [childStateSnapshotName] },
    ]);

    expect(
      z
        .looseObject({ snapshotName: z.string() })
        .parse(JSON.parse(await readFile(manifest, "utf-8"))).snapshotName
    ).toBe(snapshotName);
  } finally {
    await Promise.all(
      [sandbox, childSandbox].map(async (vm) => {
        await vm?.destroy().catch((error: unknown) => {
          if (
            !(
              error instanceof Error &&
              "code" in error &&
              error.code === "sandboxNotFound"
            )
          ) {
            throw error;
          }
        });
      })
    );
    await Promise.all(
      [
        childStateSnapshotName,
        snapshotName,
        stateSnapshotName,
        survivorName,
      ].map(async (snapshot) => {
        await Snapshot.remove(snapshot).catch((error: unknown) => {
          if (
            !(
              error instanceof Error &&
              error.message.startsWith("[SnapshotNotFound] snapshot not found:")
            )
          ) {
            throw error;
          }
        });
      })
    );
    await rm(root, { force: true, recursive: true });
  }
}, 120_000);

// Exercise the installed current provider; app erasure still requires its own positive ownership proof.
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
