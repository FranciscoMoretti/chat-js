import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { syncDemo } from "../scripts/demo-sync";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});
const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "demo-sync-test-"));
  directories.push(root);
  const baseline = path.join(root, "baseline.json");
  const expected = new Map([
    ["implementation.ts", "// canonical\nexport type Result = string;\n"],
  ]);
  await syncDemo({ baseline, expected, root });
  return { baseline, expected, root };
};

test("types and comments drift; canonical changes sync and repeated sync is deterministic", async () => {
  const fixtureOptions = await fixture();
  const before = await readFile(fixtureOptions.baseline, "utf-8");
  await syncDemo(fixtureOptions);
  expect(await readFile(fixtureOptions.baseline, "utf-8")).toBe(before);
  for (const source of [
    "// revised comment\nexport type Result = string;\n",
    "// canonical\nexport type Result = number;\n",
  ]) {
    const options = {
      ...fixtureOptions,
      expected: new Map([["implementation.ts", source]]),
    };
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each change is checked before synchronizing the next baseline.
    await expect(syncDemo({ ...options, check: true })).rejects.toThrow(
      "Demo source drift"
    );
    // oxlint-disable-next-line eslint/no-await-in-loop -- See above.
    await syncDemo(options);
    // oxlint-disable-next-line eslint/no-await-in-loop -- See above.
    await syncDemo({ ...options, check: true });
  }
});

test("local edits stop all writes; explicit discard restores canonical source", async () => {
  const options = await fixture();
  await writeFile(
    path.join(options.root, "implementation.ts"),
    "// local edit\n"
  );
  const before = await readFile(options.baseline, "utf-8");
  options.expected.set("new.ts", "// new upstream file\n");
  await expect(syncDemo(options)).rejects.toThrow("implementation.ts");
  expect(await Bun.file(path.join(options.root, "new.ts")).exists()).toBe(
    false
  );
  expect(await readFile(options.baseline, "utf-8")).toBe(before);
  await syncDemo({ ...options, discard: true });
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe(options.expected.get("implementation.ts"));
});

test("missing tracked files are edits and an untracked existing file is protected", async () => {
  const options = await fixture();
  await rm(path.join(options.root, "implementation.ts"));
  await expect(syncDemo(options)).rejects.toThrow(
    "Edited registry-owned demo files"
  );
  await syncDemo({ ...options, discard: true });
  await writeFile(path.join(options.root, "new.ts"), "// user file\n");
  options.expected.set("new.ts", "// canonical file\n");
  await expect(syncDemo(options)).rejects.toThrow("new.ts");
});

test("sync preserves app-owned UI order and extensions and rejects removed ownership", async () => {
  const options = await fixture();
  const files = [
    "composer-controls.ts",
    "settings-items.ts",
    "tools/chatjs/custom-tools.ts",
    "tools/chatjs/custom-ui.ts",
  ];
  await Promise.all(
    files.map(async (file) => {
      await mkdir(path.dirname(path.join(options.root, file)), {
        recursive: true,
      });
      await writeFile(
        path.join(options.root, file),
        "// app-owned order and extensions\n"
      );
    })
  );
  await syncDemo(options);
  expect(
    await Promise.all(
      files.map((file) => readFile(path.join(options.root, file), "utf-8"))
    )
  ).toEqual(files.map(() => "// app-owned order and extensions\n"));
  await expect(syncDemo({ ...options, expected: new Map() })).rejects.toThrow(
    "removal is outside demo sync scope"
  );
});

test("symlink destinations are rejected before writes", async () => {
  const options = await fixture();
  const { symlink } = await import("node:fs/promises");
  await symlink(
    path.join(options.root, "implementation.ts"),
    path.join(options.root, "linked.ts")
  );
  options.expected.set("linked.ts", "// canonical\n");
  await expect(syncDemo({ ...options, discard: true })).rejects.toThrow(
    "symlink"
  );
});

test("edits moved upstream can advance the baseline without discarding", async () => {
  const options = await fixture();
  const source =
    "// edit now canonical upstream\nexport type Result = number;\n";
  await writeFile(path.join(options.root, "implementation.ts"), source);
  options.expected.set("implementation.ts", source);
  await syncDemo(options);
  await syncDemo({ ...options, check: true });
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe(source);
});
