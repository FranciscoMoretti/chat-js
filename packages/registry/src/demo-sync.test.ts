import { afterEach, expect, spyOn, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import fs, {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { generateDemo, syncDemo } from "../scripts/demo-sync";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

const directories: string[] = [];
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
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
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
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
    // oxlint-disable-next-line eslint/no-await-in-loop, typescript/await-thenable, typescript/no-confusing-void-expression -- Each change is checked before synchronizing the next baseline. Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(syncDemo({ ...options, check: true })).rejects.toThrow(
      "Demo source drift"
    );
    // oxlint-disable-next-line eslint/no-await-in-loop -- See above.
    await syncDemo(options);
    // oxlint-disable-next-line eslint/no-await-in-loop -- See above.
    await syncDemo({ ...options, check: true });
  }
});
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
test("local edits stop all writes; explicit discard restores canonical source", async () => {
  const options = await fixture();
  await writeFile(
    path.join(options.root, "implementation.ts"),
    "// local edit\n"
  );
  const before = await readFile(options.baseline, "utf-8");
  options.expected.set("new.ts", "// new upstream file\n");
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
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
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
test("missing tracked files are edits and an untracked existing file is protected", async () => {
  const options = await fixture();
  await rm(path.join(options.root, "implementation.ts"));
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(syncDemo(options)).rejects.toThrow(
    "Edited registry-owned demo files"
  );
  await syncDemo({ ...options, discard: true });
  await writeFile(path.join(options.root, "new.ts"), "// user file\n");
  options.expected.set("new.ts", "// canonical file\n");
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(syncDemo(options)).rejects.toThrow("new.ts");
});
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
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
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(syncDemo({ ...options, expected: new Map() })).rejects.toThrow(
    "removal is outside demo sync scope"
  );
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
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
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(syncDemo({ ...options, discard: true })).rejects.toThrow(
    "symlink"
  );
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe(before);
});
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
test("edits moved upstream can advance the baseline without discarding", async () => {
  const options = await fixture();
  const source =
    "// edit now canonical upstream\nexport type Result = number;\n";
  await writeFile(path.join(options.root, "implementation.ts"), source);
  options.expected.set("implementation.ts", source);
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(syncDemo({ ...options, check: true })).rejects.toThrow(
    `Baseline drift: ${options.baseline}`
  );
  await syncDemo(options);
  await syncDemo({ ...options, check: true });
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe(source);
});
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
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
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
  const baseline = JSON.parse(await readFile(options.baseline, "utf-8"));
  // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
  expect(Object.keys(baseline.files)).toEqual(
    // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-call -- This test deliberately supplies a partial mock or asymmetric matcher; runtime assertions verify the exercised contract.
    [...options.expected.keys()].toSorted()
  );
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
      // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
test("a symlinked baseline is rejected before source or external target writes", async () => {
  const options = await fixture();
  const external = path.join(options.root, "external.json");
  const before = await readFile(options.baseline, "utf-8");
  await writeFile(external, before);
  await rm(options.baseline);
  await fs.symlink(external, options.baseline);
  options.expected.set("implementation.ts", "// changed canonical\n");
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(syncDemo(options)).rejects.toThrow("symlink");
  expect(await readFile(external, "utf-8")).toBe(before);
  expect(
    await readFile(path.join(options.root, "implementation.ts"), "utf-8")
  ).toBe("// canonical\nexport type Result = string;\n");
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
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
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
  await expect(fs.stat(temporary)).rejects.toThrow("ENOENT");
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */
