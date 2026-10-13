import { isNonEmptyString } from "@/lib/is-non-empty-string";

import { readFile, readdir } from "node:fs/promises";
import type { Snapshot as MicrosandboxSnapshot } from "microsandbox";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { localEveSandboxOwnerSchema } from "./local-sandbox-inventory";
import nodePath from "node:path";
import { z } from "zod";

const MINIMUM_SESSION_IDENTIFIER_LENGTH = 1;
const FORK_MANIFEST_VERSION = 1;
const RESOURCE_RECORD_VERSION = 1;
const SANDBOX_METADATA_VERSION = 2;
const EMPTY_RESOURCE_COUNT = 0;
const SNAPSHOT_REMOVAL_FAILURE =
  "Recorded sandbox snapshots could not be removed.";
interface SessionResourceInput {
  readonly sessionDirectory: string;
  readonly sessionKey: string;
}

const sandboxNamePattern = /^eve-sbx-ses-[a-f0-9]{32}$/u;
const stateSnapshotPattern = /^eve-sbx-state-[a-f0-9]{32}$/u;
const manifestSchema = z.strictObject({
  optionsHash: z.string().min(MINIMUM_SESSION_IDENTIFIER_LENGTH),
  sessionKey: z.string().min(MINIMUM_SESSION_IDENTIFIER_LENGTH),
  snapshotName: z.string().regex(/^eve-sbx-fork-[a-f0-9]{32}$/u),
  version: z.literal(FORK_MANIFEST_VERSION),
});
const resourceSchema = z.strictObject({
  kind: z.enum(["sandbox", "snapshot"]),
  name: z.string(),
  sessionKey: z.string().min(MINIMUM_SESSION_IDENTIFIER_LENGTH),
  version: z.literal(RESOURCE_RECORD_VERSION),
});
const metadataSchema = z.object({
  optionsHash: z.string().min(MINIMUM_SESSION_IDENTIFIER_LENGTH),
  sandboxName: z.string().regex(sandboxNamePattern),
  stateSnapshotName: z.string().regex(stateSnapshotPattern).optional(),
  version: z.literal(SANDBOX_METADATA_VERSION),
});

interface SandboxResources {
  sandboxNames: string[];
  snapshotNames: string[];
}
type ReadonlySandboxResources = ReadonlyNativeSurface<SandboxResources>;
const parseOwnedResourceRecord = (
  recordText: string,
  entry: string,
  input: SessionResourceInput
): z.output<typeof resourceSchema> => {
  const record = resourceSchema.parse(JSON.parse(recordText));
  const pattern =
    record.kind === "sandbox" ? sandboxNamePattern : stateSnapshotPattern;
  if (
    record.sessionKey !== input.sessionKey ||
    entry !== `${record.name}.json` ||
    !pattern.test(record.name)
  ) {
    throw new Error("Sandbox resource ownership is inconsistent.");
  }
  return record;
};
const readDirectoryEntries = async (directory: string): Promise<string[]> => {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};
const readResourceRecords = async (
  input: SessionResourceInput
): Promise<z.output<typeof resourceSchema>[]> => {
  const resourceDirectory = nodePath.join(input.sessionDirectory, "resources");
  const resourceEntries = await readDirectoryEntries(resourceDirectory);
  const records: z.infer<typeof resourceSchema>[] = [];
  for (const entry of resourceEntries.toSorted(
    (left, right) => Number(left > right) - Number(left < right)
  )) {
    if (!entry.endsWith(".tmp")) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Read and parse one uncapped resource record per session at a time to bound raw JSON memory; all ownership validation must finish before provider effects.
      const recordText = await readFile(
        nodePath.join(resourceDirectory, entry),
        "utf-8"
      );
      records.push(parseOwnedResourceRecord(recordText, entry, input));
    }
  }
  return records;
};

const readLocalSandboxMetadata = async (
  sessionDirectory: string
): Promise<
  ReadonlyNativeSurface<z.output<typeof metadataSchema> | undefined>
> => {
  const metadataText = await readFile(
    nodePath.join(sessionDirectory, "metadata.json"),
    "utf-8"
  ).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  });
  return metadataText === undefined
    ? undefined
    : metadataSchema.parse(JSON.parse(metadataText));
};

const collectLocalSandboxResourceNames = async (
  input: SessionResourceInput,
  metadata: ReadonlyNativeSurface<z.output<typeof metadataSchema> | undefined>
): Promise<{
  sandboxNames: Set<string>;
  recordedSnapshots: Set<string>;
}> => {
  const sandboxNames = new Set<string>(metadata ? [metadata.sandboxName] : []);
  const recordedSnapshots = new Set<string>();
  const recorded = await readResourceRecords(input);
  for (const record of recorded) {
    (record.kind === "sandbox" ? sandboxNames : recordedSnapshots).add(
      record.name
    );
  }
  return { recordedSnapshots, sandboxNames };
};
const isSnapshotNotFound = (error: unknown): boolean =>
  error instanceof Error &&
  error.message.startsWith("[SnapshotNotFound] snapshot not found:");
const assertSnapshotRemovalProgress = (
  before: number,
  pending: ReadonlyNativeSurface<Set<string>>,
  errors: readonly unknown[]
): void => {
  if (pending.size === before) {
    throw new AggregateError(errors, SNAPSHOT_REMOVAL_FAILURE);
  }
};
const removeRecordedSnapshotPass = async (
  Snapshot: ReadonlyNativeSurface<typeof MicrosandboxSnapshot>,
  pending: ReadonlyNativeSurface<Set<string>>
): Promise<void> => {
  const before = pending.size;
  const errors: unknown[] = [];
  for (const snapshot of pending) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Snapshot parent removal depends on earlier child deletions; retain dependency order within each pass and retry blocked parents only after progress.
      await Snapshot.remove(snapshot, { force: false });
      pending.delete(snapshot);
    } catch (error) {
      if (isSnapshotNotFound(error)) {
        pending.delete(snapshot);
      } else {
        errors.push(error);
      }
    }
  }
  assertSnapshotRemovalProgress(before, pending, errors);
};

const readForkCheckpointSnapshotName = async (
  directory: string,
  entry: string,
  input: SessionResourceInput
): Promise<string> => {
  const recordText = await readFile(nodePath.join(directory, entry), "utf-8");
  const record = manifestSchema.parse(JSON.parse(recordText));
  if (
    entry !== `${record.snapshotName}.json` ||
    record.sessionKey !== input.sessionKey
  ) {
    throw new Error("Fork snapshot ownership is inconsistent.");
  }
  return record.snapshotName;
};

const readForkCheckpointSnapshotNames = async (
  input: SessionResourceInput,
  metadata: ReadonlyNativeSurface<z.output<typeof metadataSchema> | undefined>,
  recordedSnapshots: ReadonlyNativeSurface<ReadonlySet<string>>
): Promise<string[]> => {
  const directory = nodePath.join(input.sessionDirectory, "fork-checkpoints");
  const entries = await readDirectoryEntries(directory);
  const snapshots: string[] =
    metadata && isNonEmptyString(metadata.stateSnapshotName)
      ? [metadata.stateSnapshotName, ...recordedSnapshots]
      : [...recordedSnapshots];
  for (const entry of entries.toSorted(
    (left, right) => Number(left > right) - Number(left < right)
  )) {
    if (!entry.endsWith(".tmp")) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Read and parse one uncapped fork manifest per session at a time to bound raw JSON memory; all ownership validation must finish before provider effects.
      const snapshotName = await readForkCheckpointSnapshotName(
        directory,
        entry,
        input
      );
      snapshots.push(snapshotName);
    }
  }
  return snapshots;
};

const assertEmptySandboxInventoryIsComplete = async (
  input: SessionResourceInput,
  sandboxCount: number,
  snapshotCount: number
): Promise<void> => {
  if (sandboxCount === EMPTY_RESOURCE_COUNT) {
    // Maintained backends write owner.json before creation and every resource identity before provider I/O.
    const ownerText = await readFile(
      nodePath.join(input.sessionDirectory, "owner.json"),
      "utf-8"
    );
    const owner = localEveSandboxOwnerSchema.parse(JSON.parse(ownerText));
    if (
      owner.writeAheadResources !== true ||
      owner.sessionKey !== input.sessionKey ||
      snapshotCount > EMPTY_RESOURCE_COUNT
    ) {
      throw new Error("Sandbox resource inventory is incomplete.");
    }
  }
};

const readLocalSandboxResources = async (
  input: SessionResourceInput
): Promise<SandboxResources> => {
  if (nodePath.basename(input.sessionDirectory) !== input.sessionKey) {
    throw new Error("Sandbox directory does not match its session key.");
  }
  const metadata = await readLocalSandboxMetadata(input.sessionDirectory);
  const { recordedSnapshots, sandboxNames } =
    await collectLocalSandboxResourceNames(input, metadata);
  const snapshots = await readForkCheckpointSnapshotNames(
    input,
    metadata,
    recordedSnapshots
  );
  await assertEmptySandboxInventoryIsComplete(
    input,
    sandboxNames.size,
    snapshots.length
  );
  return {
    sandboxNames: [...sandboxNames],
    snapshotNames: [...new Set(snapshots)],
  };
};

const removeRecordedSnapshots = async (
  snapshotNames: readonly string[]
): Promise<void> => {
  const { Snapshot } = await import("microsandbox");
  // Retry blocked parents only after the prior pass removes a dependency.
  const pending = new Set(snapshotNames);
  while (pending.size > EMPTY_RESOURCE_COUNT) {
    // Retry only after a complete dependency pass removes a parent.
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each pass changes the pending dependency set; retry blocked parents only after a completed pass removes a child.
    await removeRecordedSnapshotPass(Snapshot, pending);
  }
};

const destroyOwnedSandboxes = async (
  resources: readonly ReadonlySandboxResources[]
): Promise<void> => {
  const { Sandbox } = await import("microsandbox");
  for (const name of new Set(
    resources.flatMap((resource) => resource.sandboxNames)
  )) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Bound provider cleanup to one live VM handle at a time; resolve the exact handle before destruction and finish every VM before snapshot removal.
      const sandbox = await Sandbox.get(name);
      // Retirement fences execution but can leave the VM alive. Destroy stops
      // and removes this exact handle, refusing a same-name replacement.
      // oxlint-disable-next-line eslint/no-await-in-loop -- Finish destruction of the resolved exact VM before opening another handle; keep provider cleanup bounded to one active VM.
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
};

/**
 * Purges only validated local-provider resources after every supplied family member is retired.
 * @param {readonly SessionResourceInput[]} inputs Session-key/directory identities whose complete resource inventories are validated before provider I/O.
 * @returns {Promise<Awaited<ReturnType<typeof readLocalSandboxResources>>[]>} Each validated resource inventory after owned sandboxes and snapshots are removed; identity records remain for retries.
 */
export const purgeLocalEveSandboxes = async (
  inputs: readonly SessionResourceInput[]
): Promise<SandboxResources[]> => {
  // Validate every member before any provider side effect.
  const resources = await Promise.all(
    inputs.map(async (input) => await readLocalSandboxResources(input))
  );
  if (resources.length === EMPTY_RESOURCE_COUNT) {
    return resources;
  }
  await destroyOwnedSandboxes(resources);
  await removeRecordedSnapshots(
    resources.flatMap(
      (resource: ReadonlySandboxResources) => resource.snapshotNames
    )
  );
  // Keep all identity records so process loss and partial failures remain retryable.
  return resources;
};
