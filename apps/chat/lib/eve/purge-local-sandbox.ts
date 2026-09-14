import { readdir, readFile } from "node:fs/promises";
import nodePath from "node:path";

import { z } from "zod";

import { localEveSandboxOwnerSchema } from "./local-sandbox-inventory";

const sandboxNamePattern = /^eve-sbx-ses-[a-f0-9]{32}$/u;
const stateSnapshotPattern = /^eve-sbx-state-[a-f0-9]{32}$/u;
const manifestSchema = z.strictObject({
  optionsHash: z.string().min(1),
  sessionKey: z.string().min(1),
  snapshotName: z.string().regex(/^eve-sbx-fork-[a-f0-9]{32}$/u),
  version: z.literal(1),
});
const resourceSchema = z.strictObject({
  kind: z.enum(["sandbox", "snapshot"]),
  name: z.string(),
  sessionKey: z.string().min(1),
  version: z.literal(1),
});
const metadataSchema = z.object({
  optionsHash: z.string().min(1),
  sandboxName: z.string().regex(sandboxNamePattern),
  stateSnapshotName: z.string().regex(stateSnapshotPattern).optional(),
  version: z.literal(2),
});

const readResourceRecords = async (input: {
  sessionDirectory: string;
  sessionKey: string;
}) => {
  const resourceDirectory = nodePath.join(input.sessionDirectory, "resources");
  const resourceEntries = await readdir(resourceDirectory).catch(
    (error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  );
  const records: z.infer<typeof resourceSchema>[] = [];
  for (const entry of resourceEntries.toSorted()) {
    if (entry.endsWith(".tmp")) {
      continue;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    const record = resourceSchema.parse(
      JSON.parse(
        // oxlint-disable-next-line eslint/no-await-in-loop -- Keep ordered reads and bounded cleanup sequential.
        await readFile(nodePath.join(resourceDirectory, entry), "utf-8")
      )
    );
    const pattern =
      record.kind === "sandbox" ? sandboxNamePattern : stateSnapshotPattern;
    if (
      record.sessionKey !== input.sessionKey ||
      entry !== `${record.name}.json` ||
      !pattern.test(record.name)
    ) {
      throw new Error("Sandbox resource ownership is inconsistent.");
    }
    records.push(record);
  }
  return records;
};

const readLocalSandboxResources = async (input: {
  sessionDirectory: string;
  sessionKey: string;
}) => {
  if (nodePath.basename(input.sessionDirectory) !== input.sessionKey) {
    throw new Error("Sandbox directory does not match its session key.");
  }
  const metadataText = await readFile(
    nodePath.join(input.sessionDirectory, "metadata.json"),
    "utf-8"
  ).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  });
  const metadata =
    metadataText === undefined
      ? undefined
      : metadataSchema.parse(JSON.parse(metadataText));
  const sandboxNames = new Set<string>(metadata ? [metadata.sandboxName] : []);
  const recordedSnapshots = new Set<string>();
  const recorded = await readResourceRecords(input);
  for (const record of recorded) {
    (record.kind === "sandbox" ? sandboxNames : recordedSnapshots).add(
      record.name
    );
  }
  const directory = nodePath.join(input.sessionDirectory, "fork-checkpoints");
  const entries = await readdir(directory).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  const snapshots: string[] = metadata?.stateSnapshotName
    ? [metadata.stateSnapshotName, ...recordedSnapshots]
    : [...recordedSnapshots];
  for (const entry of entries.toSorted()) {
    // Atomic-write leftovers precede provider creation and are not published records.
    if (entry.endsWith(".tmp")) {
      continue;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
    const record = manifestSchema.parse(
      // oxlint-disable-next-line eslint/no-await-in-loop -- Keep ordered reads and bounded cleanup sequential.
      JSON.parse(await readFile(nodePath.join(directory, entry), "utf-8"))
    );
    if (
      entry !== `${record.snapshotName}.json` ||
      record.sessionKey !== input.sessionKey
    ) {
      throw new Error("Fork snapshot ownership is inconsistent.");
    }
    snapshots.push(record.snapshotName);
  }
  if (!sandboxNames.size) {
    // The maintained backend publishes owner.json before entering creation and
    // writes every resource identity before provider I/O. An owner-only directory
    // can therefore be left by a failed admission/setup without a VM to remove.
    // Snapshot evidence without a VM record is incomplete, never an empty attempt.
    const owner = localEveSandboxOwnerSchema.parse(
      JSON.parse(
        await readFile(
          nodePath.join(input.sessionDirectory, "owner.json"),
          "utf-8"
        )
      )
    );
    if (
      owner.writeAheadResources !== true ||
      owner.sessionKey !== input.sessionKey ||
      snapshots.length
    ) {
      throw new Error("Sandbox resource inventory is incomplete.");
    }
  }
  return {
    sandboxNames: [...sandboxNames],
    snapshotNames: [...new Set(snapshots)],
  };
};

const removeRecordedSnapshots = async (snapshotNames: string[]) => {
  const { Snapshot } = await import("microsandbox");
  // Snapshot dependencies may not follow family input order. Complete one pass,
  // then retry blocked parents only if another recorded snapshot was removed.
  // Never force deletion or enumerate resources outside this inventory.
  const pending = new Set(snapshotNames);
  while (pending.size) {
    const before = pending.size;
    const errors: unknown[] = [];
    for (const snapshot of pending) {
      try {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
        await Snapshot.remove(snapshot, { force: false });
        pending.delete(snapshot);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("[SnapshotNotFound] snapshot not found:")
        ) {
          pending.delete(snapshot);
        } else {
          errors.push(error);
        }
      }
    }
    if (pending.size === before) {
      throw new AggregateError(
        errors,
        "Recorded sandbox snapshots could not be removed."
      );
    }
  }
};

/** Internal local-provider stage. Caller must retire every supplied family member first. */
export const purgeLocalEveSandboxes = async (
  inputs: {
    sessionDirectory: string;
    sessionKey: string;
  }[]
) => {
  // Validate every member before any provider side effect.
  const resources = await Promise.all(inputs.map(readLocalSandboxResources));
  if (!resources.length) {
    return resources;
  }
  const { Sandbox } = await import("microsandbox");
  for (const name of new Set(
    resources.flatMap((resource) => resource.sandboxNames)
  )) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
      const sandbox = await Sandbox.get(name);
      // Retirement fences execution but can leave the VM alive. Destroy stops
      // and removes this exact handle, refusing a same-name replacement.
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
      await sandbox.destroy();
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          error.code === "sandboxNotFound"
        )
      ) {
        throw error;
      }
    }
  }
  await removeRecordedSnapshots(
    resources.flatMap((resource) => resource.snapshotNames)
  );
  // Keep all identity records so process loss and partial failures remain retryable.
  return resources;
};
