/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { mkdir, mkdtemp, readFile, rm, symlink, writeFile, } from "node:fs/promises";; import { tmpdir } from "node:os";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 */
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import nodePath from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "vitest";
/* oxlint-enable sort-imports */

import { readLocalEveSandboxInventory } from "./local-sandbox-inventory";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-lines-per-function, max-statements --
 * max-lines-per-function (#510): test("local inventory selects exact native owners across versions and reports unknown keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("local inventory selects exact native owners across versions and reports unknown keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("local inventory selects exact native owners across versions and reports unknown resources", async () => {
  const appRoot = await mkdtemp(
    nodePath.join(tmpdir(), "eve-owner-inventory-")
  );
  const directory = nodePath.join(
    appRoot,
    ".eve",
    "sandbox-cache",
    "microsandbox",
    "sessions"
  );
  try {
    expect(await readLocalEveSandboxInventory(appRoot, ["session"])).toEqual({
      owned: [],
      unattributedDirectories: [],
    });
    for (const [sessionKey, sessionId] of [
      ["old-version", "session"],
      ["new-version", "session"],
      ["foreign", "session-extra"],
    ]) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
      await mkdir(nodePath.join(directory, sessionKey), { recursive: true });
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
      await writeFile(
        nodePath.join(directory, sessionKey, "owner.json"),
        JSON.stringify({
          backendName: "microsandbox",
          sessionId,
          sessionKey,
          version: 1,
        })
      );
    }
    await mkdir(nodePath.join(directory, "legacy"));
    await mkdir(nodePath.join(directory, "malformed"));
    await writeFile(nodePath.join(directory, "malformed", "owner.json"), "{");
    await symlink(
      nodePath.join(directory, "foreign"),
      nodePath.join(directory, "link")
    );
    const result = await readLocalEveSandboxInventory(appRoot, [
      "session",
      "session",
    ]);
    expect(result.owned).toEqual(
      ["new-version", "old-version"].map((sessionKey) => ({
        sessionDirectory: nodePath.join(directory, sessionKey),
        sessionKey,
      }))
    );
    expect(result.unattributedDirectories).toEqual(
      ["legacy", "link", "malformed"].map((name) =>
        nodePath.join(directory, name)
      )
    );
    // A valid owner record copied into another directory does not establish ownership.
    await writeFile(
      nodePath.join(directory, "legacy", "owner.json"),
      await readFile(nodePath.join(directory, "old-version", "owner.json"))
    );
    const resolvedResult1 = await readLocalEveSandboxInventory(appRoot, [
      "session",
    ]);
    expect(resolvedResult1.unattributedDirectories).toContain(
      nodePath.join(directory, "legacy")
    );
    const resolvedResult2 = await readLocalEveSandboxInventory(appRoot, [
      "session-extra",
    ]);
    expect(resolvedResult2.owned).toEqual([
      {
        sessionDirectory: nodePath.join(directory, "foreign"),
        sessionKey: "foreign",
      },
    ]);
  } finally {
    await rm(appRoot, { force: true, recursive: true });
  }
});
/* oxlint-enable max-lines-per-function, max-statements */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("unowned directories remain unattributed regardless of their names") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("unowned directories remain unattributed regardless of their names") uses 25, 0, -1, 16 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("unowned directories remain unattributed regardless of their names", async () => {
  const appRoot = await mkdtemp(
    nodePath.join(tmpdir(), "eve-legacy-inventory-")
  );
  const directory = nodePath.join(
    appRoot,
    ".eve",
    "sandbox-cache",
    "microsandbox",
    "sessions"
  );
  const scope = "0123456789abcdef";
  const target = `wrun_0${"A".repeat(25)}`;
  const unrelated = `wrun_0${"B".repeat(25)}`;
  const prefix = `eve-sbx-ses-microsandbox-${scope}-0123456789ab-`;
  const ownedCandidate = `${prefix}${target}-__root__`;
  const foreign = `${prefix}${unrelated}-__root__`;
  const truncated = `${prefix}${target.slice(0, -1)}-__root__`;
  const wrongScope = foreign.replace(scope, "f".repeat(16));
  try {
    for (const key of [ownedCandidate, foreign, truncated, wrongScope]) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
      await mkdir(nodePath.join(directory, key), { recursive: true });
    }
    const result = await readLocalEveSandboxInventory(appRoot, [target]);
    expect(result.owned).toEqual([]);
    expect(result.unattributedDirectories.toSorted()).toEqual(
      [ownedCandidate, foreign, truncated, wrongScope]
        .map((key) => nodePath.join(directory, key))
        .toSorted()
    );
    // Corrupt explicit ownership cannot be overridden with directory-name inference.
    await writeFile(nodePath.join(directory, foreign, "owner.json"), "{}");
    const resolvedResult3 = await readLocalEveSandboxInventory(appRoot, [
      target,
    ]);
    expect(resolvedResult3.unattributedDirectories).toContain(
      nodePath.join(directory, foreign)
    );
  } finally {
    await rm(appRoot, { force: true, recursive: true });
  }
});
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-statements --
 * max-statements (#512): test("other backend caches and linked provider roots prevent a complete local invento keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("other backend caches and linked provider roots prevent a complete local inventory", async () => {
  const appRoot = await mkdtemp(
    nodePath.join(tmpdir(), "eve-provider-inventory-")
  );
  const cacheRoot = nodePath.join(appRoot, ".eve", "sandbox-cache");
  try {
    const other = nodePath.join(cacheRoot, "docker");
    await mkdir(other, { recursive: true });
    expect(await readLocalEveSandboxInventory(appRoot, ["session"])).toEqual({
      owned: [],
      unattributedDirectories: [other],
    });
    await rm(other, { recursive: true });
    const outside = nodePath.join(appRoot, "outside");
    await mkdir(outside);
    const linked = nodePath.join(cacheRoot, "microsandbox");
    await symlink(outside, linked);
    expect(await readLocalEveSandboxInventory(appRoot, ["session"])).toEqual({
      owned: [],
      unattributedDirectories: [linked],
    });
  } finally {
    await rm(appRoot, { force: true, recursive: true });
  }
});
/* oxlint-enable max-statements */
