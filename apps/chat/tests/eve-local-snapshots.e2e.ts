/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { randomBytes } from "node:crypto";; import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";; import { tmpdir } from "node:os";; import path from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/eve/local-sandbox-fence"; "../lib/eve/purge-local-sandbox" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { randomBytes } from "node:crypto";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable sort-imports */
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import path from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { Sandbox, Snapshot } from "microsandbox";
/* oxlint-enable sort-imports */
import { expect, test } from "vitest";

import { fenceLocalEveSandboxMutations } from "../lib/eve/local-sandbox-fence";
import { purgeLocalEveSandboxes } from "../lib/eve/purge-local-sandbox";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined --
 * init-declarations (#507): test("family cleanup removes parent and child VMs and snapshots while preserving an u assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("family cleanup removes parent and child VMs and snapshots while preserving an u keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("family cleanup removes parent and child VMs and snapshots while preserving an u keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("family cleanup removes parent and child VMs and snapshots while preserving an u uses 16, 1, 1024, 10_000, 120_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("family cleanup removes parent and child VMs and snapshots while preserving an u uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Read the native snapshot manifest unchanged so the test verifies its persisted name and shape.
    expect(JSON.parse(await readFile(manifest, "utf-8")).snapshotName).toBe(
      snapshotName
    );
  } finally {
    for (const vm of [sandbox, childSandbox]) {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading destroy from vm; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    await rm(root, { force: true, recursive: true });
  }
}, 120_000);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null --
 * init-declarations (#507): test("EVE checkpoint capture records real provider resources for retryable cleanup") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("EVE checkpoint capture records real provider resources for retryable cleanup") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("EVE checkpoint capture records real provider resources for retryable cleanup") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("EVE checkpoint capture records real provider resources for retryable cleanup") uses 16, 1, 0, 2, 60_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): test("EVE checkpoint capture records real provider resources for retryable cleanup") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("EVE checkpoint capture records real provider resources for retryable cleanup", async () => {
  const { microsandbox } = await import("eve/sandbox/microsandbox");
  const backend = microsandbox({
    image: "ghcr.io/vercel/eve:0.52.2",
    setup: { autoInstall: false },
  });
  const appRoot = await mkdtemp(path.join(tmpdir(), "eve-backend-capture-"));
  const sessionKey = `eve-acceptance-${randomBytes(16).toString("hex")}`;
  const sessionDirectory = path.join(
    appRoot,
    ".eve",
    "sandbox-cache",
    "microsandbox",
    "sessions",
    sessionKey
  );
  await mkdir(sessionDirectory, { recursive: true });
  await writeFile(
    path.join(sessionDirectory, "owner.json"),
    JSON.stringify({
      backendName: "microsandbox",
      sessionId: sessionKey,
      sessionKey,
      version: 1,
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
      content: "at turn zero",
      path: "checkpoint.txt",
    });
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling handle.captureForkCheckpoint; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
    const checkpoint = await handle.captureForkCheckpoint?.("turn_0");
    expect(checkpoint).toBeDefined();
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading snapshotName from checkpoint; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (typeof checkpoint?.snapshotName !== "string") {
      throw new TypeError("EVE did not return a fork snapshot identity.");
    }
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Read the native snapshot manifest unchanged so the test verifies its persisted name and shape.
    const manifest = JSON.parse(
      await readFile(
        path.join(
          sessionDirectory,
          "fork-checkpoints",
          `${checkpoint.snapshotName}.json`
        ),
        "utf-8"
      )
    );
    expect(manifest).toMatchObject({
      optionsHash: checkpoint.optionsHash,
      sessionKey,
      snapshotName: checkpoint.snapshotName,
      version: 1,
    });
    await Snapshot.get(checkpoint.snapshotName);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling handle.captureForkCheckpoint; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(await handle.captureForkCheckpoint?.("turn_0")).toEqual(checkpoint);
    await handle.session.writeTextFile({
      content: "later parent edit",
      path: "checkpoint.txt",
    });
    const childKey = `${sessionKey}-child`;
    const childDirectory = path.join(
      appRoot,
      ".eve",
      "sandbox-cache",
      "microsandbox",
      "sessions",
      childKey
    );
    await mkdir(childDirectory, { recursive: true });
    await writeFile(
      path.join(childDirectory, "owner.json"),
      JSON.stringify({
        backendName: "microsandbox",
        sessionId: childKey,
        sessionKey: childKey,
        version: 1,
      })
    );
    child = await backend.create({
      forkCheckpoint: checkpoint,
      runtimeContext: { appRoot },
      sessionKey: childKey,
      templateKey: null,
    });
    inputs.push({
      sessionDirectory: path.join(
        appRoot,
        ".eve",
        "sandbox-cache",
        "microsandbox",
        "sessions",
        childKey
      ),
      sessionKey: childKey,
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
    await rm(path.join(inputs[1].sessionDirectory, "metadata.json"));
    await child.shutdown();
    await handle.shutdown();
    await fenceLocalEveSandboxMutations(appRoot, [sessionKey, childKey]);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling handle.captureForkCheckpoint; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading shutdown from child; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    await child?.shutdown();
    await handle.shutdown();
    await purgeLocalEveSandboxes(inputs);
    await rm(appRoot, { force: true, recursive: true });
  }
}, 60_000);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null */

/* oxlint-disable max-lines -- #509: This eve-local-snapshots.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
