import { afterEach, expect, spyOn, test } from "bun:test";
import fs, {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { generateDemo, syncDemo } from "../scripts/demo-sync";

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
  const actual = await readFile(
    path.join(options.root, "implementation.ts"),
    "utf-8"
  );
  expect(options.expected.get("implementation.ts")).toBe(actual);
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
  const before = await readFile(
    path.join(options.root, "implementation.ts"),
    "utf-8"
  );
  await expect(syncDemo({ ...options, discard: true })).rejects.toThrow(
    "symlink"
  );
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe(before);
});

test("edits moved upstream can advance the baseline without discarding", async () => {
  const options = await fixture();
  const source =
    "// edit now canonical upstream\nexport type Result = number;\n";
  await writeFile(path.join(options.root, "implementation.ts"), source);
  options.expected.set("implementation.ts", source);
  await expect(syncDemo({ ...options, check: true })).rejects.toThrow(
    `Baseline drift: ${options.baseline}`
  );
  await syncDemo(options);
  await syncDemo({ ...options, check: true });
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe(source);
});

test("baseline key ordering uses locale-independent code-unit order", async () => {
  const options = await fixture();
  const names = ["z.ts", "é.ts", "a.ts", "Z.ts", "_a.ts"];
  for (const file of names) {
    options.expected.set(file, "// canonical\n");
  }
  const collation = spyOn(String.prototype, "localeCompare").mockImplementation(
    () => {
      throw new Error("Locale-dependent ordering");
    }
  );
  try {
    await syncDemo(options);
  } finally {
    collation.mockRestore();
  }
  const baseline = JSON.parse(await readFile(options.baseline, "utf-8"));
  expect(Object.keys(baseline.files)).toEqual(
    [...options.expected.keys()].toSorted()
  );
});

test.each(["source", "baseline"])(
  "a failed %s replacement restores prior source and baseline, permitting retry",
  async (failure) => {
    const options = await fixture();
    const originalSource = await readFile(
      path.join(options.root, "implementation.ts"),
      "utf-8"
    );
    const originalBaseline = await readFile(options.baseline, "utf-8");
    options.expected.set("implementation.ts", "// updated canonical\n");
    options.expected.set("new.ts", "// new canonical\n");
    const target =
      failure === "baseline"
        ? options.baseline
        : path.join(options.root, "new.ts");
    const originalRename = fs.rename;
    let replacedSource = false;
    let failed = false;
    const rename = spyOn(fs, "rename").mockImplementation(
      async (source, destination) => {
        if (
          destination === target &&
          path.basename(String(source)) === "next" &&
          !failed
        ) {
          failed = true;
          throw new Error("Injected replacement failure");
        }
        await originalRename(source, destination);
        if (destination === path.join(options.root, "implementation.ts")) {
          replacedSource = true;
        }
      }
    );
    try {
      await expect(syncDemo(options)).rejects.toThrow(
        "Injected replacement failure"
      );
    } finally {
      rename.mockRestore();
    }
    expect(failed).toBe(true);
    expect(replacedSource).toBe(true);
    expect(
      await readFile(path.join(options.root, "implementation.ts"), "utf-8")
    ).toBe(originalSource);
    expect(await readFile(options.baseline, "utf-8")).toBe(originalBaseline);
    expect(await Bun.file(path.join(options.root, "new.ts")).exists()).toBe(
      false
    );
    const entries = await readdir(options.root);
    expect(entries.some((file) => file.startsWith(".demo-sync-"))).toBe(false);
    await syncDemo(options);
    await syncDemo({ ...options, check: true });
  }
);

test("a symlinked baseline is rejected before source or external target writes", async () => {
  const options = await fixture();
  const external = path.join(options.root, "external.json");
  const before = await readFile(options.baseline, "utf-8");
  await writeFile(external, before);
  await rm(options.baseline);
  await fs.symlink(external, options.baseline);
  options.expected.set("implementation.ts", "// changed canonical\n");
  await expect(syncDemo(options)).rejects.toThrow("symlink");
  expect(await readFile(external, "utf-8")).toBe(before);
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe("// canonical\nexport type Result = string;\n");
});

test("generator setup failure removes its temporary installation directory", async () => {
  const originalRm = fs.rm;
  let temporary: string | undefined;
  const remove = spyOn(fs, "rm").mockImplementation(async (target, options) => {
    temporary = String(target);
    await originalRm(target, options);
  });
  const serve = spyOn(Bun, "serve").mockImplementation(() => {
    throw new Error("Injected server setup failure");
  });
  try {
    await expect(generateDemo()).rejects.toThrow(
      "Injected server setup failure"
    );
  } finally {
    remove.mockRestore();
    serve.mockRestore();
  }
  if (temporary === undefined) {
    throw new Error("Generator did not clean up its temporary directory");
  }
  expect(path.basename(temporary).startsWith("chatjs-demo-")).toBe(true);
  await expect(fs.stat(temporary)).rejects.toThrow("ENOENT");
});
