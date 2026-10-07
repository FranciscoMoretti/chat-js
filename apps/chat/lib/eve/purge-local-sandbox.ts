/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { readdir, readFile } from "node:fs/promises";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 */
import { readFile, readdir } from "node:fs/promises";
import nodePath from "node:path";

import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

import { localEveSandboxOwnerSchema } from "./local-sandbox-inventory";
/* oxlint-enable import/no-nodejs-modules */

const MINIMUM_SESSION_IDENTIFIER_LENGTH = 1;
const FORK_MANIFEST_VERSION = 1;
const RESOURCE_RECORD_VERSION = 1;
const SANDBOX_METADATA_VERSION = 2;
const EMPTY_RESOURCE_COUNT = 0;
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readResourceRecords's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-continue, unicorn/max-nested-calls --
 * max-statements (#512): readResourceRecords keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): readResourceRecords skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * unicorn/max-nested-calls (#568): readResourceRecords keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const readResourceRecords = async (
  input: SessionResourceInput
): Promise<z.output<typeof resourceSchema>[]> => {
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
  // oxlint-disable-next-line typescript/require-array-sort-compare -- #607: Canonical resource names use deterministic default UTF-16 ordering; locale-dependent comparison would change the ordering contract.
  for (const entry of resourceEntries.toSorted()) {
    if (entry.endsWith(".tmp")) {
      continue;
    }

    const record = resourceSchema.parse(
      JSON.parse(
        // oxlint-disable-next-line eslint/no-await-in-loop -- Keep ordered reads and bounded cleanup sequential.
        await readFile(nodePath.join(resourceDirectory, entry), "utf-8")
      )
    );
    const pattern =
      // oxlint-disable-next-line no-ternary -- Keep pattern as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readLocalSandboxResources's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-continue, unicorn/max-nested-calls */

/* oxlint-disable max-lines-per-function, max-statements, no-continue, no-undefined, typescript/strict-boolean-expressions, unicorn/max-nested-calls --
 * max-lines-per-function (#510): readLocalSandboxResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): readLocalSandboxResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): readLocalSandboxResources skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-undefined (#519): readLocalSandboxResources uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/strict-boolean-expressions (#610): readLocalSandboxResources intentionally keeps the existing falsy-value behavior of metadata?.stateSnapshotName; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): readLocalSandboxResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const readLocalSandboxResources = async (
  input: SessionResourceInput
): Promise<{ sandboxNames: string[]; snapshotNames: string[] }> => {
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
    // oxlint-disable-next-line no-ternary -- Keep metadata as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    metadataText === undefined
      ? undefined
      : metadataSchema.parse(JSON.parse(metadataText));
  // oxlint-disable-next-line no-ternary -- Keep Set argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const sandboxNames = new Set<string>(metadata ? [metadata.sandboxName] : []);
  const recordedSnapshots = new Set<string>();
  const recorded = await readResourceRecords(input);
  for (const record of recorded) {
    // oxlint-disable-next-line no-ternary -- Keep add receiver as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading stateSnapshotName from metadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep snapshots as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const snapshots: string[] = metadata?.stateSnapshotName
    ? [metadata.stateSnapshotName, ...recordedSnapshots]
    : [...recordedSnapshots];
  // oxlint-disable-next-line typescript/require-array-sort-compare -- #607: Canonical resource names use deterministic default UTF-16 ordering; locale-dependent comparison would change the ordering contract.
  for (const entry of entries.toSorted()) {
    // Atomic-write leftovers precede provider creation and are not published records.
    if (entry.endsWith(".tmp")) {
      continue;
    }

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
  if (sandboxNames.size === EMPTY_RESOURCE_COUNT) {
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
      snapshots.length > EMPTY_RESOURCE_COUNT
    ) {
      throw new Error("Sandbox resource inventory is incomplete.");
    }
  }
  return {
    sandboxNames: [...sandboxNames],
    snapshotNames: [...new Set(snapshots)],
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve removeRecordedSnapshots's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-continue, no-undefined, typescript/strict-boolean-expressions, unicorn/max-nested-calls */

/* oxlint-disable max-statements --
 * max-statements (#512): removeRecordedSnapshots keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const removeRecordedSnapshots = async (
  snapshotNames: readonly string[]
): Promise<void> => {
  const { Snapshot } = await import("microsandbox");
  // Snapshot dependencies may not follow family input order. Complete one pass,
  // then retry blocked parents only if another recorded snapshot was removed.
  // Never force deletion or enumerate resources outside this inventory.
  const pending = new Set(snapshotNames);
  while (pending.size > EMPTY_RESOURCE_COUNT) {
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (purgeLocalEveSandboxes); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeLocalEveSandboxes's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements */

/* oxlint-disable max-statements, typescript/promise-function-async --
 * max-statements (#512): purgeLocalEveSandboxes keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/promise-function-async (#606): purgeLocalEveSandboxes preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
/**
 * Purges only validated local-provider resources after every supplied family member is retired.
 * @param {readonly SessionResourceInput[]} inputs Session-key/directory identities whose complete resource inventories are validated before provider I/O.
 * @returns {Promise<Awaited<ReturnType<typeof readLocalSandboxResources>>[]>} Each validated resource inventory after owned sandboxes and snapshots are removed; identity records remain for retries.
 */
export const purgeLocalEveSandboxes = async (
  inputs: readonly SessionResourceInput[]
): Promise<Awaited<ReturnType<typeof readLocalSandboxResources>>[]> => {
  // Validate every member before any provider side effect.
  const resources = await Promise.all(
    inputs.map((input) => readLocalSandboxResources(input))
  );
  if (resources.length === EMPTY_RESOURCE_COUNT) {
    return resources;
  }
  const { Sandbox } = await import("microsandbox");
  for (const name of new Set(
    resources.flatMap(
      (
        resource: ReadonlyNativeSurface<
          Awaited<ReturnType<typeof readLocalSandboxResources>>
        >
      ) => resource.sandboxNames
    )
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
    resources.flatMap(
      (
        resource: ReadonlyNativeSurface<
          Awaited<ReturnType<typeof readLocalSandboxResources>>
        >
      ) => resource.snapshotNames
    )
  );
  // Keep all identity records so process loss and partial failures remain retryable.
  return resources;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, typescript/promise-function-async */
