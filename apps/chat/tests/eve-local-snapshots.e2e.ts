import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Sandbox, Snapshot } from "microsandbox";
import { expect, test } from "vitest";
import { fenceLocalEveSandboxMutations } from "../lib/eve/local-sandbox-fence";
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
  const root = await mkdtemp(join(tmpdir(), "eve-snapshot-acceptance-"));
  const sessionDirectory = join(root, name);
  const childDirectory = join(root, childName);
  let sandbox: Sandbox | undefined;
  let childSandbox: Sandbox | undefined;
  try {
    await mkdir(join(sessionDirectory, "fork-checkpoints"), {
      recursive: true,
    });
    await writeFile(
      join(sessionDirectory, "metadata.json"),
      JSON.stringify({
        version: 2,
        optionsHash: "fixture",
        sandboxName: name,
        stateSnapshotName,
      })
    );
    const manifest = join(
      sessionDirectory,
      "fork-checkpoints",
      `${snapshotName}.json`
    );
    await writeFile(
      manifest,
      JSON.stringify({
        version: 1,
        sessionKey: name,
        snapshotName,
        optionsHash: "fixture",
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
    await (await Sandbox.get(childName)).snapshot(childStateSnapshotName);
    await mkdir(childDirectory, { recursive: true });
    await writeFile(
      join(childDirectory, "metadata.json"),
      JSON.stringify({
        version: 2,
        optionsHash: "fixture",
        sandboxName: childName,
        stateSnapshotName: childStateSnapshotName,
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
    expect(JSON.parse(await readFile(manifest, "utf8")).snapshotName).toBe(
      snapshotName
    );
  } finally {
    for (const vm of [sandbox, childSandbox]) {
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
    }
    for (const snapshot of [
      childStateSnapshotName,
      snapshotName,
      stateSnapshotName,
      survivorName,
    ]) {
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
    }
    await rm(root, { recursive: true, force: true });
  }
}, 120_000);

test("EVE checkpoint capture records real provider resources for retryable cleanup", async () => {
  const { microsandbox } = await import("eve/sandbox/microsandbox");
  const backend = microsandbox({
    image: "ghcr.io/vercel/eve:0.52.2",
    setup: { autoInstall: false },
  });
  const appRoot = await mkdtemp(join(tmpdir(), "eve-backend-capture-"));
  const sessionKey = `eve-acceptance-${randomBytes(16).toString("hex")}`;
  const sessionDirectory = join(
    appRoot,
    ".eve",
    "sandbox-cache",
    "microsandbox",
    "sessions",
    sessionKey
  );
  await mkdir(sessionDirectory, { recursive: true });
  await writeFile(
    join(sessionDirectory, "owner.json"),
    JSON.stringify({
      version: 1,
      backendName: "microsandbox",
      sessionKey,
      sessionId: sessionKey,
    })
  );
  const handle = await backend.create({
    runtimeContext: { appRoot },
    sessionKey,
    templateKey: null,
  });
  let child: Awaited<ReturnType<typeof backend.create>> | undefined;
  const inputs = [{ sessionDirectory, sessionKey }];
  try {
    await handle.session.writeTextFile({
      path: "checkpoint.txt",
      content: "at turn zero",
    });
    const checkpoint = await handle.captureForkCheckpoint?.("turn_0");
    expect(checkpoint).toBeDefined();
    if (typeof checkpoint?.snapshotName !== "string") {
      throw new Error("EVE did not return a fork snapshot identity.");
    }
    const manifest = JSON.parse(
      await readFile(
        join(
          sessionDirectory,
          "fork-checkpoints",
          `${checkpoint.snapshotName}.json`
        ),
        "utf8"
      )
    );
    expect(manifest).toMatchObject({
      version: 1,
      sessionKey,
      snapshotName: checkpoint.snapshotName,
      optionsHash: checkpoint.optionsHash,
    });
    await Snapshot.get(checkpoint.snapshotName);
    expect(await handle.captureForkCheckpoint?.("turn_0")).toEqual(checkpoint);
    await handle.session.writeTextFile({
      path: "checkpoint.txt",
      content: "later parent edit",
    });
    const childKey = `${sessionKey}-child`;
    const childDirectory = join(
      appRoot,
      ".eve",
      "sandbox-cache",
      "microsandbox",
      "sessions",
      childKey
    );
    await mkdir(childDirectory, { recursive: true });
    await writeFile(
      join(childDirectory, "owner.json"),
      JSON.stringify({
        version: 1,
        backendName: "microsandbox",
        sessionKey: childKey,
        sessionId: childKey,
      })
    );
    child = await backend.create({
      runtimeContext: { appRoot },
      sessionKey: childKey,
      templateKey: null,
      forkCheckpoint: checkpoint,
    });
    inputs.push({
      sessionKey: childKey,
      sessionDirectory: join(
        appRoot,
        ".eve",
        "sandbox-cache",
        "microsandbox",
        "sessions",
        childKey
      ),
    });
    expect(await child.session.readTextFile({ path: "checkpoint.txt" })).toBe(
      "at turn zero"
    );
    expect(await handle.session.readTextFile({ path: "checkpoint.txt" })).toBe(
      "later parent edit"
    );
    await handle.captureState();
    await child.captureState();
    // Simulate losing the final metadata write: pre-creation records still own
    // the child VM and state snapshot, so cleanup must not need reattachment.
    await rm(join(inputs[1].sessionDirectory, "metadata.json"));
    await child.shutdown();
    await handle.shutdown();
    await fenceLocalEveSandboxMutations(appRoot, [sessionKey, childKey]);
    await expect(handle.captureForkCheckpoint?.("turn_1")).rejects.toThrow(
      "pending deletion"
    );
    await expect(
      backend.create({
        runtimeContext: { appRoot },
        sessionKey,
        templateKey: null,
      })
    ).rejects.toThrow("pending deletion");
    const resources = await purgeLocalEveSandboxes(inputs);
    expect(resources[0].snapshotNames).toContain(checkpoint.snapshotName);
    await expect(Snapshot.get(checkpoint.snapshotName)).rejects.toThrow(
      "snapshot not found"
    );
    expect(resources).toHaveLength(2);
    for (const resource of resources) {
      for (const name of resource.sandboxNames) {
        await expect(Sandbox.get(name)).rejects.toMatchObject({
          code: "sandboxNotFound",
        });
      }
      for (const snapshot of resource.snapshotNames) {
        await expect(Snapshot.get(snapshot)).rejects.toThrow(
          "snapshot not found"
        );
      }
    }
    expect(await purgeLocalEveSandboxes(inputs)).toEqual(resources);
  } finally {
    await child?.shutdown();
    await handle.shutdown();
    await purgeLocalEveSandboxes(inputs);
    await rm(appRoot, { recursive: true, force: true });
  }
}, 60_000);
