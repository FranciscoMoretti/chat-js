/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";; import { tmpdir } from "node:os";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import nodePath from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import { purgeLocalEveSandboxes } from "./purge-local-sandbox";
/* oxlint-enable import/no-nodejs-modules */

const mocks = vi.hoisted(() => ({ destroySandbox: vi.fn(), remove: vi.fn() }));
const { remove } = mocks;
/* oxlint-disable typescript/explicit-function-return-type, typescript/promise-function-async --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("microsandbox")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): vi.mock("microsandbox") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("microsandbox", () => ({
  Sandbox: {
    get: () =>
      Promise.resolve({
        destroy: mocks.destroySandbox,
        remove: () =>
          Promise.reject(
            Object.assign(new Error("sandbox still running"), {
              code: "sandboxStillRunning",
            })
          ),
      }),
  },
  Snapshot: { remove: mocks.remove },
}));
/* oxlint-enable typescript/explicit-function-return-type, typescript/promise-function-async */

const directories: string[] = [];
beforeEach(() => {
  remove.mockReset();
  mocks.destroySandbox.mockReset();
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterEach's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): afterEach uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    await rm(directory, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fixture's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable max-statements, no-magic-numbers, typescript/explicit-function-return-type --
 * max-statements (#512): fixture keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): fixture uses 32 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep fixture's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const fixture = async (letter = "a") => {
  const root = await mkdtemp(nodePath.join(tmpdir(), "eve-snapshot-purge-"));
  directories.push(root);
  const sessionKey = `fixture-session-${letter}`;
  const sandboxName = `eve-sbx-ses-${letter.repeat(32)}`;
  const sessionDirectory = nodePath.join(root, sessionKey);
  const directory = nodePath.join(sessionDirectory, "fork-checkpoints");
  await mkdir(directory, { recursive: true });
  await writeFile(
    nodePath.join(sessionDirectory, "metadata.json"),
    JSON.stringify({
      optionsHash: "options",
      sandboxName,
      version: 2,
    })
  );
  const snapshotName = `eve-sbx-fork-${letter.repeat(32)}`;
  const record = {
    optionsHash: "options",
    sessionKey,
    snapshotName,
    version: 1,
  };
  const path = nodePath.join(directory, `${snapshotName}.json`);
  await writeFile(path, JSON.stringify(record));
  return {
    path,
    record,
    sandboxName,
    sessionDirectory,
    sessionKey,
    snapshotName,
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, typescript/explicit-function-return-type */

test("retains identities through provider failure and treats only explicit missing snapshots as removed", async () => {
  const input = await fixture();
  remove.mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(purgeLocalEveSandboxes([input])).rejects.toMatchObject({
    errors: [expect.objectContaining({ message: "provider unavailable" })],
  });
  expect(JSON.parse(await readFile(input.path, "utf-8"))).toEqual(input.record);
  mocks.destroySandbox.mockRejectedValueOnce(
    Object.assign(new Error("sandbox not found"), { code: "sandboxNotFound" })
  );
  remove.mockRejectedValueOnce(
    new Error("[SnapshotNotFound] snapshot not found: fixture")
  );
  expect(await purgeLocalEveSandboxes([input])).toEqual([
    {
      sandboxNames: [input.sandboxName],
      snapshotNames: [input.snapshotName],
    },
  ]);
  expect(remove).toHaveBeenLastCalledWith(input.snapshotName, { force: false });
  remove.mockRejectedValueOnce(new Error("runtime library not found"));
  await expect(purgeLocalEveSandboxes([input])).rejects.toMatchObject({
    errors: [expect.objectContaining({ message: "runtime library not found" })],
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("validates all records before deletion and rejects another session or shared tem keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("validates all records before deletion and rejects another session or shared tem uses 32 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("validates all records before deletion and rejects another session or shared template", async () => {
  const input = await fixture();
  for (const record of [
    { ...input.record, sessionKey: "other-session" },
    { ...input.record, optionsHash: 42 },
    { ...input.record, snapshotName: `eve-sbx-tpl-${"a".repeat(32)}` },
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    await writeFile(input.path, JSON.stringify(record));
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    await expect(purgeLocalEveSandboxes([input])).rejects.toThrow();
    expect(remove).not.toHaveBeenCalled();
    expect(mocks.destroySandbox).not.toHaveBeenCalled();
  }
  await writeFile(input.path, JSON.stringify(input.record));
  await writeFile(
    nodePath.join(input.sessionDirectory, "fork-checkpoints", "z-invalid.json"),
    "{}"
  );
  await expect(purgeLocalEveSandboxes([input])).rejects.toThrow();
  expect(remove).not.toHaveBeenCalled();
  expect(mocks.destroySandbox).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("validates the whole family and removes all VMs before resolving snapshot depend keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("validates the whole family and removes all VMs before resolving snapshot depend uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("validates the whole family and removes all VMs before resolving snapshot depend accepts [name]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("validates the whole family and removes all VMs before resolving snapshot depend preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("validates the whole family and removes all VMs before resolving snapshot dependencies", async () => {
  const parent = await fixture("a");
  const child = await fixture("b");
  await writeFile(
    child.path,
    JSON.stringify({ ...child.record, sessionKey: "foreign" })
  );
  await expect(purgeLocalEveSandboxes([parent, child])).rejects.toThrow(
    "ownership"
  );
  expect(mocks.destroySandbox).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  await writeFile(child.path, JSON.stringify(child.record));
  let childRemoved = false;
  remove.mockImplementation((name: string) => {
    if (mocks.destroySandbox.mock.calls.length !== 2) {
      throw new Error("All family VMs must be removed first");
    }
    if (name === parent.snapshotName && !childRemoved) {
      throw new Error("snapshot has a dependent child");
    }
    childRemoved = true;
    return Promise.resolve();
  });
  await purgeLocalEveSandboxes([parent, child]);
  // oxlint-disable-next-line typescript/no-unsafe-return -- #598: This purge-local-sandbox fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(remove.mock.calls.map(([name]) => name)).toEqual([
    parent.snapshotName,
    child.snapshotName,
    parent.snapshotName,
  ]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("retains resources created before metadata and across replacements") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("retains resources created before metadata and across replacements") uses 32, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("retains resources created before metadata and across replacements", async () => {
  const input = await fixture();
  await rm(nodePath.join(input.sessionDirectory, "metadata.json"));
  const directory = nodePath.join(input.sessionDirectory, "resources");
  await mkdir(directory);
  const names = [
    `eve-sbx-ses-${"b".repeat(32)}`,
    `eve-sbx-ses-${"c".repeat(32)}`,
  ];
  const snapshot = `eve-sbx-state-${"d".repeat(32)}`;
  for (const name of [...names, snapshot]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    await writeFile(
      nodePath.join(directory, `${name}.json`),
      JSON.stringify({
        kind: name === snapshot ? "snapshot" : "sandbox",
        name,
        sessionKey: input.sessionKey,
        version: 1,
      })
    );
  }
  expect(await purgeLocalEveSandboxes([input])).toEqual([
    {
      sandboxNames: names,
      snapshotNames: [snapshot, input.snapshotName],
    },
  ]);
  expect(mocks.destroySandbox).toHaveBeenCalledTimes(2);
  await writeFile(
    nodePath.join(directory, `${snapshot}.json`),
    JSON.stringify({
      kind: "snapshot",
      name: snapshot,
      sessionKey: "another-session",
      version: 1,
    })
  );
  await expect(purgeLocalEveSandboxes([input])).rejects.toThrow(
    "ownership is inconsistent"
  );
  expect(mocks.destroySandbox).toHaveBeenCalledTimes(2);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined --
 * max-statements (#512): test("an owned attempt that failed before provider creation can finish cleanup") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("an owned attempt that failed before provider creation can finish cleanup") uses 2, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("an owned attempt that failed before provider creation can finish cleanup") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test("an owned attempt that failed before provider creation can finish cleanup", async () => {
  const input = await fixture();
  await rm(nodePath.join(input.sessionDirectory, "metadata.json"));
  await rm(input.path);
  await expect(purgeLocalEveSandboxes([input])).rejects.toThrow();
  const ownerPath = nodePath.join(input.sessionDirectory, "owner.json");
  const owner = {
    backendName: "microsandbox",
    sessionId: "native-session",
    sessionKey: input.sessionKey,
    version: 1,
    writeAheadResources: true,
  };
  await writeFile(
    ownerPath,
    JSON.stringify({ ...owner, writeAheadResources: undefined })
  );
  await expect(purgeLocalEveSandboxes([input])).rejects.toThrow("incomplete");
  await writeFile(ownerPath, JSON.stringify(owner));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
    expect(await purgeLocalEveSandboxes([input])).toEqual([
      { sandboxNames: [], snapshotNames: [] },
    ]);
  }
  expect(JSON.parse(await readFile(ownerPath, "utf-8"))).toEqual(owner);
  await writeFile(
    ownerPath,
    JSON.stringify({ ...owner, sessionKey: "foreign" })
  );
  await expect(purgeLocalEveSandboxes([input])).rejects.toThrow("incomplete");
  await writeFile(ownerPath, JSON.stringify(owner));
  await writeFile(input.path, JSON.stringify(input.record));
  await expect(purgeLocalEveSandboxes([input])).rejects.toThrow("incomplete");
  expect(mocks.destroySandbox).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined */
