import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { readLocalEveSandboxInventory } from "./local-sandbox-inventory";

test("local inventory selects exact native owners across versions and reports unknown resources", async () => {
  const appRoot = await mkdtemp(join(tmpdir(), "eve-owner-inventory-"));
  const directory = join(
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
      await mkdir(join(directory, sessionKey), { recursive: true });
      await writeFile(
        join(directory, sessionKey, "owner.json"),
        JSON.stringify({
          version: 1,
          backendName: "microsandbox",
          sessionKey,
          sessionId,
        })
      );
    }
    await mkdir(join(directory, "legacy"));
    await mkdir(join(directory, "malformed"));
    await writeFile(join(directory, "malformed", "owner.json"), "{");
    await symlink(join(directory, "foreign"), join(directory, "link"));
    const result = await readLocalEveSandboxInventory(appRoot, [
      "session",
      "session",
    ]);
    expect(result.owned).toEqual(
      ["new-version", "old-version"].map((sessionKey) => ({
        sessionKey,
        sessionDirectory: join(directory, sessionKey),
      }))
    );
    expect(result.unattributedDirectories).toEqual(
      ["legacy", "link", "malformed"].map((name) => join(directory, name))
    );
    // A valid owner record copied into another directory does not establish ownership.
    await writeFile(
      join(directory, "legacy", "owner.json"),
      await readFile(join(directory, "old-version", "owner.json"))
    );
    expect(
      (await readLocalEveSandboxInventory(appRoot, ["session"]))
        .unattributedDirectories
    ).toContain(join(directory, "legacy"));
    expect(
      (await readLocalEveSandboxInventory(appRoot, ["session-extra"])).owned
    ).toEqual([
      { sessionKey: "foreign", sessionDirectory: join(directory, "foreign") },
    ]);
  } finally {
    await rm(appRoot, { recursive: true, force: true });
  }
});

test("only canonical unrelated legacy keys are excluded; possible family resources stay unresolved", async () => {
  const appRoot = await mkdtemp(join(tmpdir(), "eve-legacy-inventory-"));
  const directory = join(
    appRoot,
    ".eve",
    "sandbox-cache",
    "microsandbox",
    "sessions"
  );
  const scope = createHash("sha256")
    .update(await realpath(appRoot))
    .digest("hex")
    .slice(0, 16);
  const target = `wrun_0${"A".repeat(25)}`;
  const unrelated = `wrun_0${"B".repeat(25)}`;
  const prefix = `eve-sbx-ses-microsandbox-${scope}-0123456789ab-`;
  const ownedCandidate = `${prefix}${target}-__root__`;
  const foreign = `${prefix}${unrelated}-__root__`;
  const truncated = `${prefix}${target.slice(0, -1)}-__root__`;
  const wrongScope = foreign.replace(scope, "f".repeat(16));
  try {
    for (const key of [ownedCandidate, foreign, truncated, wrongScope]) {
      await mkdir(join(directory, key), { recursive: true });
    }
    const result = await readLocalEveSandboxInventory(appRoot, [target]);
    expect(result.owned).toEqual([]);
    expect(result.unattributedDirectories.sort()).toEqual(
      [ownedCandidate, truncated, wrongScope]
        .map((key) => join(directory, key))
        .sort()
    );
    // Corrupt explicit ownership cannot be overridden with directory-name inference.
    await writeFile(join(directory, foreign, "owner.json"), "{}");
    expect(
      (await readLocalEveSandboxInventory(appRoot, [target]))
        .unattributedDirectories
    ).toContain(join(directory, foreign));
  } finally {
    await rm(appRoot, { recursive: true, force: true });
  }
});
