import { expect, test } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import nodePath from "node:path";
import { readLocalEveSandboxInventory } from "./local-sandbox-inventory";
import { tmpdir } from "node:os";

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
    await Promise.all(
      [
        ["old-version", "session"],
        ["new-version", "session"],
        ["foreign", "session-extra"],
      ].map(async ([sessionKey, sessionId]) => {
        await mkdir(nodePath.join(directory, sessionKey), { recursive: true });
        await writeFile(
          nodePath.join(directory, sessionKey, "owner.json"),
          JSON.stringify({
            backendName: "microsandbox",
            sessionId,
            sessionKey,
            version: 1,
          })
        );
      })
    );
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
    await Promise.all(
      [ownedCandidate, foreign, truncated, wrongScope].map(async (key) => {
        await mkdir(nodePath.join(directory, key), { recursive: true });
      })
    );
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
