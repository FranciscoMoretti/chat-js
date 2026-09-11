import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ remove: vi.fn(), removeSandbox: vi.fn() }));
const remove = mocks.remove;
vi.mock("microsandbox", () => ({
  Snapshot: { remove: mocks.remove },
  Sandbox: { get: async () => ({ remove: mocks.removeSandbox }) },
}));

import { purgeLocalEveSandbox } from "./purge-local-sandbox";

const directories: string[] = [];
beforeEach(() => {
  remove.mockReset();
  mocks.removeSandbox.mockReset();
});
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "eve-snapshot-purge-"));
  directories.push(root);
  const sessionKey = "fixture-session";
  const sessionDirectory = join(root, sessionKey);
  const directory = join(sessionDirectory, "fork-checkpoints");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(sessionDirectory, "metadata.json"),
    JSON.stringify({
      version: 2,
      optionsHash: "options",
      sandboxName: `eve-sbx-ses-${"b".repeat(32)}`,
    })
  );
  const snapshotName = `eve-sbx-fork-${"a".repeat(32)}`;
  const record = {
    version: 1,
    sessionKey,
    snapshotName,
    optionsHash: "options",
  };
  const path = join(directory, `${snapshotName}.json`);
  await writeFile(path, JSON.stringify(record));
  return { sessionKey, sessionDirectory, snapshotName, path, record };
}

test("retains identities through provider failure and treats only explicit missing snapshots as removed", async () => {
  const input = await fixture();
  remove.mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(purgeLocalEveSandbox(input)).rejects.toThrow(
    "provider unavailable"
  );
  expect(JSON.parse(await readFile(input.path, "utf8"))).toEqual(input.record);
  mocks.removeSandbox.mockRejectedValueOnce(
    Object.assign(new Error("sandbox not found"), { code: "sandboxNotFound" })
  );
  remove.mockRejectedValueOnce(
    new Error("[SnapshotNotFound] snapshot not found: fixture")
  );
  expect(await purgeLocalEveSandbox(input)).toEqual({
    sandboxName: `eve-sbx-ses-${"b".repeat(32)}`,
    snapshotNames: [input.snapshotName],
  });
  expect(remove).toHaveBeenLastCalledWith(input.snapshotName, { force: false });
  remove.mockRejectedValueOnce(new Error("runtime library not found"));
  await expect(purgeLocalEveSandbox(input)).rejects.toThrow(
    "runtime library not found"
  );
});

test("validates all records before deletion and rejects another session or shared template", async () => {
  const input = await fixture();
  for (const record of [
    { ...input.record, sessionKey: "other-session" },
    { ...input.record, optionsHash: "other-options" },
    { ...input.record, snapshotName: `eve-sbx-tpl-${"a".repeat(32)}` },
  ]) {
    await writeFile(input.path, JSON.stringify(record));
    await expect(purgeLocalEveSandbox(input)).rejects.toThrow();
    expect(remove).not.toHaveBeenCalled();
    expect(mocks.removeSandbox).not.toHaveBeenCalled();
  }
  await writeFile(input.path, JSON.stringify(input.record));
  await writeFile(
    join(input.sessionDirectory, "fork-checkpoints", "z-invalid.json"),
    "{}"
  );
  await expect(purgeLocalEveSandbox(input)).rejects.toThrow();
  expect(remove).not.toHaveBeenCalled();
  expect(mocks.removeSandbox).not.toHaveBeenCalled();
});
