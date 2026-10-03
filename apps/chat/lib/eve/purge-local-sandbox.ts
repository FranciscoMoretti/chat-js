/* oxlint-disable import/no-nodejs-modules, sort-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { readdir, readFile } from "node:fs/promises";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { readdir, readFile } from "node:fs/promises";
import nodePath from "node:path";

import { z } from "zod";

import { localEveSandboxOwnerSchema } from "./local-sandbox-inventory";
/* oxlint-enable import/no-nodejs-modules, sort-imports */

const sandboxNamePattern = /^eve-sbx-ses-[a-f0-9]{32}$/u;
const stateSnapshotPattern = /^eve-sbx-state-[a-f0-9]{32}$/u;
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): manifestSchema uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const manifestSchema = z.strictObject({
  optionsHash: z.string().min(1),
  sessionKey: z.string().min(1),
  snapshotName: z.string().regex(/^eve-sbx-fork-[a-f0-9]{32}$/u),
  version: z.literal(1),
});
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): resourceSchema uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const resourceSchema = z.strictObject({
  kind: z.enum(["sandbox", "snapshot"]),
  name: z.string(),
  sessionKey: z.string().min(1),
  version: z.literal(1),
});
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): metadataSchema uses 1, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const metadataSchema = z.object({
  optionsHash: z.string().min(1),
  sandboxName: z.string().regex(sandboxNamePattern),
  stateSnapshotName: z.string().regex(stateSnapshotPattern).optional(),
  version: z.literal(2),
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, no-continue, no-ternary, oxc/no-async-await, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * max-statements (#512): readResourceRecords keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): readResourceRecords skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-ternary (#518): readResourceRecords derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): readResourceRecords sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep readResourceRecords's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readResourceRecords accepts input: { sessionDirectory: string; sessionKey: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): readResourceRecords keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable max-statements, no-continue, no-ternary, oxc/no-async-await, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */

/* oxlint-disable max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls --
 * max-lines-per-function (#510): readLocalSandboxResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): readLocalSandboxResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): readLocalSandboxResources skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): readLocalSandboxResources uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): readLocalSandboxResources derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): readLocalSandboxResources uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): readLocalSandboxResources sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): readLocalSandboxResources handles optional metadata?.stateSnapshotName without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep readLocalSandboxResources's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): readLocalSandboxResources accepts input: { sessionDirectory: string; sessionKey: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): readLocalSandboxResources intentionally keeps the existing falsy-value behavior of metadata?.stateSnapshotName; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): readLocalSandboxResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
  if (sandboxNames.size === 0) {
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
      snapshots.length > 0
    ) {
      throw new Error("Sandbox resource inventory is incomplete.");
    }
  }
  return {
    sandboxNames: [...sandboxNames],
    snapshotNames: [...new Set(snapshots)],
  };
};
/* oxlint-enable max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */

/* oxlint-disable max-statements, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): removeRecordedSnapshots keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): removeRecordedSnapshots uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): removeRecordedSnapshots sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): removeRecordedSnapshots accepts snapshotNames: string[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const removeRecordedSnapshots = async (
  snapshotNames: string[]
): Promise<void> => {
  const { Snapshot } = await import("microsandbox");
  // Snapshot dependencies may not follow family input order. Complete one pass,
  // then retry blocked parents only if another recorded snapshot was removed.
  // Never force deletion or enumerate resources outside this inventory.
  const pending = new Set(snapshotNames);
  while (pending.size > 0) {
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
/* oxlint-enable max-statements, no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * import/no-named-export (#527): Preserve the named purgeLocalEveSandboxes API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): purgeLocalEveSandboxes remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): purgeLocalEveSandboxes's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): purgeLocalEveSandboxes's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): purgeLocalEveSandboxes keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): purgeLocalEveSandboxes uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): purgeLocalEveSandboxes sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep purgeLocalEveSandboxes's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep purgeLocalEveSandboxes's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): purgeLocalEveSandboxes accepts inputs: { sessionDirectory: string; sessionKey: string; }[]; input; resource; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): purgeLocalEveSandboxes preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
/** Internal local-provider stage. Caller must retire every supplied family member first. */
export const purgeLocalEveSandboxes = async (
  inputs: {
    sessionDirectory: string;
    sessionKey: string;
  }[]
) => {
  // Validate every member before any provider side effect.
  const resources = await Promise.all(
    inputs.map((input) => readLocalSandboxResources(input))
  );
  if (resources.length === 0) {
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
