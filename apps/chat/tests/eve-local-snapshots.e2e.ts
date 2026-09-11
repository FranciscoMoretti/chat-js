import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Sandbox, Snapshot } from "microsandbox";
import { expect, test } from "vitest";
import { purgeLocalEveSandbox } from "../lib/eve/purge-local-sandbox";

// This provider acceptance test touches only newly named local fixture resources.
test("local cleanup removes a VM and its recorded snapshots while preserving an unrelated snapshot", async () => {
  const suffix = randomBytes(16).toString("hex");
  const name = `eve-sbx-ses-${suffix}`;
  const snapshotName = `eve-sbx-fork-${suffix}`;
  const stateSnapshotName = `eve-sbx-state-${suffix}`;
  const survivorName = `eve-sbx-fork-${randomBytes(16).toString("hex")}`;
  const root = await mkdtemp(join(tmpdir(), "eve-snapshot-acceptance-"));
  const sessionDirectory = join(root, name);
  let sandbox: Sandbox | undefined;
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
    await Snapshot.get(snapshotName);
    await Snapshot.get(survivorName);
    expect(
      await purgeLocalEveSandbox({ sessionDirectory, sessionKey: name })
    ).toEqual({
      sandboxName: name,
      snapshotNames: [stateSnapshotName, snapshotName],
    });
    sandbox = undefined;
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
      await purgeLocalEveSandbox({ sessionDirectory, sessionKey: name })
    ).toEqual({
      sandboxName: name,
      snapshotNames: [stateSnapshotName, snapshotName],
    });
    expect(JSON.parse(await readFile(manifest, "utf8")).snapshotName).toBe(
      snapshotName
    );
  } finally {
    await sandbox?.destroy();
    for (const snapshot of [snapshotName, stateSnapshotName, survivorName]) {
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
